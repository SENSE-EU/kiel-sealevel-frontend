import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Viewpoint } from '@/content/types';
import { ChevronLeft, ChevronRight } from './icons';

export function ViewpointTray({
  viewpoints,
  activeId,
  tint,
  onSelect,
}: {
  viewpoints: Viewpoint[];
  activeId: string | null;
  tint: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLButtonElement>(null);
  const index = viewpoints.findIndex((v) => v.id === activeId);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activeId]);

  if (viewpoints.length < 2) return null;
  const previous = viewpoints[index - 1];
  const next = viewpoints[index + 1];
  const stepClass =
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-foam/25 text-foam enabled:hover:border-signal disabled:opacity-40';

  return (
    <nav
      aria-label={t('scene.viewpoints')}
      className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-2xl border border-foam/10 bg-[#14303d]/85 p-3 backdrop-blur-md"
    >
      <button
        type="button"
        aria-label={t('scene.previousViewpoint')}
        disabled={!previous}
        onClick={() => previous && onSelect(previous.id)}
        className={stepClass}
      >
        <ChevronLeft />
      </button>
      <ul className="flex max-w-98 min-w-0 [scrollbar-width:none] gap-2.5 overflow-x-auto">
        {viewpoints.map((viewpoint, i) => {
          const active = viewpoint.id === activeId;
          return (
            <li key={viewpoint.id} className="shrink-0">
              <button
                ref={active ? activeRef : undefined}
                type="button"
                aria-current={active ? 'location' : undefined}
                onClick={() => onSelect(viewpoint.id)}
                style={{ background: `linear-gradient(${tint}, #041420)` }}
                className={`flex h-14.5 w-24 flex-col justify-end overflow-hidden rounded-[10px] border-2 px-2 py-1 text-left leading-tight ${active ? 'border-signal' : 'border-foam/40 hover:border-foam/70'}`}
              >
                <span className="font-display text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="line-clamp-2 text-[11px] leading-3">
                  {viewpoint.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-label={t('scene.nextViewpoint')}
        disabled={!next}
        onClick={() => next && onSelect(next.id)}
        className={stepClass}
      >
        <ChevronRight />
      </button>
      <span className="shrink-0 px-1 text-sm text-foam/70 tabular-nums">
        {index + 1} / {viewpoints.length}
      </span>
    </nav>
  );
}
