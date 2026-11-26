import type { Locale } from '@/i18n/locales';
import type { CardMedia, HotspotData, Scene, SceneData } from './types';

/**
 * PLACEHOLDER: the CMS holds one image and one video per hotspot, and cards can show any number. Until the
 * CMS has a gallery field and the real pictures are in, each card gets a few stills rendered from our own S1
 * scene (`public/placeholders/gallery-*.webp`) after its CMS media. Set this to false, or delete it with the
 * files, once the CMS sends the gallery.
 */
const PLACEHOLDER_GALLERY = true;

const placeholderImages = [1, 2, 3, 4, 5].map(
  (n) => `/placeholders/gallery-${n}.webp`,
);
const placeholderVideo = '/placeholders/hotspot-video.webm';
const placeholderAlt: Record<Locale, string> = {
  de: 'Platzhalterbild aus der 3D-Szene',
  en: 'Placeholder image from the 3D scene',
};

function placeholders(order: number, locale: Locale): CardMedia[] {
  const alt = placeholderAlt[locale];
  // Two stills per card, a different pair for each point. Most points also get a video, so a card with
  // a video in the middle, and one with two videos (point 2 already has one), both get tried.
  const first = (order * 2) % placeholderImages.length;
  const images = [first, first + 1].map((index): CardMedia => ({
    kind: 'image',
    url: placeholderImages[index % placeholderImages.length]!,
    alt,
  }));
  return order % 3 !== 1
    ? [
        images[0]!,
        { kind: 'video', url: placeholderVideo, alt: '' },
        images[1]!,
      ]
    : images;
}

/** A hotspot's gallery: its video (if any) first, then its image, then any placeholders. */
export function hotspotMedia(
  hotspot: HotspotData,
  locale: Locale,
): CardMedia[] {
  const media: CardMedia[] = [];
  if (hotspot.video) {
    media.push({
      kind: 'video',
      url: hotspot.video.url,
      alt: hotspot.video.alt,
      ...(hotspot.image && { poster: hotspot.image.url }),
    });
  }
  if (hotspot.image) {
    media.push({
      kind: 'image',
      url: hotspot.image.url,
      alt: hotspot.image.alt,
    });
  }
  if (PLACEHOLDER_GALLERY) media.push(...placeholders(hotspot.order, locale));
  return media;
}

export function withMedia(scene: SceneData, locale: Locale): Scene {
  return {
    ...scene,
    hotspots: scene.hotspots.map((hotspot) => ({
      ...hotspot,
      media: hotspotMedia(hotspot, locale),
    })),
  };
}
