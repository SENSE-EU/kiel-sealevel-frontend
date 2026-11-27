import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  CameraRig,
  DEFAULT_PIVOT_DISTANCE,
  lookAtOrientation,
  ZOOM_IN_LIMIT,
  ZOOM_OUT_LIMIT,
} from './CameraRig';

function setup() {
  const input = Object.assign(new EventTarget(), { setPointerCapture() {} });
  const camera = new PerspectiveCamera();
  const rig = new CameraRig(camera, input as unknown as HTMLElement, false);
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

const aimsAt = (camera: PerspectiveCamera, point: Vector3) => {
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const toPoint = point.clone().sub(camera.position).normalize();
  return MathUtils.radToDeg(forward.angleTo(toPoint));
};

const degreesFromForward = (camera: PerspectiveCamera) =>
  MathUtils.radToDeg(camera.quaternion.angleTo(new Quaternion()));

describe('CameraRig', () => {
  describe('at a viewpoint', () => {
    // The setup pose has no pivot, so the camera circles the point straight ahead of it.
    const ahead = new Vector3(1, 2, 3 - DEFAULT_PIVOT_DISTANCE);

    it('circles the point ahead instead of turning in place', () => {
      const { camera, fire, settle } = setup();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 150, clientY: 0, pointerId: 1 });
      settle();

      expect(camera.position.x).toBeLessThan(0);
      expect(camera.position.distanceTo(ahead)).toBeCloseTo(
        DEFAULT_PIVOT_DISTANCE,
        5,
      );
      expect(aimsAt(camera, ahead)).toBeLessThan(0.01);
    });

    it('clamps a long drag, and the arrow keys, to the orbit limit', () => {
      const { camera, fire, settle } = setup();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 100000, clientY: 0, pointerId: 1 });
      settle();
      expect(degreesFromForward(camera)).toBeCloseTo(50, 1);

      const keys = setup();
      for (let i = 0; i < 20; i++) keys.fire('keydown', { key: 'ArrowLeft' });
      keys.settle();
      expect(degreesFromForward(keys.camera)).toBeCloseTo(50, 1);
    });

    it('never rises so far that it looks straight down', () => {
      const { camera, rig, fire, settle } = setup();
      const pivot = new Vector3(0, 0, 0);
      // 70 degrees above the pivot, looking down at it.
      const position = new Vector3(
        0,
        Math.sin(MathUtils.degToRad(70)) * 4,
        Math.cos(MathUtils.degToRad(70)) * 4,
      );
      rig.moveTo(
        { position, orientation: lookAtOrientation(position, pivot), pivot },
        true,
      );
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 0, clientY: 100000, pointerId: 1 });
      settle();
      const elevation = MathUtils.radToDeg(Math.asin(camera.position.y / 4));
      expect(elevation).toBeCloseTo(80, 1);
    });
  });

  describe('zoom', () => {
    const distanceAhead = (camera: PerspectiveCamera) =>
      camera.position.distanceTo(new Vector3(1, 2, 3 - DEFAULT_PIVOT_DISTANCE));

    it('moves closer with the wheel, and further away, within limits', () => {
      const { camera, fire, settle } = setup();
      let prevented = 0;
      const wheel = (deltaY: number) =>
        fire('wheel', {
          deltaY,
          deltaMode: 0,
          ctrlKey: false,
          preventDefault: () => prevented++,
        });

      for (let i = 0; i < 50; i++) wheel(-100);
      settle();
      expect(distanceAhead(camera)).toBeCloseTo(
        DEFAULT_PIVOT_DISTANCE * ZOOM_IN_LIMIT,
        3,
      );
      expect(prevented).toBe(50);

      for (let i = 0; i < 50; i++) wheel(100);
      settle();
      expect(distanceAhead(camera)).toBeCloseTo(
        DEFAULT_PIVOT_DISTANCE * ZOOM_OUT_LIMIT,
        3,
      );
    });

    it('moves closer when two fingers spread, without turning', () => {
      const { camera, fire, settle } = setup();
      fire('pointerdown', { clientX: 100, clientY: 0, pointerId: 1 });
      fire('pointerdown', { clientX: 200, clientY: 0, pointerId: 2 });
      fire('pointermove', { clientX: 50, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 250, clientY: 0, pointerId: 2 });
      settle();
      expect(distanceAhead(camera)).toBeLessThan(DEFAULT_PIVOT_DISTANCE * 0.6);
      expect(degreesFromForward(camera)).toBeLessThan(0.01);
    });

    it('supports + and -', () => {
      const { camera, fire, settle } = setup();
      fire('keydown', { key: '+' });
      settle();
      expect(distanceAhead(camera)).toBeLessThan(DEFAULT_PIVOT_DISTANCE);
      fire('keydown', { key: '-' });
      fire('keydown', { key: '-' });
      settle();
      expect(distanceAhead(camera)).toBeGreaterThan(DEFAULT_PIVOT_DISTANCE);
    });
  });

  it('sets off for a new pose from where it was dragged and zoomed to, without a jump', () => {
    const { camera, rig, fire, settle } = setup();
    fire('keydown', { key: 'ArrowLeft' });
    fire('keydown', { key: '+' });
    settle();
    const before = camera.position.clone();

    const next = {
      position: new Vector3(10, 2, 3),
      orientation: new Quaternion(),
    };
    rig.moveTo(next, false);
    rig.update(0);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-6);

    settle();
    expect(camera.position.distanceTo(next.position)).toBeLessThan(1e-3);
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

    it('circles the hotspot instead of turning in place', () => {
      const { camera, fire, settle, pivot } = atHotspot();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 150, clientY: 0, pointerId: 1 });
      settle();

      // Dragging right moves the camera to the left of the hotspot, at the same distance, still aimed at it.
      expect(camera.position.x).toBeLessThan(pivot.x - 0.5);
      expect(camera.position.distanceTo(pivot)).toBeCloseTo(3, 5);
      expect(aimsAt(camera, pivot)).toBeLessThan(0.01);
    });

    it('rises to look down on it when dragged down, within limits', () => {
      const { camera, fire, settle, pivot } = atHotspot();
      fire('pointerdown', { clientX: 0, clientY: 0, pointerId: 1 });
      fire('pointermove', { clientX: 0, clientY: 100000, pointerId: 1 });
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
