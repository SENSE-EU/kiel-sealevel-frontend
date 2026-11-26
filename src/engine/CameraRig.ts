import {
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
} from 'three';

// How far the camera can circle its pivot sideways, and rise above or dip below the view it was given.
const ORBIT_YAW_LIMIT = MathUtils.degToRad(50);
const ORBIT_RISE_LIMIT = MathUtils.degToRad(30);
const ORBIT_DIP_LIMIT = MathUtils.degToRad(8);
// Never so high it looks straight down (the orbit would flip), never so low it goes under the pivot's level.
const MAX_ELEVATION = MathUtils.degToRad(80);
const MIN_ELEVATION = MathUtils.degToRad(-2);
// Zoom, as a share of the distance to the pivot the view was given.
export const ZOOM_IN_LIMIT = 0.55;
export const ZOOM_OUT_LIMIT = 1.4;
/** Where the camera circles when a view doesn't say: this far straight ahead. */
export const DEFAULT_PIVOT_DISTANCE = 6;
const UP = new Vector3(0, 1, 0);
const DRAG_SENSITIVITY = 0.003;
const KEY_STEP = MathUtils.degToRad(6);
const KEY_ZOOM = 0.85;
const WHEEL_ZOOM = 0.0015;
// A trackpad pinch arrives as a wheel event with ctrl held, in much smaller steps.
const PINCH_WHEEL_ZOOM = 0.01;
const MOVE_SMOOTHING = 2.2;
const ORBIT_SMOOTHING = 10;

export interface CameraPose {
  position: Vector3;
  orientation: Quaternion;
  /** The point dragging circles and zooming approaches, such as a hotspot or what a viewpoint looks at. */
  pivot?: Vector3;
}

/** The orientation of a camera at `eye` looking at `target`. */
export function lookAtOrientation(eye: Vector3, target: Vector3): Quaternion {
  const matrix = new Matrix4().lookAt(eye, target, new Vector3(0, 1, 0));
  return new Quaternion().setFromRotationMatrix(matrix);
}

/**
 * Eases the camera between fixed poses. On top, dragging circles the pose's pivot (which stays where it is
 * on screen) and the wheel or a pinch moves closer to it or further away, all within limits. There is no
 * free movement beyond that.
 */
export class CameraRig {
  private readonly goal: CameraPose = {
    position: new Vector3(),
    orientation: new Quaternion(),
  };
  private readonly position = new Vector3();
  private readonly base = new Quaternion();
  private readonly pivot = new Vector3();
  private readonly orbit = { yaw: 0, pitch: 0, zoom: 1 };
  private readonly orbitGoal = { yaw: 0, pitch: 0, zoom: 1 };
  private readonly pitchLimits = {
    rise: ORBIT_RISE_LIMIT,
    dip: ORBIT_DIP_LIMIT,
  };
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
    if (pose.pivot) this.pivot.copy(pose.pivot);
    else
      this.pivot
        .set(0, 0, -DEFAULT_PIVOT_DISTANCE)
        .applyQuaternion(pose.orientation)
        .add(pose.position);

    // How far it can rise or dip from this view before it would look straight down or go under the pivot.
    this.offset.copy(pose.position).sub(this.pivot);
    const elevation = Math.asin(
      MathUtils.clamp(this.offset.y / (this.offset.length() || 1), -1, 1),
    );
    this.pitchLimits.rise = MathUtils.clamp(
      MAX_ELEVATION - elevation,
      0,
      ORBIT_RISE_LIMIT,
    );
    this.pitchLimits.dip = MathUtils.clamp(
      elevation - MIN_ELEVATION,
      0,
      ORBIT_DIP_LIMIT,
    );

