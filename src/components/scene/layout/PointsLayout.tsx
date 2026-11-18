import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight } from '../icons';
import {
  glass,
  glide,
  type LayoutProps,
  plainText,
  roundButton,
  SceneHeader,
  useInsets,
} from './shared';

/**
 * B: points first. A swipeable strip of cards, one per point of interest, under the scene. The card in the
 * middle is the one the camera frames, so swiping walks the scene; tapping a card (or its pin) reads it.
 */
export function PointsLayout(props: LayoutProps) {
  const { t } = useTranslation();
  const {
    hotspots,
    visited,
    activeHotspotId,
    focusedHotspotId,
    onFocusHotspot,
    onOpenHotspot,
  } = props;
  const strip = useRef<HTMLOListElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const bottom = useRef<HTMLDivElement>(null);
  useInsets(bottom, props.onInsets, activeHotspotId);

  // Index of the card nearest the middle of the strip; 0 is the overview.
  const nearestCard = () => {
    const list = strip.current;
    if (!list) return 0;
    const middle = list.scrollLeft + list.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(list.children).forEach((child, index) => {
      const card = child as HTMLElement;
      const distance = Math.abs(
        card.offsetLeft + card.offsetWidth / 2 - middle,
      );
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  };
  // Slides a card to the middle of the strip.
  const stopGlide = useRef<() => void>(() => {});
  const scrollToCard = (index: number) => {
    const list = strip.current;
    const card = list?.children[index] as HTMLElement | undefined;
    if (!list || !card) return;
    stopGlide.current();
    stopGlide.current = glide(
      list,
      'left',
      card.offsetLeft + card.offsetWidth / 2 - list.clientWidth / 2,
    );
  };
  useEffect(() => () => stopGlide.current(), []);

  // When the strip comes to rest, the card in the middle is the one the scene points at. The id it set is
  // remembered so the effect below doesn't scroll the strip back while it's still moving.
  const settledOn = useRef<string | null>(null);
  const dragging = useRef(false);
  // The card nearest the middle while the strip moves, so it lights up at once instead of when it settles.
  const [live, setLive] = useState<number | null>(null);
  const onScroll = () => {
    setLive(nearestCard());
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (dragging.current) return;
      const id = hotspots[nearestCard() - 1]?.id ?? null;
      settledOn.current = id;
      onFocusHotspot(id);
    }, 150);
  };
  useEffect(() => () => window.clearTimeout(settle.current), []);

  // Anything else that picks a point (a pin, the arrows, the list) brings its card to the middle.
  const target = activeHotspotId ?? focusedHotspotId;
  useEffect(() => {
    if (target === settledOn.current) return;
    settledOn.current = target;
    scrollToCard(hotspots.findIndex((h) => h.id === target) + 1);
  }, [target, hotspots]);

  // A mouse can't swipe: let it drag the strip, and turn the vertical wheel into sideways scrolling.
  const drag = useRef({ x: 0, left: 0, moved: false });
  const suppressClickUntil = useRef(0);
  const onPointerDown = (event: React.PointerEvent<HTMLOListElement>) => {
    const list = strip.current;
    if (event.pointerType !== 'mouse' || !list) return;
    dragging.current = true;
    drag.current = { x: event.clientX, left: list.scrollLeft, moved: false };
    list.style.scrollSnapType = 'none';
  };
  const onPointerMove = (event: React.PointerEvent<HTMLOListElement>) => {
    const list = strip.current;
    if (!dragging.current || !list) return;
    const dx = event.clientX - drag.current.x;
    if (Math.abs(dx) > 4 && !drag.current.moved) {
      drag.current.moved = true;
      list.setPointerCapture(event.pointerId);
    }
    if (drag.current.moved) list.scrollLeft = drag.current.left - dx;
  };
  const endDrag = (event: React.PointerEvent) => {
    const list = strip.current;
    if (!dragging.current || !list) return;
    dragging.current = false;
    list.style.scrollSnapType = '';
    if (drag.current.moved) {
      // The click that ends a drag lands on whatever card is under the mouse; it isn't a tap.
      suppressClickUntil.current = event.timeStamp + 300;
      const index = nearestCard();
      scrollToCard(index);
      const id = hotspots[index - 1]?.id ?? null;
      settledOn.current = id;
      onFocusHotspot(id);
    }
  };
  const onClickCapture = (event: React.MouseEvent) => {
    if (event.timeStamp < suppressClickUntil.current) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  // One turn of a mouse wheel moves one card; sideways trackpad swipes scroll natively.
  const wheelLock = useRef(0);
  const onWheel = (event: React.WheelEvent<HTMLOListElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const now = event.timeStamp;
    if (now < wheelLock.current) return;
    wheelLock.current = now + 400;
    goTo(current + Math.sign(event.deltaY));
  };

  const seen = hotspots.filter((h) => visited.includes(h.id)).length;
  // -1 is the overview card.
  const current = hotspots.findIndex((h) => h.id === target);
  const goTo = (index: number) =>
    onFocusHotspot(index < 0 ? null : (hotspots[index]?.id ?? null));
  const arrow = `${roundButton} pointer-events-auto`;
  // Wide screens: arrows at the sides of the strip. Phones: in a row below, so the cards either side peek in.
  const sideArrow = `${arrow} absolute top-[calc(50%-0.375rem)] z-10 hidden -translate-y-1/2 md:flex`;
  const slot = 'w-(--card) shrink-0 snap-center';
  const card = `flex h-36 w-full flex-col rounded-card p-3.5 text-left transition-colors duration-100 ${glass}`;

  return (
    <>
      <SceneHeader {...props} />
      <div
        ref={bottom}
        className={`pointer-events-none absolute inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${activeHotspotId ? 'invisible md:visible' : ''}`}
      >
        <button
          type="button"
          aria-label={t('scene.previousPoint')}
          disabled={current < 0}
          onClick={() => goTo(current - 1)}
          className={`${sideArrow} left-2`}
        >
          <ChevronLeft />
        </button>
        <button
          type="button"
          aria-label={t('scene.nextPoint')}
          disabled={current >= hotspots.length - 1}
          onClick={() => goTo(current + 1)}
          className={`${sideArrow} right-2`}
        >
          <ChevronRight />
        </button>
        <ol
          ref={strip}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
          onWheel={onWheel}
          aria-label={t('scene.hotspots')}
          className="pointer-events-auto relative no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto [mask-image:linear-gradient(90deg,transparent,black_1rem,black_calc(100%-1rem),transparent)] px-[calc(50%-var(--card)/2)] py-1 select-none [--card:min(72vw,18rem)] md:mx-14 md:px-[calc(50%-3.5rem-var(--card)/2)] mouse:cursor-grab"
        >
          <li className={slot}>
            <div
              className={`${card} ${target === null ? '' : 'cursor-pointer'}`}
              onClick={() => target !== null && onFocusHotspot(null)}
            >
              <p className="label text-signal">{t('scene.overview')}</p>
              <p className="mt-1.5 display text-2xl leading-tight font-light">
                {t('scene.pointsCount', { count: hotspots.length })}
              </p>
              <p className="mt-auto text-[0.8125rem] leading-snug text-mist">
                {seen > 0
                  ? t('scene.counterLabel', {
                      visited: seen,
                      total: hotspots.length,
                    })
                  : t('scene.arrowsHint')}
              </p>
            </div>
          </li>
          {hotspots.map((hotspot, index) => {
            const done = visited.includes(hotspot.id);
            const focused = hotspot.id === target;
            // Lit: in the middle right now, even mid-swipe.
            const lit = (live ?? current + 1) === index + 1;
            return (
              <li key={hotspot.id} className={slot}>
                <button
                  type="button"
                  // The first tap slides a card to the middle and makes it the active point; tapping the
                  // active card opens it.
                  onClick={() =>
                    focused
                      ? onOpenHotspot(hotspot.id)
                      : onFocusHotspot(hotspot.id)
                  }
                  aria-current={focused ? 'true' : undefined}
                  className={`${card} ${lit ? 'border-signal/50' : ''}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`flex size-6.5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold tabular-nums transition-[background-color,border-color,color] duration-100 ${lit ? 'border-signal bg-signal text-abyss' : done ? 'border-signal/60 text-signal' : 'border-foam/55 bg-white/10 text-foam'}`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 display text-[1.0625rem] leading-[1.2] font-normal">
                      {hotspot.title}
                    </span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-[0.8125rem] leading-snug text-mist">
                    {plainText(hotspot.body)}
                  </span>
                  <span className="mt-auto flex items-center gap-1 label">
                    <span
                      className={`flex items-center gap-1.5 text-signal ${lit ? '' : 'invisible'}`}
                    >
                      <span>{t('scene.read')}</span>
                      <ArrowRight />
                    </span>
                    {done && (
                      <span className="ml-auto flex items-center gap-1.5 text-signal">
                        <span className="size-1.5 rounded-full bg-signal" />
                        <span>{t('scene.visited')}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex items-center justify-center gap-5 md:hidden">
          <button
            type="button"
            aria-label={t('scene.previousPoint')}
            disabled={current < 0}
            onClick={() => goTo(current - 1)}
            className={arrow}
          >
            <ChevronLeft />
          </button>
          <span className="min-w-16 text-center label text-foam">
            {current < 0
              ? t('scene.overview')
              : `${String(current + 1).padStart(2, '0')} / ${String(hotspots.length).padStart(2, '0')}`}
          </span>
          <button
            type="button"
            aria-label={t('scene.nextPoint')}
            disabled={current >= hotspots.length - 1}
            onClick={() => goTo(current + 1)}
            className={arrow}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </>
  );
}
