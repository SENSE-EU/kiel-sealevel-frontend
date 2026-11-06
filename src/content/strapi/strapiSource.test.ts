import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentUnavailableError } from '@/content/types';
import type { RawScene } from './mappers';
import { strapiSource } from './strapiSource';

const hotspot = (documentId: string, title: string | null, order: number) => ({
  documentId,
  title,
  body: 'text',
  anchor: `hs_${documentId}`,
  order,
});

const en: RawScene = {
  documentId: 's1',
  slug: 'munitions',
  title: 'Munitions',
  teaser: 'English teaser',
  model: { url: '/uploads/scene.glb', size: 2048 },
  startViewpoint: { documentId: 'v1' },
  viewpoints: [
    { documentId: 'v1', anchor: 'vp_start', label: 'Start', order: 1 },
  ],
  hotspots: [hotspot('h2', 'Second', 2), hotspot('h1', 'First', 1)],
};

const de: RawScene = {
  documentId: 's1',
  slug: 'munitions',
  title: 'Munition',
  teaser: '',
  hotspots: [hotspot('h1', 'Erstes', 1)],
};

function stubStrapi(byLocale: Record<string, RawScene[] | number>) {
  const fetchMock = vi.fn(async (url: string) => {
    const locale = new URL(url, 'http://x').searchParams.get('locale')!;
    const result = byLocale[locale] ?? [];
    return typeof result === 'number'
      ? new Response(null, { status: result })
      : Response.json({ data: result });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('strapiSource.getScene', () => {
  it('prefers the requested locale and fills gaps from the fallback', async () => {
    stubStrapi({ de: [de], en: [en] });
    const scene = await strapiSource.getScene('munitions', 'de');

    expect(scene?.title).toBe('Munition');
    expect(scene?.teaser).toBe('English teaser');
    expect(scene?.model).toEqual({
      url: '/uploads/scene.glb',
      alt: '',
      sizeBytes: 2097152,
    });
    expect(scene?.hotspots.map((h) => h.title)).toEqual(['Erstes', 'Second']);
  });

  it('requests explicit populate and filters by slug', async () => {
    const fetchMock = stubStrapi({ de: [de], en: [en] });
    await strapiSource.getScene('munitions', 'de');
    const params = new URL(fetchMock.mock.calls[0]![0], 'http://x')
      .searchParams;

    expect(params.get('filters[slug][$eq]')).toBe('munitions');
    expect(params.get('populate[hotspots][populate][image]')).toBe('true');
    expect(params.get('locale')).toBe('de');
  });

  it('still works when one locale fails', async () => {
    stubStrapi({ de: 400, en: [en] });
    expect((await strapiSource.getScene('munitions', 'de'))?.title).toBe(
      'Munitions',
    );
  });

  it('resolves to null for an unknown scene', async () => {
    stubStrapi({ de: [], en: [] });
    expect(await strapiSource.getScene('nope', 'de')).toBeNull();
  });

  it('rejects when the CMS is down', async () => {
    stubStrapi({ de: 503, en: 503 });
    await expect(
      strapiSource.getScene('munitions', 'de'),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
  });
});
