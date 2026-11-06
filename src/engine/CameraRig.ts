import {
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
} from 'three';

const LOOK_AROUND_LIMIT = MathUtils.degToRad(24);
const DRAG_SENSITIVITY = 0.003;
const KEY_STEP = MathUtils.degToRad(6);
const MOVE_SMOOTHING = 2.2;
const LOOK_SMOOTHING = 10;

export interface CameraPose {
  position: Vector3;
  orientation: Quaternion;
}

/** The orientation of a camera at `eye` looking at `target`. */
export function lookAtOrientation(eye: Vector3, target: Vector3): Quaternion {
  const matrix = new Matrix4().lookAt(eye, target, new Vector3(0, 1, 0));
  return new Quaternion().setFromRotationMatrix(matrix);
}

/**
 * Eases the camera between fixed poses and adds a clamped look-around on top. There is no free
 * movement: position only ever comes from `moveTo`.
 */
export class CameraRig {
  private readonly goal: CameraPose = {
    position: new Vector3(),
    orientation: new Quaternion(),
  };
  private readonly position = new Vector3();
  private readonly base = new Quaternion();
  private readonly look = new Euler(0, 0, 0, 'YXZ');
  private readonly lookGoal = { yaw: 0, pitch: 0 };
  private readonly lookOffset = new Quaternion();
  private readonly removeListeners: () => void;

  constructor(
    private readonly camera: PerspectiveCamera,
    input: HTMLElement,
    private readonly reducedMotion: boolean,
  ) {
    this.removeListeners = this.listen(input);
  }

  moveTo(pose: CameraPose, instant: boolean) {
    this.goal.position.copy(pose.position);
    this.goal.orientation.copy(pose.orientation);
    this.lookGoal.yaw = 0;
    this.lookGoal.pitch = 0;
    if (instant || this.reducedMotion) {
      this.position.copy(pose.position);
      this.base.copy(pose.orientation);
      this.look.set(0, 0, 0);
    }
  }

  update(deltaSeconds: number) {
    const move = 1 - Math.exp(-MOVE_SMOOTHING * deltaSeconds);
    this.position.lerp(this.goal.position, move);
    this.camera.position.copy(this.position);
    this.base.slerp(this.goal.orientation, move);

    const look = 1 - Math.exp(-LOOK_SMOOTHING * deltaSeconds);
    this.look.y = MathUtils.lerp(this.look.y, this.lookGoal.yaw, look);
    this.look.x = MathUtils.lerp(this.look.x, this.lookGoal.pitch, look);
    this.lookOffset.setFromEuler(this.look);
    this.camera.quaternion.copy(this.base).multiply(this.lookOffset);
  }

  dispose() {
    this.removeListeners();
  }

  private nudge(yaw: number, pitch: number) {
    const clamp = (v: number) =>
      MathUtils.clamp(v, -LOOK_AROUND_LIMIT, LOOK_AROUND_LIMIT);
    this.lookGoal.yaw = clamp(this.lookGoal.yaw + yaw);
    this.lookGoal.pitch = clamp(this.lookGoal.pitch + pitch);
  }

  private listen(input: HTMLElement) {
    let last: { x: number; y: number } | null = null;

    const onDown = (event: PointerEvent) => {
      last = { x: event.clientX, y: event.clientY };
      input.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!last) return;
      // The scene follows the finger, so the camera turns the opposite way.
      this.nudge(
        (event.clientX - last.x) * DRAG_SENSITIVITY,
        (event.clientY - last.y) * DRAG_SENSITIVITY,
      );
      last = { x: event.clientX, y: event.clientY };
    };
    const onUp = () => {
      last = null;
    };
    const onKey = (event: KeyboardEvent) => {
      const step = {
        ArrowLeft: [KEY_STEP, 0],
        ArrowRight: [-KEY_STEP, 0],
        ArrowUp: [0, KEY_STEP],
        ArrowDown: [0, -KEY_STEP],
      }[event.key];
      if (!step) return;
      event.preventDefault();
      this.nudge(step[0]!, step[1]!);
    };

    input.addEventListener('pointerdown', onDown);
    input.addEventListener('pointermove', onMove);
    input.addEventListener('pointerup', onUp);
    input.addEventListener('pointercancel', onUp);
    input.addEventListener('keydown', onKey);
    return () => {
      input.removeEventListener('pointerdown', onDown);
      input.removeEventListener('pointermove', onMove);
      input.removeEventListener('pointerup', onUp);
      input.removeEventListener('pointercancel', onUp);
      input.removeEventListener('keydown', onKey);
    };
  }
}
