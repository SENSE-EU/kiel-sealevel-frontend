import { describe, expect, it } from 'vitest';
import { hotspotMedia } from './media';
import type { HotspotData } from './types';

const hotspot = (overrides: Partial<HotspotData>): HotspotData => ({
  id: 'h1',
  title: 'Title',
  body: '',
  image: null,
  video: null,
  anchor: 'hs_1',
  order: 1,
  ...overrides,
});

describe('hotspotMedia', () => {
  it('puts the CMS video first, with the image as its poster, then the image', () => {
    const media = hotspotMedia(
      hotspot({
        video: { url: '/uploads/v.webm', alt: '' },
        image: { url: '/uploads/i.png', alt: 'Casings' },
      }),
      'en',
    );
    expect(media.slice(0, 2)).toEqual([
      {
        kind: 'video',
        url: '/uploads/v.webm',
        alt: '',
        poster: '/uploads/i.png',
      },
      { kind: 'image', url: '/uploads/i.png', alt: 'Casings' },
    ]);
  });

  it('adds placeholders after the CMS media, with alt text in the page language', () => {
    const media = hotspotMedia(hotspot({ order: 3 }), 'de');
    expect(media.length).toBeGreaterThan(1);
    expect(media.some((item) => item.kind === 'video')).toBe(true);
    for (const item of media.filter((entry) => entry.kind === 'image')) {
      expect(item.url).toMatch(/^\/placeholders\//);
      expect(item.alt).toBe('Platzhalterbild aus der 3D-Szene');
    }
  });
});
