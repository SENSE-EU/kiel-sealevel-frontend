import { useEffect, useRef, useState } from 'react';
import { SceneEngine } from '@/engine/SceneEngine';

/**
 * The live 3D behind the landing page. Always the built-in scenes, so no GLB is downloaded before a
 * visitor has chosen one. Without WebGL the CSS gradient behind it simply stays visible.
 */
export function LandingBackdrop({ slug }: { slug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<SceneEngine | null>(null);

  useEffect(() => {
    let created: SceneEngine | null = null;
    let active = true;
    // Deferred past the effect so the state update comes from a callback, and StrictMode's probe mount
    // doesn't create a WebGL context only to throw it away.
    const start = requestAnimationFrame(() => {
      try {
        created = new SceneEngine(containerRef.current!, 'landing');
        if (active) setEngine(created);
      } catch (error) {
        console.warn('[landing] 3D backdrop unavailable', error);
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(start);
      created?.dispose();
    };
  }, []);

  useEffect(() => {
    engine?.showBackdrop(slug);
  }, [engine, slug]);

  return <div ref={containerRef} aria-hidden className="absolute inset-0" />;
}
