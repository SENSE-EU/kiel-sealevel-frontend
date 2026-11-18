import {
  Box3,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { AnchorHighlight } from './AnchorHighlight';
import { checkBudget } from './budget';
import { CameraRig, lookAtOrientation } from './CameraRig';
import { disposeObject } from './disposeObject';
import { createEnvironment, swayOffset } from './environment';
import { loadModel } from './loadModel';
import { createPlaceholderScene } from './placeholderScene';
import { themeForSlug, type SceneTheme } from './themes';

/** Pixels of page UI covering each edge of the scene. */
export interface Insets {
  bottom: number;
  left: number;
  right: number;
}

export interface ModelSource {
  url: string;
  sizeBytes?: number;
}

const MAX_PIXEL_RATIO = 2;
/** Portrait screens widen the view so the scene's width still fits, within reason. */
const MIN_HORIZONTAL_FOV = MathUtils.degToRad(52);
const BASE_VERTICAL_FOV = 55;
const MAX_VERTICAL_FOV = 88;
const MAX_FRAME_SECONDS = 0.1;
const FOCUS_RADIUS_FACTOR = 2.6;
const FOCUS_APPROACH = 0.6;
/** Keeps a focused anchor clear of the hotspot panel: a side card on wide screens, a bottom sheet on phones. */
const WIDE_SCREEN = 768;
const SIDE_PANEL_SHIFT = 195;
const SHEET_SHIFT_FRACTION = 0.27;
const SHIFT_SMOOTHING = 2.2;
/** Height kept for the header when lifting the scene above bottom UI. */
const HEADER_RESERVE = 96;

/**
 * Owns everything WebGL. React talks to it through `load`, `setView` and `registerPin`; it knows
 * nothing about the CMS or React, only about anchors (node names in the model).
 */
export class SceneEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(55, 1, 0.1, 200);
  private readonly rig: CameraRig;
  private readonly highlight: AnchorHighlight;
  private environment: ReturnType<typeof createEnvironment>;
  private theme: SceneTheme;
  private readonly reducedMotion: boolean;
  private readonly sway = new Vector3();
  private readonly resizeObserver: ResizeObserver;
  private readonly pins = new Map<HTMLElement, Vector3>();
  private readonly projected = new Vector3();
  private model: Object3D | null = null;
  private hasView = false;
  private focusing = false;
  private readonly viewShift = { x: 0, y: 0 };
  private insets: Insets = { bottom: 0, left: 0, right: 0 };
  private disposed = false;
  private lastFrame: number | null = null;

  /** Throws if WebGL isn't available; the UI then falls back to the plain list. */
  constructor(
    private readonly container: HTMLElement,
    slug: string,
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
    );
    this.renderer.domElement.style.display = 'block';
    container.append(this.renderer.domElement);

    this.reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    this.rig = new CameraRig(this.camera, container, this.reducedMotion);
    this.highlight = new AnchorHighlight(this.reducedMotion);
    this.theme = themeForSlug(slug);
    this.environment = createEnvironment(this.scene, this.theme);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  /**
   * Loads the model, or the built-in scene when there is none or it fails, and resolves to the names
   * of every node in it, for checking CMS anchors against.
   */
  async load(
    source: ModelSource | null,
    onProgress: (fraction: number) => void,
  ): Promise<Set<string>> {
    let model: Object3D | null = null;
    if (source) {
      try {
        model = await loadModel(source.url, this.renderer, onProgress);
        checkBudget(model, source.sizeBytes);
      } catch (error) {
        console.error(
          '[scene] Model failed to load, using the fallback scene',
          error,
        );
      }
    }
    model ??= createPlaceholderScene(this.theme);

    if (this.disposed) {
      disposeObject(model);
      return new Set();
    }
    this.model = model;
    this.scene.add(model);
    model.updateWorldMatrix(true, true);

    const names = new Set<string>();
    model.traverse((node) => {
      if (node.name) names.add(node.name);
    });
    return names;
  }

  /** Swaps to another scene's built-in version, without any download. Used behind the landing page. */
  showBackdrop(slug: string) {
    this.environment.dispose();
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    this.theme = themeForSlug(slug);
    this.environment = createEnvironment(this.scene, this.theme);
    this.model = createPlaceholderScene(this.theme);
    this.scene.add(this.model);
    this.model.updateWorldMatrix(true, true);
    this.hasView = false;
    this.setView('vp_1', null);
  }

  /**
   * The camera goes to the hotspot if there is one, otherwise to the viewpoint. `panelOpen` says whether the
   * hotspot panel covers part of the screen, so the hotspot is kept clear of it.
   */
  setView(
    viewpointAnchor: string,
    hotspotAnchor: string | null,
    panelOpen = hotspotAnchor !== null,
  ) {
    const viewpoint = this.anchor(viewpointAnchor);
    if (!viewpoint) return;
    const position = viewpoint.getWorldPosition(new Vector3());
    const orientation = viewpoint.getWorldQuaternion(new Quaternion());

    const hotspot = hotspotAnchor ? this.anchor(hotspotAnchor) : null;
    this.highlight.set(hotspot);
    this.focusing = hotspot !== null && panelOpen;
    const pose = hotspot
      ? this.focusPose(hotspot, position)
      : { position, orientation };

    this.rig.moveTo(pose, !this.hasView);
    this.hasView = true;
  }

  /** Pixels of UI covering each edge of the scene, so it can centre in the space that's left. */
  setInsets(insets: Insets) {
    this.insets = insets;
  }

  /** Whether a hotspot is on screen when the camera stands at a viewpoint. */
  visibleFrom(viewpointAnchor: string, hotspotAnchor: string) {
    const viewpoint = this.anchor(viewpointAnchor);
    const hotspot = this.anchor(hotspotAnchor);
    if (!viewpoint || !hotspot) return false;
    const probe = new PerspectiveCamera(
      this.camera.fov,
      this.camera.aspect,
      this.camera.near,
      this.camera.far,
    );
    viewpoint.getWorldPosition(probe.position);
    viewpoint.getWorldQuaternion(probe.quaternion);
    probe.updateMatrixWorld();
    const { x, y, z } = this.bounds(hotspot).center.clone().project(probe);
    return z < 1 && Math.abs(x) <= 0.9 && Math.abs(y) <= 0.9;
  }

  /** Of the given viewpoint anchors, the one closest to a hotspot: where the camera should come from. */
  nearestViewpoint(hotspotAnchor: string, viewpointAnchors: string[]) {
    const hotspot = this.anchor(hotspotAnchor);
    if (!hotspot) return null;
    const target = this.bounds(hotspot).center;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const name of viewpointAnchors) {
      const viewpoint = this.anchor(name);
      if (!viewpoint) continue;
      const distance = viewpoint
        .getWorldPosition(new Vector3())
        .distanceTo(target);
      if (distance < bestDistance) {
        best = name;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Keeps a DOM element positioned over an anchor. Returns the function to stop doing so. */
  registerPin(anchorName: string, element: HTMLElement) {
    const anchor = this.anchor(anchorName);
    // Placement is static, so the anchor's centre only needs working out once.
    if (anchor) this.pins.set(element, this.bounds(anchor).center);
    return () => {
      this.pins.delete(element);
    };
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.rig.dispose();
    this.highlight.clear();
    this.environment.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private anchor(name: string) {
    return this.model?.getObjectByName(name) ?? null;
  }

  private bounds(anchor: Object3D) {
    const box = new Box3().setFromObject(anchor);
    if (box.isEmpty()) {
      return new Sphere(anchor.getWorldPosition(new Vector3()), 0);
    }
    return box.getBoundingSphere(new Sphere());
  }

  /** Moves towards the anchor from the current viewpoint, never further away than it already is. */
  private focusPose(anchor: Object3D, from: Vector3) {
    const { center, radius } = this.bounds(anchor);
    const offset = from.clone().sub(center);
    const distance = Math.min(
      offset.length(),
      Math.max(radius * FOCUS_RADIUS_FACTOR, offset.length() * FOCUS_APPROACH),
    );
    const position = center.clone().add(offset.setLength(distance));
    return { position, orientation: lookAtOrientation(position, center) };
  }

  private resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const fitWidth = MathUtils.radToDeg(
      2 * Math.atan(Math.tan(MIN_HORIZONTAL_FOV / 2) / this.camera.aspect),
    );
    this.camera.fov = MathUtils.clamp(
      fitWidth,
      BASE_VERTICAL_FOV,
      MAX_VERTICAL_FOV,
    );
    this.camera.updateProjectionMatrix();
  }

  private frame(time: number) {
    const delta = MathUtils.clamp(
      (time - (this.lastFrame ?? time)) / 1000,
      0,
      MAX_FRAME_SECONDS,
    );
    this.lastFrame = time;
    const seconds = time / 1000;

    this.rig.update(delta);
    if (!this.reducedMotion)
      this.camera.position.add(swayOffset(seconds, this.sway));
    this.updateViewShift(delta);
    this.environment.update(seconds);
    this.highlight.update(seconds);
    this.renderer.render(this.scene, this.camera);
    this.updatePins();
  }

  private updateViewShift(delta: number) {
    const { clientWidth: width, clientHeight: height } = this.container;
    const wide = width >= WIDE_SCREEN;
    // Side panels push the scene sideways; bottom UI lifts it into the space below the header.
    const { bottom, left, right } = this.insets;
    const goalX =
      (this.focusing && wide ? SIDE_PANEL_SHIFT : 0) + (right - left) / 2;
    const lift = Math.max(0, (bottom - HEADER_RESERVE) / 2);
    const goalY =
      (this.focusing && !wide ? height * SHEET_SHIFT_FRACTION : 0) + lift;
    const ease = this.reducedMotion
      ? 1
      : 1 - Math.exp(-SHIFT_SMOOTHING * delta);
    this.viewShift.x = MathUtils.lerp(this.viewShift.x, goalX, ease);
    this.viewShift.y = MathUtils.lerp(this.viewShift.y, goalY, ease);
    this.camera.setViewOffset(
      width,
      height,
      this.viewShift.x,
      this.viewShift.y,
      width,
      height,
    );
  }

  private updatePins() {
    const { clientWidth: width, clientHeight: height } = this.container;
    this.camera.updateMatrixWorld();

    for (const [element, center] of this.pins) {
      this.projected.copy(center).project(this.camera);
      const { x, y, z } = this.projected;
      const onScreen = z < 1 && Math.abs(x) <= 1 && Math.abs(y) <= 1;
      element.style.visibility = onScreen ? 'visible' : 'hidden';
      if (onScreen) {
        const left = ((x + 1) / 2) * width;
        const top = ((1 - y) / 2) * height;
        element.style.transform = `translate(-50%, -50%) translate(${left}px, ${top}px)`;
      }
    }
  }
}
