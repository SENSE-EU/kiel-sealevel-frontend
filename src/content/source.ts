import type { ContentSource } from './types';

let source: Promise<ContentSource> | undefined;

export function getContentSource(): Promise<ContentSource> {
  source ??=
    import.meta.env.VITE_CONTENT_SOURCE === 'mock'
      ? import('./mock/mockSource').then((m) => m.mockSource)
      : import('./strapi/strapiSource').then((m) => m.strapiSource);
  return source;
}
