import { useCallback } from 'react';
import type { Locale } from '@/i18n/locales';
import { getContentSource } from './source';
import { useResource } from './useResource';

export function useScenes(locale: Locale) {
  return useResource(
    useCallback(
      async (signal: AbortSignal) =>
        (await getContentSource()).listScenes(locale, signal),
      [locale],
    ),
  );
}

export function useScene(slug: string, locale: Locale) {
  return useResource(
    useCallback(
      async (signal: AbortSignal) =>
        (await getContentSource()).getScene(slug, locale, signal),
      [slug, locale],
    ),
  );
}
