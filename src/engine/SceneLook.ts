/**
 * Everything around a scene's models: water, light, particles. The built-in scenes use the procedural
 * environment; scenes from the 3D team bring their own (see underwater/).
 */
export interface SceneLook {
  /** Called every frame, before rendering. */
  update(seconds: number, deltaSeconds: number): void;
  dispose(): void;
  /** Scales the camera's idle drift, for scenes built at close range. Default 1. */
  swayScale?: number;
  /** Pins further than this from the camera (m) are hidden, so another site's pins don't show through fog. */
  pinRange?: number;
  /** The framing the scene was composed for. */
  camera?: {
    near: number;
    far: number;
    /** Kept on landscape screens, up to `maxVerticalFov`. */
    horizontalFov: number;
    maxVerticalFov: number;
  };
  maxPixelRatio?: number;
}
