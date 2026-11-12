import type {
  Hotspot,
  MediaAsset,
  RichText,
  Scene,
  SceneSummary,
  Viewpoint,
} from '@/content/types';

/** Strapi 5 REST shapes: flat documents, with `documentId` stable across locales. */
export interface RawMedia {
  url: string;
  alternativeText?: string | null;
  /** Kilobytes, as Strapi reports it. */
  size?: number | null;
}

export interface RawViewpoint {
  documentId: string;
  name?: string | null;
  anchor?: string | null;
  order?: number | null;
  label?: string | null;
}

export interface RawHotspot {
  documentId: string;
  title?: string | null;
  body?: RichText | null;
  image?: RawMedia | null;
  imageAlt?: string | null;
  video?: RawMedia | null;
  anchor?: string | null;
  order?: number | null;
}

export interface RawScene {
  documentId: string;
  slug: string;
  title?: string | null;
  teaser?: string | null;
  cardImage?: RawMedia | null;
  model?: RawMedia | null;
  startViewpoint?: { documentId: string } | null;
  viewpoints?: RawViewpoint[] | null;
  hotspots?: RawHotspot[] | null;
  credits?: string | null;
}

function mapMedia(
  raw: RawMedia | null | undefined,
  alt?: string | null,
): MediaAsset | null {
  if (!raw?.url) return null;
  return {
    url: raw.url,
    alt: alt || raw.alternativeText || '',
    ...(raw.size != null && { sizeBytes: Math.round(raw.size * 1024) }),
  };
}

const byOrder = (a: { order: number }, b: { order: number }) =>
  a.order - b.order;

export function mapSummary(raw: RawScene): SceneSummary {
  return {
    id: raw.documentId,
    slug: raw.slug,
    title: raw.title ?? '',
    teaser: raw.teaser ?? '',
    cardImage: mapMedia(raw.cardImage),
  };
}

function mapViewpoint(raw: RawViewpoint): Viewpoint {
  return {
    id: raw.documentId,
    name: raw.name ?? '',
    anchor: raw.anchor ?? '',
    order: raw.order ?? 0,
    label: raw.label ?? '',
  };
}

function mapHotspot(raw: RawHotspot): Hotspot {
  return {
    id: raw.documentId,
    title: raw.title ?? '',
    body: raw.body ?? '',
    image: mapMedia(raw.image, raw.imageAlt),
    video: mapMedia(raw.video),
    anchor: raw.anchor ?? '',
    order: raw.order ?? 0,
  };
}

export function mapScene(raw: RawScene): Scene {
  return {
    ...mapSummary(raw),
    model: mapMedia(raw.model),
    startViewpointId: raw.startViewpoint?.documentId ?? null,
    viewpoints: (raw.viewpoints ?? []).map(mapViewpoint).sort(byOrder),
    hotspots: (raw.hotspots ?? []).map(mapHotspot).sort(byOrder),
    credits: raw.credits ?? '',
  };
}

function isEmpty(value: unknown): boolean {
  return (
    value == null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Takes each field from `primary`, or from `fallback` where `primary` left it empty. */
export function preferFilled<T extends object>(primary: T, fallback: T): T {
  const merged = { ...primary };
  for (const key of Object.keys(fallback) as (keyof T)[]) {
    if (isEmpty(merged[key])) merged[key] = fallback[key];
  }
  return merged;
}

/** Union of both lists by id, so an untranslated hotspot still shows in the other language. */
export function mergeById<T extends { id: string }>(
  primary: T[],
  fallback: T[],
): T[] {
  const fallbackById = new Map(fallback.map((item) => [item.id, item]));
  const primaryIds = new Set(primary.map((item) => item.id));
  return [
    ...primary.map((item) => {
      const other = fallbackById.get(item.id);
      return other ? preferFilled(item, other) : item;
    }),
    ...fallback.filter((item) => !primaryIds.has(item.id)),
  ];
}

export function mergeScene(
  primary: Scene | null,
  fallback: Scene | null,
): Scene | null {
  if (!primary || !fallback) return primary ?? fallback;
  return {
    ...preferFilled(primary, fallback),
    viewpoints: mergeById(primary.viewpoints, fallback.viewpoints).sort(
      byOrder,
    ),
    hotspots: mergeById(primary.hotspots, fallback.hotspots).sort(byOrder),
  };
}
