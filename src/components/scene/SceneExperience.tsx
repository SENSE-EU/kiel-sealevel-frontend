import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { filterByAnchors } from '@/content/anchors';
import type { Scene } from '@/content/types';
import type { Insets } from '@/engine/SceneEngine';
import { themeForSlug } from '@/engine/themes';
import { useSceneEngine } from '@/engine/useSceneEngine';
import type { Locale } from '@/i18n/locales';
import { useVisitedHotspots } from '@/state/visited';
import { HotspotCarousel, HotspotPanel } from './HotspotPanel';
import { type LayoutProps, useWide } from './layout/shared';
import { SceneLayout } from './layout/SceneLayout';
import { PinLayer } from './PinLayer';

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
  const [focusedHotspotId, setFocusedHotspotId] = useState<string | null>(null);
  const [insets, setInsets] = useState<Insets>({
    bottom: 0,
    left: 0,
    right: 0,
  });

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
  // The camera goes to the open hotspot, or else to the one the layout points at (the card in the middle
  // of the strip, the point picked in the list). With nothing picked it goes back to the viewpoint.
  const focusedHotspot = hotspots.find((h) => h.id === focusedHotspotId);
  const hotspotAnchor = (activeHotspot ?? focusedHotspot)?.anchor ?? null;
  const panelOpen = activeHotspot !== null;
  useEffect(() => {
    if (engine && viewpointAnchor)
      engine.setView(viewpointAnchor, hotspotAnchor, panelOpen);
  }, [engine, viewpointAnchor, hotspotAnchor, panelOpen]);

  useEffect(() => engine?.setInsets(insets), [engine, insets]);
  useEffect(() => engine?.setLocale(locale), [engine, locale]);

  // The viewpoint a hotspot is seen from: the start viewpoint when the hotspot can be seen from there, or
  // else the one nearest to it (the 3D artist's sites are further apart than the fog reaches). Null means
  // the start viewpoint.
  const startAnchor = (
    viewpoints.find((v) => v.id === scene.startViewpointId) ?? viewpoints[0]
  )?.anchor;
  const viewpointFor = useCallback(
    (id: string | null) => {
      const hotspot = hotspots.find((h) => h.id === id);
      if (!hotspot || !engine || !startAnchor) return null;
      if (engine.visibleFrom(startAnchor, hotspot.anchor)) return null;
      const nearest = engine.nearestViewpoint(
        hotspot.anchor,
        viewpoints.map((v) => v.anchor),
      );
      return viewpoints.find((v) => v.anchor === nearest)?.id ?? null;
    },
    [engine, hotspots, viewpoints, startAnchor],
  );
  // Opening a hotspot also moves to its viewpoint, so closing it stays at that site.
  const openHotspot = useCallback(
    (id: string) => {
      setActiveHotspotId(id);
      setSelectedViewpointId(viewpointFor(id));
      markVisited(id);
    },
    [markVisited, viewpointFor],
  );
  // Points the camera at a hotspot without opening it. Pointing at nothing goes back to the start viewpoint.
  const focusHotspot = useCallback(
    (id: string | null) => {
      setFocusedHotspotId(id);
      setSelectedViewpointId(viewpointFor(id));
    },
    [viewpointFor],
  );
  const closeHotspot = useCallback(() => setActiveHotspotId(null), []);

  // On phones the open point is one card in a row of them that slides to the next one.
  const wide = useWide();
  // Sliding to a card also makes it the point the layout is on, so closing the card lands there.
  const slideTo = (id: string) => {
    openHotspot(id);
    setFocusedHotspotId(id);
  };
  const tint = themeForSlug(scene.slug).tint;
  const layoutProps: LayoutProps = {
    scene,
    locale,
    hotspots,
    visited,
    activeHotspotId,
    onOpenHotspot: openHotspot,
    focusedHotspotId,
    onFocusHotspot: focusHotspot,
    onInsets: setInsets,
  };

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
        className="absolute inset-0 touch-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
      />

      {engine && (
        <PinLayer
          engine={engine}
          hotspots={hotspots}
          visited={visited}
          activeHotspotId={activeHotspotId ?? focusedHotspotId}
          onHotspot={openHotspot}
        />
      )}

      <SceneLayout {...layoutProps} />

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
          className="absolute inset-x-4 top-32 mx-auto max-w-md rounded-card panel p-4 text-center text-sm leading-relaxed text-mist"
        >
          {t('status.noWebgl')}
        </p>
      )}

      {activeHotspot &&
        (!wide ? (
          <HotspotCarousel
            hotspots={hotspots}
            activeId={activeHotspot.id}
            tint={tint}
            onOpen={slideTo}
            onClose={closeHotspot}
          />
        ) : (
          <HotspotPanel
            key={activeHotspot.id}
            hotspot={activeHotspot}
            number={activeHotspotIndex + 1}
            total={hotspots.length}
            tint={tint}
            onClose={closeHotspot}
          />
        ))}
    </div>
  );
}
