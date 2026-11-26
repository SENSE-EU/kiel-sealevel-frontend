/** Keeps idle rendering on a fixed cadence even when the display refreshes faster. */
export class FramePacer {
  private nextIdleAt: number | null = null;

  wake() {
    this.nextIdleAt = null;
  }

  shouldRender(time: number, idleFps: number | undefined, active: boolean) {
    if (!idleFps) return true;
    const interval = 1000 / idleFps;
    const next = this.nextIdleAt ?? time;
    if (!active && time + 0.25 < next) return false;
    this.nextIdleAt =
      (active ? time : Math.max(next, time - interval / 2)) + interval;
    return true;
  }
}
