import type { SceneData } from '@/content/types';

const byOrder = (a: { order: number }, b: { order: number }) =>
  a.order - b.order;

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
  primary: SceneData | null,
  fallback: SceneData | null,
): SceneData | null {
  if (!primary || !fallback) return primary ?? fallback;
  return {
    ...preferFilled(primary, fallback),
    viewpoints: mergeById(primary.viewpoints, fallback.viewpoints).sort(
      byOrder,
    ),
    hotspots: mergeById(primary.hotspots, fallback.hotspots).sort(byOrder),
  };
}