    // Set off from wherever dragging and zooming had taken the camera, so nothing jumps.
    this.position.copy(this.camera.position);
    this.base.copy(this.camera.quaternion);
    Object.assign(this.orbit, { yaw: 0, pitch: 0, zoom: 1 });
    Object.assign(this.orbitGoal, { yaw: 0, pitch: 0, zoom: 1 });
    if (instant || this.reducedMotion) {
      this.position.copy(pose.position);
      this.base.copy(pose.orientation);
    }
  }

  update(deltaSeconds: number) {
    const move = 1 - Math.exp(-MOVE_SMOOTHING * deltaSeconds);
    this.position.lerp(this.goal.position, move);
    this.base.slerp(this.goal.orientation, move);

    const ease = 1 - Math.exp(-ORBIT_SMOOTHING * deltaSeconds);
    this.orbit.yaw = MathUtils.lerp(this.orbit.yaw, this.orbitGoal.yaw, ease);
    this.orbit.pitch = MathUtils.lerp(
      this.orbit.pitch,
      this.orbitGoal.pitch,
      ease,
    );
    this.orbit.zoom = MathUtils.lerp(
      this.orbit.zoom,
      this.orbitGoal.zoom,
      ease,
    );

    // Turn the whole camera, position and aim together, about the pivot: sideways around the vertical, up
    // and down around the camera's own right-hand axis. Zoom then slides it along the line to the pivot.
    this.right.set(1, 0, 0).applyQuaternion(this.base).setY(0);
    if (this.right.lengthSq() < 1e-6) this.right.set(1, 0, 0);
    this.right.normalize();
    this.orbitRotation.setFromAxisAngle(UP, this.orbit.yaw);
    this.turn.setFromAxisAngle(this.right, this.orbit.pitch);
    this.orbitRotation.multiply(this.turn);
    this.offset
      .copy(this.position)
      .sub(this.pivot)
      .applyQuaternion(this.orbitRotation)
      .multiplyScalar(this.orbit.zoom);
    this.camera.position.copy(this.pivot).add(this.offset);
    this.camera.quaternion.copy(this.base).premultiply(this.orbitRotation);
  }

  dispose() {
    this.removeListeners();
  }

  /** Positive yaw and pitch move the scene right and down, following a finger. */
  private nudge(yaw: number, pitch: number) {
    // Like turning the scene by hand: drag right and the camera circles to the left; drag down and it rises
    // to look down on the pivot.
    this.orbitGoal.yaw = MathUtils.clamp(
      this.orbitGoal.yaw - yaw,
      -ORBIT_YAW_LIMIT,
      ORBIT_YAW_LIMIT,
    );
    this.orbitGoal.pitch = MathUtils.clamp(
      this.orbitGoal.pitch - pitch,
      -this.pitchLimits.rise,
      this.pitchLimits.dip,
    );
  }

  /** Below 1 moves closer to the pivot, above 1 further away. */
  private zoomBy(factor: number) {
    this.orbitGoal.zoom = MathUtils.clamp(
      this.orbitGoal.zoom * factor,
      ZOOM_IN_LIMIT,
      ZOOM_OUT_LIMIT,
    );
  }

  private listen(input: HTMLElement) {
    // Every finger (or the mouse) that is down. One drags; two pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    let lastSpread = 0;

    const onDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      input.setPointerCapture(event.pointerId);
      lastSpread = spread();
    };
    const onMove = (event: PointerEvent) => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      const point = { x: event.clientX, y: event.clientY };
      if (pointers.size === 1) {
        // The scene follows the finger, so the camera turns the opposite way.
        this.nudge(
          (point.x - last.x) * DRAG_SENSITIVITY,
          (point.y - last.y) * DRAG_SENSITIVITY,
        );
      }
      pointers.set(event.pointerId, point);
      if (pointers.size === 2) {
        const now = spread();
        // Fingers apart: closer.
        if (lastSpread > 0 && now > 0) this.zoomBy(lastSpread / now);
        lastSpread = now;
      }
    };
    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      lastSpread = spread();
    };
    const onWheel = (event: WheelEvent) => {
      // Stops the page zooming on a trackpad pinch, too.
      event.preventDefault();
      const lines =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const delta = MathUtils.clamp(event.deltaY * lines, -200, 200);
      this.zoomBy(
        Math.exp(delta * (event.ctrlKey ? PINCH_WHEEL_ZOOM : WHEEL_ZOOM)),
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.zoomBy(KEY_ZOOM);
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        this.zoomBy(1 / KEY_ZOOM);
        return;
      }
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
    input.addEventListener('wheel', onWheel, { passive: false });
    input.addEventListener('keydown', onKey);
    return () => {
      input.removeEventListener('pointerdown', onDown);
      input.removeEventListener('pointermove', onMove);
      input.removeEventListener('pointerup', onUp);
      input.removeEventListener('pointercancel', onUp);
      input.removeEventListener('wheel', onWheel);
      input.removeEventListener('keydown', onKey);
    };
  }
}
