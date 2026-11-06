import { useCallback, useEffect, useState } from 'react';

export type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; retry: () => void };

type Settled<T> = { load: unknown; attempt: number } & (
  { ok: true; data: T } | { ok: false }
);

/**
 * Runs `load` (which must be stable, via useCallback) and re-runs it when it changes. Previous data
 * stays visible during a reload, so switching language doesn't tear down the 3D scene.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
): Resource<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setSettled({ load, attempt, ok: true, data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[content] load failed', error);
        setSettled({ load, attempt, ok: false });
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  if (!settled) return { status: 'loading' };
  if (settled.ok) return { status: 'ready', data: settled.data };
  const isCurrent = settled.load === load && settled.attempt === attempt;
  return isCurrent ? { status: 'error', retry } : { status: 'loading' };
}
