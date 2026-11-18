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
    ? 'border-signal bg-signal text-abyss'
    : visited
      ? 'border-signal/70 bg-abyss/30 text-signal'
      : 'border-foam/70 bg-white/15 text-foam';

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t('scene.openHotspot', { title: hotspot.title })}
      aria-current={active ? 'true' : undefined}
      title={hotspot.title}
      onClick={onOpen}
      style={{ visibility: 'hidden' }}
      className="group pointer-events-auto absolute top-0 left-0 flex size-14 items-center justify-center md:size-16"
    >
      <span
        aria-hidden
        className={`absolute inset-2 animate-pin-ring rounded-full border border-signal/70 motion-reduce:hidden md:inset-2.5 ${visited && !active ? 'hidden' : ''}`}
      />
      <span
        aria-hidden
        className={`absolute inset-2 animate-pin-ring-late rounded-full border border-signal/70 motion-reduce:hidden md:inset-2.5 ${visited && !active ? 'hidden' : ''}`}
      />
      <span
        className={`relative flex size-10 items-center justify-center rounded-full border text-sm font-semibold tabular-nums backdrop-blur-md transition-[transform,background-color,color] duration-300 ease-out group-hover:scale-110 md:size-11 md:text-[0.9375rem] ${fill}`}
      >
        {String(number).padStart(2, '0')}
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
