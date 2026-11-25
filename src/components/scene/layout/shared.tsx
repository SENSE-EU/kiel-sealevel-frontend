import { type RefObject, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import type { Hotspot, RichText, Scene } from '@/content/types';
import type { Insets } from '@/engine/SceneEngine';
import type { Locale } from '@/i18n/locales';
import { HotspotList } from '../HotspotList';
import { ChevronLeft } from '../icons';

/** What every layout gets from SceneExperience. All hotspots are always on screen as pins. */
export interface LayoutProps {
  scene: Scene;
  locale: Locale;
  hotspots: Hotspot[];
  visited: string[];
  /** The hotspot whose panel is open. */
  activeHotspotId: string | null;
  onOpenHotspot: (id: string) => void;
  /** The hotspot the camera frames without its panel open (the card in the middle, the point picked). */
  focusedHotspotId: string | null;
  onFocusHotspot: (id: string | null) => void;
  /** How much of the scene the layout's own UI covers, so the scene can sit in the rest. */
  onInsets: (insets: Insets) => void;
}

/**
 * Scrolls an element to a position over a short ease, frame by frame, with scroll snapping paused. Smooth
 * scrollTo on a snapping container is unreliable (Safari snaps straight back). Returns a cancel function.
 */
export function glide(
  element: HTMLElement,
  axis: 'left' | 'top',
  to: number,
): () => void {
  const key = axis === 'left' ? 'scrollLeft' : 'scrollTop';
  const max =
    axis === 'left'
      ? element.scrollWidth - element.clientWidth
      : element.scrollHeight - element.clientHeight;
  const target = Math.max(0, Math.min(to, max));
  const from = element[key];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduce || Math.abs(target - from) < 2 ? 0 : 380;
  const start = performance.now();
  let frame = 0;
  element.style.scrollSnapType = 'none';
  const step = (now: number) => {
    const t = duration ? Math.min(1, (now - start) / duration) : 1;
    element[key] = from + (target - from) * (1 - (1 - t) ** 3);
    if (t < 1) frame = requestAnimationFrame(step);
    else
      frame = requestAnimationFrame(() => (element.style.scrollSnapType = ''));
  };
  frame = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(frame);
    element.style.scrollSnapType = '';
  };
}

const NO_INSETS: Insets = { bottom: 0, left: 0, right: 0 };

/**
 * Reports which edge of the scene an overlay covers and by how much: a wide or centred element covers the
 * bottom, a narrow one at the side covers that side. Nothing while it's hidden or gone.
 */
export function useInsets(
  ref: RefObject<HTMLElement | null>,
  onInsets: (insets: Insets) => void,
  /** Measures again when this changes, e.g. when another element takes the ref. */
  watch: unknown,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const area = element.offsetParent?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const shown =
        box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      if (!area || !shown) return onInsets(NO_INSETS);
      const leftGap = box.left - area.left;
      const rightGap = area.right - box.right;
      const centred = Math.abs(leftGap - rightGap) < 48;
      if (box.width > area.width * 0.6 || centred)
        return onInsets({ ...NO_INSETS, bottom: area.bottom - box.top });
      const nearerLeft = leftGap < rightGap;
      // On a tall screen a box in a bottom corner also lifts the scene: there's room above, not beside it.
      const inBottomCorner =
        area.height > area.width && box.top > area.top + area.height / 2;
      if (inBottomCorner)
        return onInsets({ ...NO_INSETS, bottom: area.bottom - box.top });
      onInsets(
        nearerLeft
          ? { ...NO_INSETS, left: box.right - area.left }
          : { ...NO_INSETS, right: area.right - box.left },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      onInsets(NO_INSETS);
    };
  }, [ref, onInsets, watch]);
}

/** The words of a rich text, for short previews. */
export function plainText(value: RichText): string {
  if (typeof value === 'string') return value;
  const words: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      const { text, children } = node as { text?: unknown; children?: unknown };
      if (typeof text === 'string') words.push(text);
      walk(children);
    }
  };
  walk(value);
  return words.join(' ');
}

export const glass = 'panel';
/** Square glass icon button, the one button shape over the scene. */
export const roundButton =
  'panel flex size-11 shrink-0 items-center justify-center rounded-full text-foam transition-colors duration-200 enabled:hover:border-signal/60 enabled:hover:text-signal disabled:text-dim/70';

/** Back link, title, language and the list of all hotspots. */
export function SceneHeader({
  scene,
  locale,
  hotspots,
  visited,
  activeHotspotId,
  onOpenHotspot,
}: LayoutProps) {
  const { t } = useTranslation();
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-linear-to-b from-abyss/55 to-transparent px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 md:px-5 md:pt-5">
      <div className="flex min-w-0 items-center gap-3.5">
        <Link
          to={`/${locale}`}
          aria-label={t('scene.back')}
          className={`pointer-events-auto ${roundButton}`}
        >
          <ChevronLeft />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate display text-xl leading-7 font-normal md:text-[1.625rem] md:leading-8">
            {scene.title}
          </h1>
          <p className="truncate text-[0.8125rem] leading-5 text-mist">
            {scene.teaser}
          </p>
        </div>
      </div>
      <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
        <LanguageSwitch />
        <HotspotList
          hotspots={hotspots}
          visited={visited}
          activeHotspotId={activeHotspotId}
          onOpen={onOpenHotspot}
          credits={scene.credits.trim()}
        />
      </div>
    </header>
  );
}

// Tailwind's md breakpoint: tablets and up.
const WIDE = '(min-width: 48rem)';

/** True on tablets and up. */
export function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(WIDE).matches,
  );
}
