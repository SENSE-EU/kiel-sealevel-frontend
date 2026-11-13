import { useEffect, useRef, useState } from 'react';
import { SceneEngine, type ModelSource } from './SceneEngine';

type Loaded =
  | { key: string; engine: SceneEngine; anchors: ReadonlySet<string> }
  | { key: string; unsupported: true };

export type EngineState =
  | { status: 'loading'; progress: number }
  | { status: 'ready'; engine: SceneEngine; anchors: ReadonlySet<string> }
  | { status: 'unsupported' };

/** Creates the engine and (re)loads the model when its URL changes, not when texts change. */
export function useSceneEngine(
  slug: string,
  modelUrl: string | null,
  sizeBytes: number | undefined,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [progress, setProgress] = useState(0);
  const key = modelUrl ?? 'fallback';

  useEffect(() => {
    let active = true;
    let engine: SceneEngine | null = null;

    async function start() {
      try {
        engine = new SceneEngine(containerRef.current!, slug);
        const source: ModelSource | null = modelUrl
          ? { url: modelUrl, ...(sizeBytes !== undefined && { sizeBytes }) }
          : null;
        const anchors = await engine.load(source, (fraction) => {
          if (active) setProgress(Math.round(fraction * 100));
        });
        if (active) setLoaded({ key, engine, anchors });
      } catch (error) {
        console.error('[scene] WebGL is unavailable', error);
        if (active) setLoaded({ key, unsupported: true });
      }
    }
    void start();

    return () => {
      active = false;
      engine?.dispose();
      setProgress(0);
    };
  }, [slug, key, modelUrl, sizeBytes]);

  let state: EngineState = { status: 'loading', progress };
  if (loaded?.key === key) {
    state =
      'unsupported' in loaded
        ? { status: 'unsupported' }
        : { status: 'ready', engine: loaded.engine, anchors: loaded.anchors };
  }
  return { containerRef, state };
}
