import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CameraRig } from './CameraRig';

function setup(onManualInput?: () => void) {
  const input = Object.assign(new EventTarget(), { setPointerCapture() {} });
  const camera = new PerspectiveCamera();
  const rig = new CameraRig(
    camera,
    input as unknown as HTMLElement,
    false,
    onManualInput,
  );
  const pose = {
    position: new Vector3(1, 2, 3),
    orientation: new Quaternion(),
  };
  rig.moveTo(pose, true);
  const fire = (type: string, props: object) =>
    input.dispatchEvent(Object.assign(new Event(type), props));
  const settle = () => {
    for (let i = 0; i < 300; i++) rig.update(1 / 30);
  };
  return { camera, rig, pose, fire, settle };
}

const degreesFromForward = (camera: PerspectiveCamera) =>
  MathUtils.radToDeg(camera.quaternion.angleTo(new Quaternion()));

describe('CameraRig', () => {
  it('hands off scripted framing on drag, wheel, or an arrow key', () => {
    const takeOver = vi.fn();
    const { fire } = setup(takeOver);
    fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
    expect(takeOver).not.toHaveBeenCalled();
    fire('pointermove', { clientX: 30, clientY: 0 });
    fire('wheel', {});
    fire('keydown', { key: 'ArrowLeft' });
    expect(takeOver).toHaveBeenCalledTimes(3);
  });

  it('clamps a long drag to the look-around limit and never moves the camera', () => {
    const { camera, fire, settle, pose } = setup();
    fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
    fire('pointermove', { clientX: 100000, clientY: 0 });
    settle();

    expect(degreesFromForward(camera)).toBeCloseTo(24, 1);
    expect(camera.position.distanceTo(pose.position)).toBeLessThan(1e-6);
  });

  it('supports the arrow keys, also clamped', () => {
    const { camera, fire, settle } = setup();
    for (let i = 0; i < 20; i++) {
      fire('keydown', { key: 'ArrowLeft' });
    }
    settle();
    expect(degreesFromForward(camera)).toBeCloseTo(24, 1);
  });

  it('resets the look-around on arriving at a new pose', () => {
    const { camera, rig, fire, settle, pose } = setup();
    fire('keydown', { key: 'ArrowLeft' });
    settle();
    expect(degreesFromForward(camera)).toBeGreaterThan(1);

    rig.moveTo(pose, false);
    settle();
    expect(degreesFromForward(camera)).toBeLessThan(0.01);
  });

  describe('at a hotspot', () => {
    function atHotspot() {
      const env = setup();
      const pivot = new Vector3(1, 2, 0);
      // Three units in front of the pivot, looking at it.
      env.rig.moveTo(
        {
          position: new Vector3(1, 2, 3),
          orientation: new Quaternion(),
          pivot,
        },
        true,
      );
      env.settle();
      return { ...env, pivot };
    }
    const aimsAt = (camera: PerspectiveCamera, point: Vector3) => {
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const toPoint = point.clone().sub(camera.position).normalize();
      return MathUtils.radToDeg(forward.angleTo(toPoint));
    };

    it('circles the hotspot instead of turning in place', () => {
      const { camera, fire, settle, pivot } = atHotspot();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 150, clientY: 0 });
      settle();

      // Dragging right moves the camera to the left of the hotspot, at the same distance, still aimed at it.
      expect(camera.position.x).toBeLessThan(pivot.x - 0.5);
      expect(camera.position.distanceTo(pivot)).toBeCloseTo(3, 5);
      expect(aimsAt(camera, pivot)).toBeLessThan(0.01);
    });

    it('rises to look down on it when dragged down, within limits', () => {
      const { camera, fire, settle, pivot } = atHotspot();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 0, clientY: 100000 });
      settle();

      expect(camera.position.y).toBeGreaterThan(pivot.y);
      const rise = MathUtils.radToDeg(
        Math.asin((camera.position.y - pivot.y) / 3),
      );
      expect(rise).toBeCloseTo(30, 1);
      expect(aimsAt(camera, pivot)).toBeLessThan(0.01);
    });

    it('goes back to its view on leaving the hotspot', () => {
      const { camera, rig, fire, settle, pose } = atHotspot();
      fire('keydown', { key: 'ArrowLeft' });
      settle();
      rig.moveTo(pose, false);
      settle();
      expect(camera.position.distanceTo(pose.position)).toBeLessThan(1e-3);
      expect(degreesFromForward(camera)).toBeLessThan(0.01);
    });
  });
});
