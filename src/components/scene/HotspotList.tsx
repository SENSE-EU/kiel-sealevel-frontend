import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Hotspot } from '@/content/types';

/**
 * The scope's counter ("2 of 5") and plain list outside the 3D view, in one small control: every hotspot
 * stays reachable by keyboard, with its visited state.
 */
export function HotspotList({
  hotspots,
  visited,
  activeHotspotId,
  onOpen,
}: {
  hotspots: Hotspot[];
  visited: string[];
  activeHotspotId: string | null;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  const details = useRef<HTMLDetailsElement>(null);
  const counter = {
    visited: hotspots.filter((h) => visited.includes(h.id)).length,
    total: hotspots.length,
  };
  return (
    <details ref={details} className="group relative text-sm">
      <summary
        aria-label={`${t('scene.hotspots')}: ${t('scene.counterLabel', counter)}`}
        className="flex h-9 cursor-pointer list-none items-center rounded-full panel px-3.5 label text-mist transition-colors group-open:text-foam hover:text-foam [&::-webkit-details-marker]:hidden"
      >
        {t('scene.counter', counter)}
      </summary>
      <div className="absolute top-full right-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card panel p-1.5">
        <p className="px-2.5 pt-1.5 pb-2 label text-signal">
          {t('scene.hotspots')}
        </p>
        <ol className="max-h-[50dvh] space-y-0.5 overflow-y-auto">
          {hotspots.map((hotspot, index) => (
            <li key={hotspot.id}>
              <button
                type="button"
                aria-current={
                  hotspot.id === activeHotspotId ? 'true' : undefined
                }
                onClick={() => {
                  // Close the list so it doesn't cover what was just picked.
                  if (details.current) details.current.open = false;
                  onOpen(hotspot.id);
                }}
                className="flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-white/8 aria-[current=true]:bg-white/12"
              >
                <span className="label text-signal">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 leading-snug">{hotspot.title}</span>
                {visited.includes(hotspot.id) && (
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
          ))}
        </ol>
      </div>
    </details>
  );
}
