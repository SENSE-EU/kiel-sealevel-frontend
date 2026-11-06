import { useCallback, useState } from 'react';

type VisitedStorage = Pick<Storage, 'getItem' | 'setItem'>;

const storageKey = (sceneSlug: string) => `kiel-sealevel:visited:${sceneSlug}`;

// Storage can be unavailable (private mode, quota), in which case progress just isn't remembered.
export function readVisited(
  sceneSlug: string,
  storage: VisitedStorage,
): string[] {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(storageKey(sceneSlug)) ?? '[]',
    );
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeVisited(
  sceneSlug: string,
  ids: string[],
  storage: VisitedStorage,
) {
  try {
    storage.setItem(storageKey(sceneSlug), JSON.stringify(ids));
  } catch {
    /* see above */
  }
}

/** Visited hotspot ids, kept in the browser. Ids are stable across languages. */
export function useVisitedHotspots(sceneSlug: string) {
  const [visited, setVisited] = useState(() =>
    readVisited(sceneSlug, window.localStorage),
  );

  const markVisited = useCallback(
    (id: string) => {
      setVisited((current) => {
        if (current.includes(id)) return current;
        const next = [...current, id];
        writeVisited(sceneSlug, next, window.localStorage);
        return next;
      });
    },
    [sceneSlug],
  );

  return { visited, markVisited };
}
