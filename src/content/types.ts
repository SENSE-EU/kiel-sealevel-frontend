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

/** A scene and its hotspots as the CMS sends them. */
export type SceneData = SceneDetailDto;
export type HotspotData = HotspotDto;

/** One picture or video in a card's gallery. */
export interface CardMedia {
  kind: 'image' | 'video';
  url: string;
  alt: string;
  /** Shown before a video plays. */
  poster?: string;
}

/** A hotspot as the app uses it: the CMS fields plus its gallery, in the order it shows. */
export type Hotspot = HotspotData & { media: CardMedia[] };
export type Scene = Omit<SceneData, 'hotspots'> & { hotspots: Hotspot[] };

export interface ContentSource {
  listScenes(locale: Locale, signal?: AbortSignal): Promise<SceneSummary[]>;
  /** Resolves to null when the scene doesn't exist, rejects when the CMS can't be reached. */
  getScene(
    slug: string,
    locale: Locale,
    signal?: AbortSignal,
  ): Promise<SceneData | null>;
}

export class ContentUnavailableError extends Error {
  override name = 'ContentUnavailableError';
}
