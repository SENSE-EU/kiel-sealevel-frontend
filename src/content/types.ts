import type { Locale } from '@/i18n/locales';
import type {
  BlockNodeDto,
  HotspotDto,
  InlineNodeDto,
  LinkNodeDto,
  MediaDto,
  RichTextDto,
  SceneDetailDto,
  SceneSummaryDto,
  TextNodeDto,
  ViewpointDto,
} from '@/api-contracts';

// The CMS's public API contracts are the source of truth for content shapes; these are the names
// the app uses for them. A null `model` means the built-in fallback scene is used.
export type MediaAsset = MediaDto;
export type RichText = RichTextDto;
export type TextNode = TextNodeDto;
export type LinkNode = LinkNodeDto;
export type InlineNode = InlineNodeDto;
export type BlockNode = BlockNodeDto;
export type Viewpoint = ViewpointDto;
export type SceneSummary = SceneSummaryDto;
export type Hotspot = HotspotDto;
export type Scene = SceneDetailDto;
/** One picture or video on a hotspot card. */
export interface CardMedia {
  kind: 'image' | 'video';
  url: string;
  alt: string;
  caption?: string;
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
