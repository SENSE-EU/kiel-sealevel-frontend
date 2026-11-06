import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig } from './CameraRig';

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

const degreesFromForward = (camera: PerspectiveCamera) =>
  MathUtils.radToDeg(camera.quaternion.angleTo(new Quaternion()));

describe('CameraRig', () => {
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
});
