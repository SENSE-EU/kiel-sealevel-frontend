import { describe, expect, it } from 'vitest';
import { cardMedia } from './media';
import type { Hotspot } from './types';

const hotspot = (overrides: Partial<Hotspot>): Hotspot => ({
  id: 'h1',
  title: 'Title',
  body: '',
  images: [],
  image: null,
  video: null,
  anchor: 'hs_1',
  order: 1,
  ...overrides,
});

describe('cardMedia', () => {
  it('shows the video first, then every image in order', () => {
    const images = [
      {
        url: '/uploads/a.jpg',
        alt: 'Sea mine',
        caption: 'Unexploded sea mine on the seabed',
      },
      { url: '/uploads/b.jpg', alt: 'Depth charge' },
    ];
    expect(
      cardMedia(
        hotspot({
          images,
          image: images[0]!,
          video: { url: '/uploads/v.mp4', alt: '' },
        }),
      ),
    ).toEqual([
      { kind: 'video', url: '/uploads/v.mp4', alt: '' },
      {
        kind: 'image',
        url: '/uploads/a.jpg',
        alt: 'Sea mine',
        caption: 'Unexploded sea mine on the seabed',
      },
      { kind: 'image', url: '/uploads/b.jpg', alt: 'Depth charge' },
    ]);
  });

  it('falls back to the single image when the list is empty', () => {
    expect(
      cardMedia(hotspot({ image: { url: '/uploads/i.png', alt: 'Casings' } })),
    ).toEqual([{ kind: 'image', url: '/uploads/i.png', alt: 'Casings' }]);
  });

  it('is empty without media', () => {
    expect(cardMedia(hotspot({}))).toEqual([]);
  });
});
