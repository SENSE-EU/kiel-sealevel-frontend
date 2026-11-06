import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RichText } from '@/components/RichText';
import type { Hotspot } from '@/content/types';
import { Close, Pause, Play } from './icons';

function formatDuration(seconds: number) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Bottom sheet on phones, floating card on larger screens. */
export function HotspotPanel({
  hotspot,
  number,
  tint,
  onClose,
}: {
  hotspot: Hotspot;
  number: number;
  tint: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  // Move focus in so screen readers announce the panel, and hand it back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const hasMedia = Boolean(hotspot.image || hotspot.video);

  return (
    <aside
      aria-labelledby="hotspot-title"
      className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-foam/15 bg-linear-to-b from-[#0e3147] to-[#0a2536] shadow-2xl md:inset-x-auto md:top-26 md:right-4.5 md:bottom-auto md:max-h-[calc(100dvh-14rem)] md:w-97.5 md:rounded-2xl"
    >
      <div
        className="relative h-37.5 shrink-0"
        style={{ background: `linear-gradient(${tint}, #0c2c3e)` }}
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
        {hasMedia && (
          <span className="absolute bottom-3 left-3.5 rounded-full bg-signal px-3 py-0.5 text-xs font-bold tracking-wider text-abyss uppercase">
            {hotspot.video ? t('scene.mediaVideo') : t('scene.mediaImage')}
          </span>
        )}
        <button
          type="button"
          aria-label={t('scene.closePanel')}
          onClick={onClose}
          className="absolute top-3.5 right-3.5 flex size-8.5 items-center justify-center rounded-full bg-abyss/70 hover:bg-abyss"
        >
          <Close />
        </button>
      </div>

      <div className="px-5.5 pt-5 pb-6">
        <p className="font-display text-sm font-medium tracking-[0.14em] text-signal uppercase">
          {t('scene.hotspotNumber', { number })}
        </p>
        <h2
          ref={headingRef}
          id="hotspot-title"
          tabIndex={-1}
          className="mt-0.5 mb-3 font-display text-2xl font-semibold outline-none"
        >
          {hotspot.title}
        </h2>
        <RichText value={hotspot.body} />
        {hotspot.video && (
          <button
            type="button"
            onClick={togglePlay}
            className="mt-4 flex w-full items-center gap-3 rounded-xl bg-abyss/60 p-2.5 text-left text-sm hover:bg-abyss"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-signal text-abyss">
              {playing ? <Pause /> : <Play />}
            </span>
            {playing ? t('scene.pauseVideo') : t('scene.playVideo')}
            {duration !== null &&
              Number.isFinite(duration) &&
              ` · ${formatDuration(duration)}`}
          </button>
        )}
      </div>
    </aside>
  );
}
