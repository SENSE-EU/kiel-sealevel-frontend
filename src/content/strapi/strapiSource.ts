import { z } from 'zod';
import {
  SceneDetailResponseSchema,
  SceneParamsSchema,
  SceneSummarySchema,
} from '@/api-contracts';
import {
  ContentUnavailableError,
  type ContentSource,
  type SceneData,
  type SceneSummary,
} from '@/content/types';
import { fallbackLocale, type Locale } from '@/i18n/locales';
import { mergeById, mergeScene } from './merge';

/**
 * GETs one of the CMS's public endpoints (`/cms/api/public/...`, see kiel-sealevel-cms docs/public-api.md)
 * and checks the body against the shared contract. Resolves to null on 404, which the API returns
 * when the scene doesn't exist in that language.
 */
async function fetchPublic<T>(
  path: string,
  schema: z.ZodType<T>,
  locale: Locale,
  signal?: AbortSignal,
): Promise<T | null> {
  const response = await fetch(
    `/cms/api/public/${path}?${new URLSearchParams({ locale })}`,
    { signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ContentUnavailableError(`CMS responded with ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    console.error(
      `[content] /cms/api/public/${path} broke the contract`,
      parsed.error,
    );
    throw new ContentUnavailableError('CMS response broke the contract', {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * The list is only checked as a whole for its shape; each scene is then checked on its own. A scene
 * that breaks the contract (e.g. a malformed slug that got past the CMS's own validation) is left out
 * with a console error, so one bad entry doesn't take the whole landing page down.
 */
const LooseSceneListSchema = z.object({ data: z.array(z.unknown()) });

function validScenes(items: unknown[]): SceneSummary[] {
  return items.flatMap((item) => {
    const parsed = SceneSummarySchema.safeParse(item);
    if (parsed.success) return [parsed.data];
    console.error(
      '[content] Skipped a scene that broke the contract',
      item,
      parsed.error,
    );
    return [];
  });
}

/**
 * Asks for the requested and the fallback locale and merges them, so anything missing in one language
 * shows in the other. One failing is tolerated (e.g. a locale not enabled yet); both failing means the
 * CMS is unavailable.
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
        validScenes(
          (await fetchPublic('scenes', LooseSceneListSchema, l, signal))
            ?.data ?? [],
        ),
      mergeById,
      signal,
    );
  },

  async getScene(slug, locale, signal) {
    // The API rejects malformed slugs with a 400; they can't match a scene, so skip the request.
    if (!SceneParamsSchema.safeParse({ slug }).success) return null;
    return fetchBothLocales<SceneData | null>(
      locale,
      async (l) =>
        (
          await fetchPublic(
            `scenes/${slug}`,
            SceneDetailResponseSchema,
            l,
            signal,
          )
        )?.data ?? null,
      mergeScene,
      signal,
    );
  },
};
