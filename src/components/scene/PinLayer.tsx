import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hotspot } from '@/content/types';
import type { SceneEngine } from '@/engine/SceneEngine';

function HotspotPin({
  engine,
  hotspot,
  number,
  active,
  visited,
  onOpen,
}: {
  engine: SceneEngine;
  hotspot: Hotspot;
  number: number;
  active: boolean;
  visited: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(
    () => engine.registerPin(hotspot.anchor, ref.current!),
    [engine, hotspot.anchor],
  );

  const fill = active
    ? 'bg-signal text-abyss border-signal'
    : visited
      ? 'bg-kelp/70 text-foam border-foam'
      : 'bg-abyss/40 text-foam border-foam';

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t('scene.openHotspot', { title: hotspot.title })}
      aria-current={active ? 'true' : undefined}
      title={hotspot.title}
      onClick={onOpen}
      style={{ visibility: 'hidden' }}
      className="group pointer-events-auto absolute top-0 left-0 flex size-14 items-center justify-center md:size-18"
    >
      <span
        aria-hidden
        className="absolute inset-0 animate-pin-ring rounded-full border-2 border-signal/50 motion-reduce:animate-none"
      />
      <span
        className={`relative flex size-9 items-center justify-center rounded-full border-2 font-display text-base font-semibold transition-transform group-hover:scale-110 md:size-11 md:text-lg ${fill}`}
      >
        {number}
      </span>
    </button>
  );
}

/** Pins are real buttons positioned over the canvas, so they work with touch, keyboard and screen readers. */
export function PinLayer({
  engine,
  hotspots,
  visited,
  activeHotspotId,
  onHotspot,
}: {
  engine: SceneEngine;
  hotspots: Hotspot[];
  visited: string[];
  activeHotspotId: string | null;
  onHotspot: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hotspots.map((hotspot, index) => (
        <HotspotPin
          key={hotspot.id}
          engine={engine}
          hotspot={hotspot}
          number={index + 1}
          active={hotspot.id === activeHotspotId}
          visited={visited.includes(hotspot.id)}
          onOpen={() => onHotspot(hotspot.id)}
        />
      ))}
    </div>
  );
}
