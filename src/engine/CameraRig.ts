import {
  Euler,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
} from 'three';

const LOOK_AROUND_LIMIT = MathUtils.degToRad(24);
// Around a hotspot: how far the camera can circle it sideways, and rise above or dip below its view.
const ORBIT_YAW_LIMIT = MathUtils.degToRad(50);
const ORBIT_RISE_LIMIT = MathUtils.degToRad(30);
const ORBIT_DIP_LIMIT = MathUtils.degToRad(8);
const UP = new Vector3(0, 1, 0);
const DRAG_SENSITIVITY = 0.003;
const KEY_STEP = MathUtils.degToRad(6);
const MOVE_SMOOTHING = 2.2;
const LOOK_SMOOTHING = 10;

export interface CameraPose {
  position: Vector3;
  orientation: Quaternion;
  /** A point to circle when dragging, such as a hotspot. Without one, dragging looks around instead. */
  pivot?: Vector3;
}

/** The orientation of a camera at `eye` looking at `target`. */
export function lookAtOrientation(eye: Vector3, target: Vector3): Quaternion {
  const matrix = new Matrix4().lookAt(eye, target, new Vector3(0, 1, 0));
  return new Quaternion().setFromRotationMatrix(matrix);
}

/**
 * Eases the camera between fixed poses and adds a clamped drag on top: at a viewpoint the camera looks
 * around where it stands; at a hotspot it circles the hotspot, which stays where it is on screen. There is
 * no free movement beyond that.
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
  private pivot: Vector3 | null = null;
  private readonly orbit = { yaw: 0, pitch: 0 };
  private readonly orbitGoal = { yaw: 0, pitch: 0 };
  private readonly orbitRotation = new Quaternion();
  private readonly turn = new Quaternion();
  private readonly right = new Vector3();
  private readonly offset = new Vector3();
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
    this.orbitGoal.yaw = 0;
    this.orbitGoal.pitch = 0;
    this.pivot = pose.pivot?.clone() ?? null;
    if (instant || this.reducedMotion) {
      this.position.copy(pose.position);
      this.base.copy(pose.orientation);
      this.look.set(0, 0, 0);
      this.orbit.yaw = 0;
      this.orbit.pitch = 0;
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

    this.orbit.yaw = MathUtils.lerp(this.orbit.yaw, this.orbitGoal.yaw, look);
    this.orbit.pitch = MathUtils.lerp(
      this.orbit.pitch,
      this.orbitGoal.pitch,
      look,
    );
    if (this.pivot) {
      // Turn the whole camera, position and aim together, about the pivot: sideways around the vertical,
      // up and down around the camera's own right-hand axis.
      this.right.set(1, 0, 0).applyQuaternion(this.base).setY(0);
      if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0);
      this.right.normalize();
      this.orbitRotation.setFromAxisAngle(UP, this.orbit.yaw);
      this.turn.setFromAxisAngle(this.right, this.orbit.pitch);
      this.orbitRotation.multiply(this.turn);
      this.offset
        .copy(this.camera.position)
        .sub(this.pivot)
        .applyQuaternion(this.orbitRotation);
      this.camera.position.copy(this.pivot).add(this.offset);
      this.camera.quaternion.premultiply(this.orbitRotation);
    }
  }

  dispose() {
    this.removeListeners();
  }

  /** Positive yaw and pitch move the scene right and down, following a finger. */
  private nudge(yaw: number, pitch: number) {
    if (this.pivot) {
      // Like turning the object by hand: drag right and the camera circles to the left of it; drag down
      // and the camera rises to look down on it.
      this.orbitGoal.yaw = MathUtils.clamp(
        this.orbitGoal.yaw - yaw,
        -ORBIT_YAW_LIMIT,
        ORBIT_YAW_LIMIT,
      );
      this.orbitGoal.pitch = MathUtils.clamp(
        this.orbitGoal.pitch - pitch,
        -ORBIT_RISE_LIMIT,
        ORBIT_DIP_LIMIT,
      );
      return;
    }
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
