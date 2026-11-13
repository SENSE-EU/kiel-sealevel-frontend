import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { filterByAnchors } from '@/content/anchors';
import type { Scene } from '@/content/types';
import { themeForSlug } from '@/engine/themes';
import { useSceneEngine } from '@/engine/useSceneEngine';
import type { Locale } from '@/i18n/locales';
import { useVisitedHotspots } from '@/state/visited';
import { ChevronLeft } from './icons';
import { HotspotList } from './HotspotList';
import { HotspotPanel } from './HotspotPanel';
import { PinLayer } from './PinLayer';
import { ViewpointTray } from './ViewpointTray';

export function SceneExperience({
  scene,
  locale,
}: {
  scene: Scene;
  locale: Locale;
}) {
  const { t } = useTranslation();
  const { containerRef, state } = useSceneEngine(
    scene.slug,
    scene.model?.url ?? null,
    scene.model?.sizeBytes,
  );
  const { visited, markVisited } = useVisitedHotspots(scene.slug);
  const [selectedViewpointId, setSelectedViewpointId] = useState<string | null>(
    null,
  );
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

  const engine = state.status === 'ready' ? state.engine : null;
  const anchors = state.status === 'ready' ? state.anchors : null;

  // Without a model to check against (no WebGL) everything stays listed, so the text is still readable.
  const viewpoints = useMemo(
    () =>
      anchors
        ? filterByAnchors(scene.viewpoints, anchors, 'viewpoint')
        : scene.viewpoints,
    [anchors, scene.viewpoints],
  );
  const hotspots = useMemo(
    () =>
      anchors
        ? filterByAnchors(scene.hotspots, anchors, 'hotspot')
        : scene.hotspots,
    [anchors, scene.hotspots],
  );

  const activeViewpoint =
    viewpoints.find((v) => v.id === selectedViewpointId) ??
    viewpoints.find((v) => v.id === scene.startViewpointId) ??
    viewpoints[0] ??
    null;
  const activeHotspotIndex = hotspots.findIndex(
    (h) => h.id === activeHotspotId,
  );
  const activeHotspot = hotspots[activeHotspotIndex] ?? null;

  const viewpointAnchor = activeViewpoint?.anchor;
  const hotspotAnchor = activeHotspot?.anchor ?? null;
  useEffect(() => {
    if (engine && viewpointAnchor)
      engine.setView(viewpointAnchor, hotspotAnchor);
  }, [engine, viewpointAnchor, hotspotAnchor]);

  const openHotspot = useCallback(
    (id: string) => {
      setActiveHotspotId(id);
      markVisited(id);
    },
    [markVisited],
  );
  const goToViewpoint = useCallback((id: string) => {
    setSelectedViewpointId(id);
    setActiveHotspotId(null);
  }, []);
  const closeHotspot = useCallback(() => setActiveHotspotId(null), []);

  return (
    <div
      className="relative h-dvh overflow-hidden"
      style={{ background: themeForSlug(scene.slug).backdrop }}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        role="group"
        aria-label={t('scene.canvasLabel')}
        className="absolute inset-0 touch-none outline-none"
      />

      {engine && (
        <PinLayer
          engine={engine}
          hotspots={hotspots}
          visited={visited}
          activeHotspotId={activeHotspotId}
          onHotspot={openHotspot}
        />
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <Link
            to={`/${locale}`}
            aria-label={t('scene.back')}
            className="pointer-events-auto flex size-11.5 shrink-0 items-center justify-center rounded-full border border-foam/25 bg-abyss/40 backdrop-blur-sm hover:border-signal"
          >
            <ChevronLeft />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-xl leading-tight font-semibold md:text-2xl">
              {scene.title}
            </h1>
            <p className="truncate text-sm text-foam/60">{scene.teaser}</p>
          </div>
        </div>
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
          <LanguageSwitch />
          <HotspotList
            hotspots={hotspots}
            visited={visited}
            activeHotspotId={activeHotspotId}
            onOpen={openHotspot}
          />
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 md:p-5">
        <ViewpointTray
          viewpoints={viewpoints}
          activeId={activeViewpoint?.id ?? null}
          tint={themeForSlug(scene.slug).tint}
          onSelect={goToViewpoint}
        />
      </div>

      {state.status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-abyss">
          <LoadingIndicator
            label={t('status.loadingScene', { progress: state.progress })}
          />
        </div>
      )}
      {state.status === 'unsupported' && (
        <p
          role="status"
          className="absolute inset-x-4 top-32 mx-auto max-w-md rounded-xl bg-deep p-4 text-center"
        >
          {t('status.noWebgl')}
        </p>
      )}

      {activeHotspot && (
        <HotspotPanel
          key={activeHotspot.id}
          hotspot={activeHotspot}
          number={activeHotspotIndex + 1}
          tint={themeForSlug(scene.slug).tint}
          onClose={closeHotspot}
        />
      )}
    </div>
  );
}
