import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SceneDetailDto } from '@/api-contracts';
import { ContentUnavailableError } from '@/content/types';
import { strapiSource } from './strapiSource';

const hotspot = (id: string, title: string, order: number) => ({
  id,
  title,
  body: 'text',
  image: null,
  video: null,
  anchor: `hs_${id}`,
  order,
});

const en: SceneDetailDto = {
  id: 's1',
  slug: 'munitions',
  title: 'Munitions',
  teaser: 'English teaser',
  cardImage: null,
  model: { url: '/uploads/scene.glb', alt: '', sizeBytes: 2097152 },
  startViewpointId: 'v1',
  credits: '',
  viewpoints: [
    { id: 'v1', name: 'Start', label: 'Start', anchor: 'vp_1', order: 1 },
  ],
  hotspots: [hotspot('h1', 'First', 1), hotspot('h2', 'Second', 2)],
};

const de: SceneDetailDto = {
  ...en,
  title: 'Munition',
  teaser: '',
  model: null,
  viewpoints: [],
  hotspots: [hotspot('h1', 'Erstes', 1)],
};

type Reply = object | number;

/** Fakes the public API: `routes` maps "path?locale" to a JSON body or a status code. */
function stubApi(routes: Record<string, Reply>) {
  const fetchMock = vi.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url, 'http://x');
    const reply = routes[`${pathname}?${searchParams.get('locale')}`] ?? 404;
    return typeof reply === 'number'
      ? Response.json(
          { error: { code: 'NOT_FOUND', message: 'Scene not found' } },
          { status: reply },
        )
      : Response.json(reply);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const scene = (locale: string) => `/cms/api/public/scenes/munitions?${locale}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('strapiSource.getScene', () => {
  it('prefers the requested locale and fills gaps from the fallback', async () => {
    stubApi({ [scene('de')]: { data: de }, [scene('en')]: { data: en } });
    const result = await strapiSource.getScene('munitions', 'de');

    expect(result?.title).toBe('Munition');
    expect(result?.teaser).toBe('English teaser');
    expect(result?.model?.sizeBytes).toBe(2097152);
    expect(result?.viewpoints).toHaveLength(1);
    expect(result?.hotspots.map((h) => h.title)).toEqual(['Erstes', 'Second']);
  });

  it('calls the public endpoint once per locale', async () => {
    const fetchMock = stubApi({ [scene('de')]: { data: de } });
    await strapiSource.getScene('munitions', 'de');
    const urls = fetchMock.mock.calls.map((call) => call[0]).sort();

    expect(urls).toEqual([
      '/cms/api/public/scenes/munitions?locale=de',
      '/cms/api/public/scenes/munitions?locale=en',
    ]);
  });

  it('uses the other language when the scene only exists in one', async () => {
    stubApi({ [scene('en')]: { data: en } });
    expect((await strapiSource.getScene('munitions', 'de'))?.title).toBe(
      'Munitions',
    );
  });

  it('resolves to null for an unknown scene', async () => {
    stubApi({});
    expect(await strapiSource.getScene('nope', 'de')).toBeNull();
  });

  it('resolves to null for a malformed slug without asking the CMS', async () => {
    const fetchMock = stubApi({});
    expect(await strapiSource.getScene('Not A Slug', 'de')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when the CMS is down', async () => {
    stubApi({ [scene('de')]: 503, [scene('en')]: 503 });
    await expect(
      strapiSource.getScene('munitions', 'de'),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
  });

  it('rejects a response that breaks the contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { data: { ...en, hotspots: [{ id: 'h1' }] } };
    stubApi({ [scene('de')]: broken, [scene('en')]: broken });
    await expect(
      strapiSource.getScene('munitions', 'de'),
    ).rejects.toBeInstanceOf(ContentUnavailableError);
  });
});

describe('strapiSource.listScenes', () => {
  it('merges both languages by id', async () => {
    const summary = (id: string, title: string, teaser = '') => ({
      id,
      slug: id,
      title,
      teaser,
      cardImage: null,
    });
    stubApi({
      '/cms/api/public/scenes?de': { data: [summary('a', 'A de')] },
      '/cms/api/public/scenes?en': {
        data: [summary('a', 'A en', 'Teaser'), summary('b', 'B en')],
      },
    });
    const list = await strapiSource.listScenes('de');

    expect(list.map((s) => [s.title, s.teaser])).toEqual([
      ['A de', 'Teaser'],
      ['B en', ''],
    ]);
  });

  it('leaves out a scene that breaks the contract and keeps the rest', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const valid = {
      id: 'a',
      slug: 'a',
      title: 'A',
      teaser: '',
      cardImage: null,
    };
    const badSlug = { ...valid, id: 'b', slug: 'Bad_Slug', title: 'B' };
    stubApi({
      '/cms/api/public/scenes?de': { data: [valid, badSlug] },
      '/cms/api/public/scenes?en': { data: [valid, badSlug] },
    });

    expect((await strapiSource.listScenes('de')).map((s) => s.id)).toEqual([
      'a',
    ]);
    expect(error).toHaveBeenCalled();
  });

  it('rejects a list response with the wrong shape', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubApi({
      '/cms/api/public/scenes?de': { scenes: [] },
      '/cms/api/public/scenes?en': { scenes: [] },
    });
    await expect(strapiSource.listScenes('de')).rejects.toBeInstanceOf(
      ContentUnavailableError,
    );
  });

  it('is empty when there are no scenes', async () => {
    stubApi({
      '/cms/api/public/scenes?de': { data: [] },
      '/cms/api/public/scenes?en': { data: [] },
    });
    expect(await strapiSource.listScenes('de')).toEqual([]);
  });
});
