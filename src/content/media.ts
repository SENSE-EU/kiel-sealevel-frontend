import type { CardMedia, Hotspot } from './types';

/** A hotspot card's pictures and videos: its video first, if it has one, then its images in order. */
export function cardMedia(hotspot: Hotspot): CardMedia[] {
  const images = hotspot.images.length
    ? hotspot.images
    : hotspot.image
      ? [hotspot.image]
      : [];
  return [
    ...(hotspot.video
      ? [
          {
            kind: 'video' as const,
            url: hotspot.video.url,
            alt: hotspot.video.alt,
          },
        ]
      : []),
    ...images.map((image) => ({
      kind: 'image' as const,
      url: image.url,
      alt: image.alt,
    })),
  ];
}
