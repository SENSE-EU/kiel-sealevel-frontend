import {
  MathUtils,
  Vector3,
  type CatmullRomCurve3,
  type PerspectiveCamera,
} from 'three';

const LEAD = 4.6;
const FLYOVER = 3.2;
const SETTLE = 2.6;

/** The survey shot follows the AUV past the mine, then gives the camera back at the mine. */
export function createSurveyShot(
  camera: PerspectiveCamera,
  curve: CatmullRomCurve3,
  length: number,
  speed: number,
  mine: Vector3,
  chapterCentre: Vector3,
) {
  const point = new Vector3();
  const heading = new Vector3();
  const side = new Vector3();
  const direction = new Vector3();
  const profile = new Vector3();
  const centre = new Vector3();
  const goal = new Vector3();
  const target = new Vector3();
  const from = new Vector3();
  const fromTarget = new Vector3();
  const arrival = new Vector3();

  let closest = 0;
  let bestDistance = Infinity;
  for (let i = 0; i <= 800; i++) {
    curve.getPointAt(i / 800, point);
    const distance = (point.x - mine.x) ** 2 + (point.z - mine.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = i / 800;
    }
  }
  const wrap = (u: number) => MathUtils.euclideanModulo(u, 1);
  const startU = wrap(closest - LEAD / length);
  const portrait = () => MathUtils.clamp((1 - camera.aspect) / 0.5, 0, 1);
  const fit = (radius: number) => {
    const vertical = MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    return Math.min(
      6.5,
      Math.max(
        radius / Math.sin(vertical),
        (radius * (1 - 0.35 * portrait())) / Math.sin(horizontal),
      ),
    );
  };
  const behind = () =>
    direction
      .copy(heading)
      .multiplyScalar(-0.85)
      .addScaledVector(side, 0.35)
      .add(profile.set(0, 0.45, 0))
      .normalize();

  let running = false;
  let flight = 0;
  let elapsed = 0;
  let hold = 0;
  return {
    start() {
      flight =
        Math.hypot(
          camera.position.x - chapterCentre.x,
          camera.position.z - chapterCentre.z,
        ) > 10
          ? FLYOVER
          : 0;
      elapsed = hold = 0;
      running = true;
      camera
        .getWorldDirection(fromTarget)
        .multiplyScalar(3)
        .add(camera.position);
      from.copy(camera.position);
      target.copy(fromTarget);
      curve.getPointAt(startU, point);
      curve.getTangentAt(startU, heading).setY(0).normalize();
      side.set(-heading.z, 0, heading.x);
      arrival.copy(point).addScaledVector(behind(), fit(1.15));
    },
    /** Updates the camera and returns the synchronized position along the survey path. */
    update(delta: number): number | undefined {
      if (!running) return;
      elapsed += delta;
      const u = wrap(startU + ((elapsed - flight) * speed) / length);
      if (elapsed < flight) {
        const progress = elapsed / flight;
        const k = MathUtils.smoothstep(progress, 0, 1);
        camera.position.lerpVectors(from, arrival, k);
        camera.position.y += Math.sin(Math.PI * k) * 2.5;
        camera.lookAt(
          target.lerpVectors(
            fromTarget,
            mine,
            MathUtils.smoothstep(progress, 0.2, 0.5),
          ),
        );
        return u;
      }

      curve.getPointAt(u, point);
      curve.getTangentAt(u, heading).setY(0).normalize();
      const distance = goal.subVectors(mine, point).dot(heading);
      const progress = MathUtils.smoothstep(1 - distance / LEAD, 0, 1);
      const holding = hold > 0 || distance < -1.3;
      let radius: number;
      if (holding) {
        hold += delta;
        centre.copy(mine).add(profile.set(0, 0.2, 0));
        radius = 1.4;
      } else {
        centre.lerpVectors(
          point,
          goal.addVectors(point, mine).multiplyScalar(0.5),
          progress,
        );
        radius = MathUtils.lerp(1.15, 2.3, progress);
        behind();
        profile.copy(side).multiplyScalar(0.85).addScaledVector(heading, -0.25);
        profile.y = 0.55;
        direction
          .lerp(profile.normalize(), progress * (1 - 0.6 * portrait()))
          .normalize();
      }
      goal.copy(centre).addScaledVector(direction, fit(radius));
      const blend = 1 - Math.exp(-delta * (holding ? 1.6 : 2.2));
      camera.position.lerp(goal, blend);
      target.lerp(centre, blend);
      camera.lookAt(flight > 0 ? mine : target);
      if (hold > SETTLE && camera.position.distanceTo(goal) < 0.05)
        running = false;
      return u;
    },
    cancel() {
      running = false;
    },
  };
}
