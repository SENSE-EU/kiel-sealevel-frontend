import {
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { RichText } from '@/components/RichText';
import type { Hotspot } from '@/content/types';
import { Close, Collapse, Expand, Pause, Play } from './icons';
import { glide } from './layout/shared';

function formatDuration(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const cardLook = 'panel no-scrollbar';
const roundButton =
  'flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white/10 text-foam backdrop-blur-md transition-colors hover:border-signal/60 hover:text-signal';

/** Hands focus back to where it was when the card closes, and closes it on Escape. */
function useCardKeys(onClose: () => void) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** What a card shows: media if there is any, the number, title, text and the video button. */
function CardContent({
  hotspot,
  number,
  total,
  tint,
  headingRef,
  playable = true,
  expandButton,
  onClose,
}: {
  hotspot: Hotspot;
  number: number;
  total: number;
  tint: string;
  headingRef?: Ref<HTMLHeadingElement>;
  /** False when the card is out of view: a playing video stops. */
  playable?: boolean;
  expandButton?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    if (!playable) videoRef.current?.pause();
  }, [playable]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const hasMedia = Boolean(hotspot.image || hotspot.video);
  const titleId = `hotspot-title-${hotspot.id}`;
  const closeButton = (
    <button
      type="button"
      aria-label={t('scene.closePanel')}
      onClick={onClose}
      className={roundButton}
    >
      <Close />
    </button>
  );

  return (
    <>
      {hasMedia && (
        <div
          className="relative h-40 shrink-0 overflow-hidden"
          style={{ background: `linear-gradient(${tint}, #0a0c0d)` }}
        >
          {hotspot.video ? (
            <video
              ref={videoRef}
              playsInline
              preload="metadata"
              src={hotspot.video.url}
              {...(hotspot.image && { poster: hotspot.image.url })}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={(event) =>
                setDuration(event.currentTarget.duration)
              }
              className="size-full object-cover"
            />
          ) : (
            hotspot.image && (
              <img
                src={hotspot.image.url}
                alt={hotspot.image.alt}
                className="size-full object-cover"
              />
            )
          )}
          <span className="absolute bottom-3 left-3.5 rounded-full border border-line bg-abyss/40 px-2.5 py-0.5 label text-foam backdrop-blur-md">
            {hotspot.video ? t('scene.mediaVideo') : t('scene.mediaImage')}
          </span>
          {expandButton && (
            <span className="absolute top-3 left-3">{expandButton}</span>
          )}
          <span className="absolute top-3 right-3">{closeButton}</span>
        </div>
      )}

      <div className={`px-5 pb-6 ${hasMedia ? 'pt-5' : 'pt-3'}`}>
        {/* Without media the buttons share the first line with the number, so there's no empty block. */}
        <div className="flex items-center gap-3">
          {!hasMedia && expandButton}
          <p className="flex-1 label text-signal">
            {t('scene.hotspotNumber', {
              number: String(number).padStart(2, '0'),
              total: String(total).padStart(2, '0'),
            })}
          </p>
          {!hasMedia && closeButton}
        </div>
        <h2
          ref={headingRef}
          id={titleId}
          tabIndex={-1}
          className="mt-2.5 mb-4 display text-[1.625rem] leading-[1.15] font-light text-balance outline-none"
        >
          {hotspot.title}
        </h2>
        <RichText value={hotspot.body} />
        {hotspot.video && (
          <button
            type="button"
            onClick={togglePlay}
            className="mt-5 flex w-full items-center gap-3 rounded-full border border-line bg-white/8 p-1.5 pr-4 text-left text-sm transition-colors hover:border-signal/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-abyss">
              {playing ? <Pause /> : <Play />}
            </span>
            <span>
              {`${playing ? t('scene.pauseVideo') : t('scene.playVideo')}${
                duration !== null && Number.isFinite(duration)
                  ? ` · ${formatDuration(duration)}`
                  : ''
              }`}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

/** Bottom sheet on phones, floating card at the top right on larger screens. */
export function HotspotPanel({
  hotspot,
  number,
  total,
  tint,
  onClose,
}: {
  hotspot: Hotspot;
  number: number;
  total: number;
  tint: string;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useCardKeys(onClose);
  // Move focus in so screen readers announce the card.
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <aside
      aria-labelledby={`hotspot-title-${hotspot.id}`}
      className={`absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-card md:inset-x-auto md:top-26 md:right-5 md:bottom-auto md:max-h-[calc(100dvh-14rem)] md:w-96 md:rounded-card ${cardLook}`}
    >
      <CardContent
        hotspot={hotspot}
        number={number}
        total={total}
        tint={tint}
        headingRef={headingRef}
        onClose={onClose}
      />
    </aside>
  );
}

/**
 * Phones: the open point as one card in a row of all of them. The cards either side peek in, so it's clear
 * the row slides; swiping (or dragging with a mouse, or tapping a neighbour) opens the next point. A card
 * opens at half the screen and the button at its top left makes it taller, for reading long texts.
 */
export function HotspotCarousel({
  hotspots,
  activeId,
  tint,
  onOpen,
  onClose,
}: {
  hotspots: Hotspot[];
  activeId: string;
  tint: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const row = useRef<HTMLOListElement>(null);
  const headingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const active = hotspots.findIndex((h) => h.id === activeId);
  // The card nearest the middle while the row moves, so it lights up at once instead of when it settles.
  const [live, setLive] = useState<number | null>(null);
  const lit = live ?? active;

  useCardKeys(onClose);
  // Focus follows the open card, so screen readers announce each one. It mustn't scroll the row itself.
  useEffect(() => {
    headingRefs.current.get(activeId)?.focus({ preventScroll: true });
  }, [activeId]);

  const centreOf = (index: number) => {
    const list = row.current;
    const card = list?.children[index] as HTMLElement | undefined;
    if (!list || !card) return null;
    return card.offsetLeft + card.offsetWidth / 2 - list.clientWidth / 2;
  };
  const nearestCard = () => {
    const list = row.current;
    if (!list) return active;
    let nearest = active;
    let best = Infinity;
    Array.from(list.children).forEach((_, index) => {
      const distance = Math.abs((centreOf(index) ?? 0) - list.scrollLeft);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  };

  // The card that opened starts in the middle, without sliding there.
  const settledOn = useRef(activeId);
  useLayoutEffect(() => {
    const list = row.current;
    const left = centreOf(active);
    if (list && left !== null) list.scrollLeft = left;
    // Only on open; later changes slide (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A point picked elsewhere (a pin) slides its card to the middle; a swipe has already put it there.
  const stopGlide = useRef<() => void>(() => {});
  useEffect(() => {
    if (activeId === settledOn.current) return;
    settledOn.current = activeId;
    const list = row.current;
    const left = centreOf(active);
    if (!list || left === null) return;
    stopGlide.current();
    stopGlide.current = glide(list, 'left', left);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(() => () => stopGlide.current(), []);

  // When the row comes to rest on another card, that point opens (and the camera goes to it).
  const settle = useRef<number | undefined>(undefined);
  const dragging = useRef(false);
  const settleOnNearest = () => {
    const id = hotspots[nearestCard()]?.id;
    if (!id || id === settledOn.current) return;
    settledOn.current = id;
    onOpen(id);
  };
  // Every card in the row is as tall as the open one, so the row reads as one sheet. While it slides, the
  // height blends from one card's own height to the next card's, following the finger.
  const contents = useRef<(HTMLDivElement | null)[]>([]);
  const fitHeights = (animate: boolean) => {
    const list = row.current;
    if (!list) return;
    const cards = Array.from(list.children) as HTMLElement[];
    const area = (list.offsetParent as HTMLElement | null)?.clientHeight;
    const screen = area ?? window.innerHeight;
    const cap = screen * (expanded ? 0.85 : 0.5);
    // Content plus the card's 1px borders, up to the cap; expanded cards are all the full height.
    const own = cards.map((_, index) =>
      expanded
        ? cap
        : Math.min(cap, (contents.current[index]?.offsetHeight ?? cap) + 2),
    );
    const first = centreOf(0) ?? 0;
    const step = (centreOf(1) ?? first + 1) - first || 1;
    const position = Math.max(
      0,
      Math.min(cards.length - 1, (list.scrollLeft - first) / step),
    );
    const from = Math.floor(position);
    const to = Math.min(from + 1, cards.length - 1);
    const height = own[from]! + (own[to]! - own[from]!) * (position - from);
    const motion =
      animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const card of cards) {
      card.style.transition = motion
        ? 'height 300ms ease, opacity 100ms ease-out'
        : 'opacity 100ms ease-out';
      card.style.height = `${height}px`;
    }
  };
  // Before the first paint, and again (animated) when the cards expand or shrink.
  const sized = useRef(false);
  useLayoutEffect(() => {
    fitHeights(sized.current);
    sized.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  // Content can change size after it loads (fonts, video), and so can the screen.
  useEffect(() => {
    const observer = new ResizeObserver(() => fitHeights(false));
    contents.current.forEach((content) => content && observer.observe(content));
    const list = row.current;
    if (list?.offsetParent) observer.observe(list.offsetParent);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, hotspots]);

  const onScroll = () => {
    fitHeights(false);
    setLive(nearestCard());
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (!dragging.current) settleOnNearest();
    }, 150);
  };
  useEffect(() => () => window.clearTimeout(settle.current), []);

  // A mouse can't swipe: let it drag the row.
  const drag = useRef({ x: 0, left: 0, moved: false });
  const suppressClickUntil = useRef(0);
  const onPointerDown = (event: React.PointerEvent<HTMLOListElement>) => {
    const list = row.current;
    if (event.pointerType !== 'mouse' || !list) return;
    dragging.current = true;
    drag.current = { x: event.clientX, left: list.scrollLeft, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLOListElement>) => {
    const list = row.current;
    if (!dragging.current || !list) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 4 && !drag.current.moved) {
      drag.current.moved = true;
      list.style.scrollSnapType = 'none';
      list.setPointerCapture(event.pointerId);
    }
    if (drag.current.moved) list.scrollLeft = drag.current.left - dx;
  };
  const endDrag = (event: React.PointerEvent) => {
    const list = row.current;
    if (!dragging.current || !list) return;
    dragging.current = false;
    if (!drag.current.moved) return;
    // The click that ends a drag isn't a tap on whatever is under the mouse.
    suppressClickUntil.current = event.timeStamp + 300;
    list.style.scrollSnapType = '';
    const index = nearestCard();
    const left = centreOf(index);
    if (left !== null) {
      stopGlide.current();
      stopGlide.current = glide(list, 'left', left);
    }
    settleOnNearest();
  };

  const expandButton = (
    <button
      type="button"
      aria-label={expanded ? t('scene.collapsePanel') : t('scene.expandPanel')}
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
      className={roundButton}
    >
      {expanded ? <Collapse /> : <Expand />}
    </button>
  );

  return (
    <ol
      ref={row}
      aria-label={t('scene.hotspots')}
      onScroll={onScroll}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      // The row spans the screen but only its cards take taps, so the scene above stays usable.
      className="pointer-events-none absolute inset-x-0 bottom-0 no-scrollbar flex snap-x snap-mandatory items-end gap-2 overflow-x-auto px-7 pb-[max(0.5rem,env(safe-area-inset-bottom))] mouse:cursor-grab"
    >
      {hotspots.map((hotspot, index) => {
        const isActive = index === active;
        return (
          <li
            key={hotspot.id}
            aria-current={isActive ? 'true' : undefined}
            aria-hidden={isActive ? undefined : true}
            onClickCapture={(event) => {
              const dragged = event.timeStamp < suppressClickUntil.current;
              // A tap on a card at the side brings it in instead of pressing what's on it.
              if (dragged || !isActive) {
                event.stopPropagation();
                event.preventDefault();
              }
              if (!dragged && !isActive) onOpen(hotspot.id);
            }}
            className={`pointer-events-auto w-full shrink-0 snap-center overflow-y-auto rounded-card ${cardLook} ${index === lit ? '' : 'opacity-55'}`}
          >
            <div
              ref={(element) => {
                contents.current[index] = element;
              }}
            >
              <CardContent
                hotspot={hotspot}
                number={index + 1}
                total={hotspots.length}
                tint={tint}
                headingRef={(element: HTMLHeadingElement | null) => {
                  if (element) headingRefs.current.set(hotspot.id, element);
                  else headingRefs.current.delete(hotspot.id);
                }}
                playable={isActive}
                expandButton={expandButton}
                onClose={onClose}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
