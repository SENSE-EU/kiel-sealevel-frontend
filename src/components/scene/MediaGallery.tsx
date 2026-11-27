import { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardMedia } from '@/content/types';
import { ChevronLeft, ChevronRight, Play } from './icons';
import { glide } from './layout/shared';

const arrowButton =
  'absolute top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-abyss/40 text-foam backdrop-blur-md transition-[color,border-color,opacity] hover:border-signal/60 hover:text-signal disabled:pointer-events-none disabled:opacity-0 mouse:flex';

/**
 * The pictures and videos at the top of a card, one at a time. Touch swipes through them; a mouse gets
 * arrows. The card around it owns which one is showing and plays the videos (see CardContent).
 */
export function MediaGallery({
  media,
  tint,
  current,
  onCurrentChange,
  playingIndex,
  registerVideo,
  onVideoEvent,
  onToggleVideo,
  children,
}: {
  media: CardMedia[];
  tint: string;
  current: number;
  onCurrentChange: (index: number) => void;
  playingIndex: number | null;
  registerVideo: (index: number, element: HTMLVideoElement | null) => void;
  onVideoEvent: (index: number, event: 'play' | 'pause' | 'duration') => void;
  onToggleVideo: (index: number) => void;
  /** Buttons laid over the gallery (expand, close). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const strip = useRef<HTMLDivElement>(null);
  const item = media[current] ?? media[0]!;
  const several = media.length > 1;
  const caption = item.kind === 'image' ? item.caption?.trim() : undefined;

  const nearest = () => {
    const element = strip.current;
    if (!element || !element.clientWidth) return 0;
    return Math.round(element.scrollLeft / element.clientWidth);
  };

  // Picked from outside (an arrow, the play button): slide there. A swipe has already put it there.
  // While it slides, the items it passes don't count as picked (that would pause a video just started).
  const stopGlide = useRef<() => void>(() => {});
  const glidingTo = useRef<number | null>(null);
  useEffect(() => {
    const element = strip.current;
    if (!element || nearest() === current) return;
    stopGlide.current();
    glidingTo.current = current;
    stopGlide.current = glide(element, 'left', current * element.clientWidth);
  }, [current]);
  useEffect(() => () => stopGlide.current(), []);

  const onScroll = () => {
    const index = Math.min(media.length - 1, Math.max(0, nearest()));
    if (glidingTo.current !== null) {
      if (index === glidingTo.current) glidingTo.current = null;
      return;
    }
    if (index !== current) onCurrentChange(index);
  };

  return (
    <div
      className="relative h-40 shrink-0 overflow-hidden"
      style={{ background: `linear-gradient(${tint}, #0a0c0d)` }}
    >
      <div
        ref={strip}
        onScroll={onScroll}
        // In the phone row of cards a mouse drag would move the whole row; here the arrows do the work.
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') event.stopPropagation();
        }}
        aria-label={t('scene.media')}
        className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto"
      >
        {media.map((entry, index) => {
          const shown = index === current;
          return (
            <div
              key={`${entry.url}-${index}`}
              aria-hidden={shown ? undefined : true}
              aria-label={
                several
                  ? t('scene.mediaPosition', {
                      number: index + 1,
                      total: media.length,
                    })
                  : undefined
              }
              role={several ? 'group' : undefined}
              className="relative size-full shrink-0 snap-center"
            >
              {entry.kind === 'video' ? (
                <>
                  <video
                    ref={(element) => registerVideo(index, element)}
                    playsInline
                    preload="metadata"
                    src={entry.url}
                    onPlay={() => onVideoEvent(index, 'play')}
                    onPause={() => onVideoEvent(index, 'pause')}
                    onEnded={() => onVideoEvent(index, 'pause')}
                    onLoadedMetadata={() => onVideoEvent(index, 'duration')}
                    onClick={() => onToggleVideo(index)}
                    className="size-full cursor-pointer object-cover"
                  />
                  {playingIndex !== index && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-1/2 flex size-11 -translate-1/2 items-center justify-center rounded-full bg-signal/90 text-abyss"
                    >
                      <Play />
                    </span>
                  )}
                </>
              ) : (
                <img
                  src={entry.url}
                  alt={entry.alt}
                  loading={index === 0 ? undefined : 'lazy'}
                  draggable={false}
                  className="size-full object-cover"
                />
              )}
            </div>
          );
        })}
      </div>

      {several && (
        <>
          <button
            type="button"
            aria-label={t('scene.previousMedia')}
            disabled={current === 0}
            onClick={() => onCurrentChange(current - 1)}
            className={`${arrowButton} left-3`}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label={t('scene.nextMedia')}
            disabled={current === media.length - 1}
            onClick={() => onCurrentChange(current + 1)}
            className={`${arrowButton} right-3`}
          >
            <ChevronRight />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute right-0 bottom-0 left-0">
        <div className="relative h-0">
          {/* Already in the page language; browser translation would freeze the counter as it changes. */}
          <span
            translate="no"
            className="absolute bottom-3 left-3.5 rounded-full border border-line bg-abyss/40 px-2.5 py-0.5 label text-foam backdrop-blur-md"
          >
            {`${item.kind === 'video' ? t('scene.mediaVideo') : t('scene.mediaImage')}${
              several ? ` · ${current + 1}/${media.length}` : ''
            }`}
          </span>
        </div>
        <div className="border-t border-line bg-abyss/40 px-3.5 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <p
              title={caption}
              className="h-4 min-w-0 flex-1 truncate text-xs leading-4 font-medium text-white"
            >
              {caption}
            </p>
            {several && (
              <span aria-hidden className="flex shrink-0 gap-1.5">
                {media.map((entry, index) => (
                  <span
                    key={`${entry.url}-${index}`}
                    className={`size-1.5 rounded-full transition-colors ${index === current ? 'bg-foam' : 'bg-foam/35'}`}
                  />
                ))}
              </span>
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
