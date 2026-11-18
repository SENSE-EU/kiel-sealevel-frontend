import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight } from '../icons';
import {
  glass,
  type LayoutProps,
  roundButton,
  SceneHeader,
  useInsets,
} from './shared';

/**
 * D: a list sheet, like a maps app. On phones it peeks with a numbered button per point; tap or drag it up for
 * the full list. From tablets up the list floats open in the bottom corner, as tall as its content. Tapping a
 * point opens it; on tablets the list steps aside while a point is open.
 */
export function SheetLayout(props: LayoutProps) {
  const { t } = useTranslation();
  const {
    hotspots,
    visited,
    activeHotspotId,
    focusedHotspotId,
    onOpenHotspot,
    onFocusHotspot,
  } = props;
  // The arrows and number buttons pick a point (the camera goes there); tapping the picked one opens it.
  const current = hotspots.findIndex((h) => h.id === focusedHotspotId);
  const pick = (index: number) =>
    onFocusHotspot(index < 0 ? null : (hotspots[index]?.id ?? null));
  const picked = hotspots[current];
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLElement>(null);
  useInsets(sheet, props.onInsets, `${open} ${activeHotspotId}`);

  // Drag the handle: up opens, down closes. A short press is a tap and toggles.
  const start = useRef<number | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    start.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: React.PointerEvent) => {
    if (start.current === null) return;
    const dy = event.clientY - start.current;
    start.current = null;
    if (dy < -24) setOpen(true);
    else if (dy > 24) setOpen(false);
    else setOpen((value) => !value);
  };

  const seen = hotspots.filter((h) => visited.includes(h.id)).length;
  const number = (id: string, done: boolean, size: string) => (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold tabular-nums transition-[background-color,border-color,color] duration-300 ${size} ${done ? 'border-signal/60 text-signal' : 'border-foam/55 bg-white/10 text-foam'}`}
    >
      {String(hotspots.findIndex((h) => h.id === id) + 1).padStart(2, '0')}
    </span>
  );

  return (
    <>
      <SceneHeader {...props} />
      <section
        ref={sheet}
        aria-labelledby="sheet-title"
        className={`absolute inset-x-0 bottom-0 rounded-t-card pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-5 md:left-5 md:flex md:max-h-[calc(100dvh-8.5rem)] md:w-80 md:flex-col md:rounded-card md:pb-1.5 ${glass} ${activeHotspotId ? 'invisible lg:visible' : ''}`}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls="sheet-list"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (start.current = null)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setOpen((value) => !value);
            }
          }}
          className="block w-full shrink-0 touch-none px-4 pt-2 pb-3 text-left md:pointer-events-none md:pt-4"
        >
          <span
            aria-hidden
            className="mx-auto mb-2 block h-1 w-9 rounded-full bg-foam/25 md:hidden"
          />
          <span className="flex items-baseline justify-between gap-3">
            <span id="sheet-title" className="display text-xl font-light">
              {t('scene.pointsCount', { count: hotspots.length })}
            </span>
            <span className="label text-signal">
              {`${t('scene.counter', { visited: seen, total: hotspots.length })} ${t('scene.visited')}`}
            </span>
          </span>
        </button>

        {!open && (
          <div className="px-3 pb-1 md:hidden">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('scene.previousPoint')}
                disabled={current < 0}
                onClick={() => pick(current - 1)}
                className={roundButton}
              >
                <ChevronLeft />
              </button>
              <ul
                aria-label={t('scene.hotspots')}
                className="no-scrollbar flex min-w-0 flex-1 justify-center gap-0.5 overflow-x-auto"
              >
                {hotspots.map((hotspot, index) => (
                  <li key={hotspot.id}>
                    <button
                      type="button"
                      aria-label={hotspot.title}
                      aria-current={index === current ? 'true' : undefined}
                      onClick={() =>
                        index === current
                          ? onOpenHotspot(hotspot.id)
                          : pick(index)
                      }
                      className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-white/8"
                    >
                      {number(
                        hotspot.id,
                        visited.includes(hotspot.id),
                        index === current
                          ? 'size-8 !border-signal !bg-signal !text-abyss'
                          : 'size-8',
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                aria-label={t('scene.nextPoint')}
                disabled={current >= hotspots.length - 1}
                onClick={() => pick(current + 1)}
                className={roundButton}
              >
                <ChevronRight />
              </button>
            </div>
            <button
              type="button"
              disabled={!picked}
              onClick={() => picked && onOpenHotspot(picked.id)}
              className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm transition-colors enabled:hover:bg-white/8"
            >
              {picked ? (
                <>
                  <span className="min-w-0 flex-1 truncate">
                    {picked.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 label text-signal">
                    <span>{t('scene.read')}</span>
                    <ArrowRight />
                  </span>
                </>
              ) : (
                <span className="text-mist">{t('scene.pickHint')}</span>
              )}
            </button>
          </div>
        )}

        <ol
          id="sheet-list"
          className={`no-scrollbar max-h-[45dvh] overflow-y-auto border-t border-line px-1.5 pt-1.5 pb-1 md:block md:max-h-none md:min-h-0 ${open ? '' : 'hidden'}`}
        >
          {hotspots.map((hotspot) => {
            const done = visited.includes(hotspot.id);
            return (
              <li key={hotspot.id}>
                <button
                  type="button"
                  onClick={() => onOpenHotspot(hotspot.id)}
                  aria-current={
                    hotspot.id === activeHotspotId ? 'true' : undefined
                  }
                  className="group flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-white/8 aria-[current=true]:bg-white/12"
                >
                  {number(
                    hotspot.id,
                    done,
                    hotspot.id === activeHotspotId
                      ? 'size-7 !border-signal !bg-signal !text-abyss'
                      : 'size-7',
                  )}
                  <span className="flex-1 text-[0.9375rem] leading-snug tracking-[-0.005em] text-foam/90 group-hover:text-foam">
                    {hotspot.title}
                  </span>
                  {done && (
                    <span className="flex shrink-0 items-center">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-signal"
                      />
                      <span className="sr-only">{t('scene.visited')}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
