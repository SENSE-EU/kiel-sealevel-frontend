import { describe, expect, it } from 'vitest';
import { FramePacer } from './FramePacer';

describe('FramePacer', () => {
  it.each([60, 90, 120, 144])(
    'renders 30 idle frames per second on a %s Hz display',
    (refreshRate) => {
      const pacer = new FramePacer();
      let rendered = 0;
      for (let frame = 0; frame < refreshRate * 2; frame++) {
        if (pacer.shouldRender((frame * 1000) / refreshRate, 30, false))
          rendered++;
      }
      expect(rendered).toBe(60);
    },
  );

  it('renders movement and explicit view changes immediately', () => {
    const pacer = new FramePacer();
    expect(pacer.shouldRender(0, 30, false)).toBe(true);
    expect(pacer.shouldRender(8, 30, false)).toBe(false);
    expect(pacer.shouldRender(16, 30, true)).toBe(true);
    expect(pacer.shouldRender(24, 30, true)).toBe(true);
    pacer.wake();
    expect(pacer.shouldRender(32, 30, false)).toBe(true);
    expect(pacer.shouldRender(40, undefined, false)).toBe(true);
  });
});
