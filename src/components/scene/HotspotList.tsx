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
  const counter = {
    visited: hotspots.filter((h) => visited.includes(h.id)).length,
    total: hotspots.length,
  };
  return (
    <details className="group relative text-sm">
      <summary
        aria-label={`${t('scene.hotspots')}: ${t('scene.counterLabel', counter)}`}
        className="cursor-pointer list-none rounded-full border border-foam/20 bg-abyss/50 px-3.5 py-1.5 text-foam/80 tabular-nums backdrop-blur-sm [&::-webkit-details-marker]:hidden"
      >
        {t('scene.counter', counter)}
      </summary>
      <div className="absolute top-full right-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-foam/10 bg-[#14303d]/95 p-2 backdrop-blur-md">
        <p className="px-2 py-1 font-display font-semibold">
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
                onClick={() => onOpen(hotspot.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-foam/10"
              >
                <span className="font-display font-semibold text-signal">
                  {index + 1}
                </span>
                <span className="flex-1">{hotspot.title}</span>
                {visited.includes(hotspot.id) && (
                  <span className="shrink-0 text-xs text-signal">
                    <span aria-hidden>✓ </span>
                    {t('scene.visited')}
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
