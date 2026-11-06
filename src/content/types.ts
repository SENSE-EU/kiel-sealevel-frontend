import type { Locale } from '@/i18n/locales';

export interface MediaAsset {
  url: string;
  alt: string;
  sizeBytes?: number;
}

/** Strapi Blocks JSON. A plain string is also accepted, in case the field is set up as plain text. */
export type RichText = BlockNode[] | string;

export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

export interface LinkNode {
  type: 'link';
  url: string;
  children: InlineNode[];
}

export type InlineNode = TextNode | LinkNode;

export type BlockNode =
  | { type: 'paragraph' | 'quote' | 'code'; children: InlineNode[] }
  | { type: 'heading'; level: number; children: InlineNode[] }
  | { type: 'list'; format: 'ordered' | 'unordered'; children: BlockNode[] }
  | { type: 'list-item'; children: InlineNode[] }
  | { type: 'image'; image: { url: string; alternativeText?: string | null } };

export interface Viewpoint {
  id: string;
  name: string;
  /** Node name in the GLB. */
  anchor: string;
  order: number;
  label: string;
}

export interface Hotspot {
  id: string;
  title: string;
  body: RichText;
  image: MediaAsset | null;
  video: MediaAsset | null;
  /** Node name in the GLB. */
  anchor: string;
  order: number;
}

export interface SceneSummary {
  id: string;
  slug: string;
  title: string;
  teaser: string;
  cardImage: MediaAsset | null;
}

export interface Scene extends SceneSummary {
  /** Null means the frontend's built-in fallback scene is used. */
  model: MediaAsset | null;
  startViewpointId: string | null;
  viewpoints: Viewpoint[];
  hotspots: Hotspot[];
  credits: string;
}

export interface ContentSource {
  listScenes(locale: Locale, signal?: AbortSignal): Promise<SceneSummary[]>;
  /** Resolves to null when the scene doesn't exist, rejects when the CMS can't be reached. */
  getScene(
    slug: string,
    locale: Locale,
    signal?: AbortSignal,
  ): Promise<Scene | null>;
}

export class ContentUnavailableError extends Error {
  override name = 'ContentUnavailableError';
}
