import {
  ContentUnavailableError,
  type ContentSource,
  type Scene,
  type SceneSummary,
} from '@/content/types';
import { fallbackLocale, type Locale } from '@/i18n/locales';
import {
  mapScene,
  mapSummary,
  mergeById,
  mergeScene,
  type RawScene,
} from './mappers';

const SUMMARY_PARAMS = { 'populate[cardImage]': 'true' };

const SCENE_PARAMS = {
  ...SUMMARY_PARAMS,
  'populate[model]': 'true',
  'populate[startViewpoint]': 'true',
  'populate[viewpoints]': 'true',
  'populate[hotspots][populate][image]': 'true',
  'populate[hotspots][populate][video]': 'true',
};

async function fetchScenes(
  params: Record<string, string>,
  locale: Locale,
  signal?: AbortSignal,
): Promise<RawScene[]> {
  const query = new URLSearchParams({ ...params, locale });
  const response = await fetch(`/api/scenes?${query}`, { signal });
  if (!response.ok) {
    throw new ContentUnavailableError(`CMS responded with ${response.status}`);
  }
  const body = (await response.json()) as { data: RawScene[] };
  return body.data;
}

/**
 * Asks for the requested and the fallback locale and merges them. One failing is tolerated (e.g. a
 * locale not enabled yet); both failing means the CMS is unavailable.
 */
async function fetchBothLocales<T>(
  locale: Locale,
  load: (locale: Locale) => Promise<T>,
  merge: (primary: T, fallback: T) => T,
  signal?: AbortSignal,
): Promise<T> {
  const [primary, fallback] = await Promise.allSettled([
    load(locale),
    load(fallbackLocale(locale)),
  ]);
  signal?.throwIfAborted();
  if (primary.status === 'fulfilled' && fallback.status === 'fulfilled') {
    return merge(primary.value, fallback.value);
  }
  if (primary.status === 'fulfilled') return primary.value;
  if (fallback.status === 'fulfilled') return fallback.value;
  throw new ContentUnavailableError('CMS unavailable', {
    cause: primary.reason,
  });
}

export const strapiSource: ContentSource = {
  listScenes(locale, signal) {
    return fetchBothLocales<SceneSummary[]>(
      locale,
      async (l) =>
        (await fetchScenes(SUMMARY_PARAMS, l, signal)).map(mapSummary),
      mergeById,
      signal,
    );
  },

  getScene(slug, locale, signal) {
    return fetchBothLocales<Scene | null>(
      locale,
      async (l) => {
        const params = { ...SCENE_PARAMS, 'filters[slug][$eq]': slug };
        const [raw] = await fetchScenes(params, l, signal);
        return raw ? mapScene(raw) : null;
      },
      mergeScene,
      signal,
    );
  },
};
