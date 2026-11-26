import { CatmullRomCurve3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createSurveyShot } from './surveyShot';

function setup(aspect: number, fromMineChapter: boolean) {
  const camera = new PerspectiveCamera(61.9, aspect);
  const mine = new Vector3(-0.98, 0.7, -20.9);
  const centre = new Vector3(0, 0, -20);
  camera.position.set(0, 1, fromMineChapter ? -23 : 3);
  camera.lookAt(0, 0.5, fromMineChapter ? -20 : 0);
  const curve = new CatmullRomCurve3(
    [
      new Vector3(-5.5, 1.7, -20.6),
      new Vector3(0, 1.7, -20.6),
      new Vector3(5.5, 1.7, -20.6),
      new Vector3(5.5, 1.7, -18.1),
      new Vector3(-5.5, 1.7, -18.1),
    ],
    true,
  );
  return {
    camera,
    mine,
    shot: createSurveyShot(camera, curve, curve.getLength(), 1, mine, centre),
  };
}

describe('S1 survey shot', () => {
  it.each([16 / 9, 9 / 16])(
    'flies between chapters and hands back on the mine at aspect %s',
    (aspect) => {
      const { camera, mine, shot } = setup(aspect, false);
      shot.start();
      for (let i = 0; i < 96; i++) shot.update(1 / 60);
      expect(camera.position.y).toBeGreaterThan(3);
      camera.updateMatrixWorld();
      expect(new Vector3().copy(mine).project(camera).x).toBeCloseTo(0);

      let frames = 96;
      while (frames < 900 && shot.update(1 / 60) !== undefined) frames++;
      expect(frames).toBeLessThan(900);
      expect(camera.position.distanceTo(mine)).toBeLessThan(6.6);
      camera.updateMatrixWorld();
      expect(new Vector3().copy(mine).project(camera).length()).toBeLessThan(1);
    },
  );

  it('can give control back before a same-chapter pass finishes', () => {
    const { camera, shot } = setup(16 / 9, true);
    shot.start();
    expect(shot.update(1 / 60)).toBeDefined();
    const last = camera.position.clone();
    shot.cancel();
    expect(shot.update(1 / 60)).toBeUndefined();
    expect(camera.position).toEqual(last);
  });
});
