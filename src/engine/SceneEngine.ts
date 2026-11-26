import {
  Box3,
  MathUtils,
  NoToneMapping,
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
import { FramePacer } from './FramePacer';
import { loadModel } from './loadModel';
import { createPlaceholderScene } from './placeholderScene';
import type { SceneLook } from './SceneLook';
import { themeForSlug, type SceneTheme } from './themes';
import { findLocalPackage } from './underwater/localPackages';

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
  private look: SceneLook;
  private theme: SceneTheme;
  /** Content anchor names mapped to model nodes, for scenes delivered with their own names. */
  private aliases: Record<string, string> = {};
  private readonly reducedMotion: boolean;
  private readonly sway = new Vector3();
  private readonly resizeObserver: ResizeObserver;
  private readonly pins = new Map<HTMLElement, Vector3>();
  private readonly projected = new Vector3();
  private model: Object3D | null = null;
  private hasView = false;
  private focusing = false;
  private framingShot = false;
  private readonly viewShift = { x: 0, y: 0 };
  private insets: Insets = { bottom: 0, left: 0, right: 0 };
  /** The page language, for text the scene draws itself (effect labels). */
  private locale = 'en';
  private disposed = false;
  private readonly framePacer = new FramePacer();
  private lastFrame: number | null = null;
  private lastRender: number | null = null;

  /** Throws if WebGL isn't available; the UI then falls back to the plain list. */
  constructor(
    private readonly container: HTMLElement,
    private readonly slug: string,
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
    this.rig = new CameraRig(this.camera, container, this.reducedMotion, () => {
      this.look.cancelCameraShot?.();
      this.framePacer.wake();
    });
    this.highlight = new AnchorHighlight(this.reducedMotion);
    this.theme = themeForSlug(slug);
    this.look = proceduralLook(this.scene, this.theme);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  /**
   * Loads the model, or the built-in scene when there is none or it fails, and resolves to the names
   * of every node in it, for checking CMS anchors against. In development a local 3D team package for
   * the scene, when its files are present, takes the place of the CMS model.
   */
  async load(
    source: ModelSource | null,
    onProgress: (fraction: number) => void,
  ): Promise<Set<string>> {
    const local = await findLocalPackage(this.slug);
    if (this.disposed) return new Set();
    if (local) {
      // The package brings its own water and light.
      this.look.dispose();
      try {
        // Only scenes with a package need the underwater code, so it loads on demand.
        const { loadScenePackage } = await import('./underwater/scenePackage');
        if (this.disposed) return new Set();
        const loaded = await loadScenePackage(
          local,
          this.renderer,
          this.scene,
          this.camera,
          { element: this.container, locale: () => this.locale },
          onProgress,
        );
        if (this.disposed) {
          loaded.look.dispose();
          disposeObject(loaded.root);
          return new Set();
        }
        this.look = loaded.look;
        this.model = loaded.root;
        this.aliases = local.anchorAliases ?? {};
        this.applyLook();
        return this.anchorNames();
      } catch (error) {
        console.error(
          '[scene] Local scene package failed to load, using the CMS model',
          error,
        );
        if (this.disposed) return new Set();
        const partial = this.scene.getObjectByName('scene-package');
        if (partial) {
          this.scene.remove(partial);
          disposeObject(partial);
        }
        this.renderer.toneMapping = NoToneMapping;
        this.renderer.shadowMap.enabled = false;
        this.look = proceduralLook(this.scene, this.theme);
      }
    }

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
    return this.anchorNames();
  }

  /** Every node name in the model, plus the aliases that resolve to one. */
  private anchorNames() {
    const names = new Set<string>();
    this.model?.traverse((node) => {
      if (node.name) names.add(node.name);
    });
    for (const [alias, node] of Object.entries(this.aliases))
      if (names.has(node)) names.add(alias);
    return names;
  }

  /** Takes on the look's camera framing, drift and pixel ratio. */
  private applyLook() {
    const framing = this.look.camera;
    if (framing) {
      this.camera.near = framing.near;
      this.camera.far = framing.far;
    }
    this.resize();
  }

  /**
   * Device pixels per CSS pixel: the screen's, up to the look's cap, and within its pixel budget on big
   * screens, but never below 1 (that would upscale and look soft).
   */
  private pixelRatio(width: number, height: number) {
    const cap = Math.min(
      window.devicePixelRatio,
      this.look.maxPixelRatio ?? MAX_PIXEL_RATIO,
    );
    const budget = this.look.pixelBudget;
    return budget
      ? Math.min(cap, Math.max(1, Math.sqrt(budget / (width * height))))
      : cap;
  }

  /** Swaps to another scene's built-in version, without any download. Used behind the landing page. */
  showBackdrop(slug: string) {
    this.look.dispose();
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    this.theme = themeForSlug(slug);
    this.look = proceduralLook(this.scene, this.theme);
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
    this.framePacer.wake();
    const { position, orientation } = this.viewpointPose(viewpoint);

    const hotspot = hotspotAnchor ? this.anchor(hotspotAnchor) : null;
    this.look.cancelCameraShot?.();
    this.highlight.set(hotspot);
    this.look.focus?.(hotspot?.name ?? null);
    this.focusing = hotspot !== null && panelOpen;
    this.framingShot = false;
    if (
      hotspot &&
      panelOpen &&
      !this.reducedMotion &&
      this.look.startCameraShot?.(hotspot.name)
    ) {
      this.framingShot = true;
      this.hasView = true;
      return;
    }
    const pose = hotspot
      ? this.focusPose(hotspot, position)
      : { position, orientation };

    this.rig.moveTo(pose, !this.hasView);
    this.hasView = true;
  }

  /** Pixels of UI covering each edge of the scene, so it can centre in the space that's left. */
  setInsets(insets: Insets) {
    this.insets = insets;
    this.framePacer.wake();
  }

  /** The page language, for text drawn over the scene. */
  setLocale(locale: string) {
    this.locale = locale;
    this.framePacer.wake();
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
    const pose = this.viewpointPose(viewpoint);
    probe.position.copy(pose.position);
    probe.quaternion.copy(pose.orientation);
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
    this.look.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private anchor(name: string) {
    return this.model?.getObjectByName(this.aliases[name] ?? name) ?? null;
  }

  /** A node's `<name>_<suffix>` partner, wherever it sits in the model. */
  private partner(node: Object3D, suffix: string) {
    return this.model?.getObjectByName(`${node.name}_${suffix}`) ?? null;
  }

  /**
   * Where a viewpoint puts the camera. With a `<name>_target` node it looks at that; otherwise it takes
   * the node's own rotation, looking along its local -Z like a Blender camera.
   */
  private viewpointPose(viewpoint: Object3D) {
    const position = viewpoint.getWorldPosition(new Vector3());
    const target = this.partner(viewpoint, 'target');
    const orientation = target
      ? lookAtOrientation(position, target.getWorldPosition(new Vector3()))
      : viewpoint.getWorldQuaternion(new Quaternion());
    return { position, orientation };
  }

  private bounds(anchor: Object3D) {
    const box = new Box3().setFromObject(anchor);
    if (box.isEmpty()) {
      return new Sphere(anchor.getWorldPosition(new Vector3()), 0);
    }
    return box.getBoundingSphere(new Sphere());
  }

  /**
   * Where the camera frames a hotspot: from its `<name>_view` node when the model has one, otherwise
   * closer to it from the current viewpoint, never further away than it already is.
   */
  private focusPose(anchor: Object3D, from: Vector3) {
    const { center, radius } = this.bounds(anchor);
    const view = this.partner(anchor, 'view');
    if (view) {
      const position = view.getWorldPosition(new Vector3());
      return {
        position,
        orientation: lookAtOrientation(position, center),
        pivot: center,
      };
    }
    const offset = from.clone().sub(center);
    const distance = Math.min(
      offset.length(),
      Math.max(radius * FOCUS_RADIUS_FACTOR, offset.length() * FOCUS_APPROACH),
    );
    const position = center.clone().add(offset.setLength(distance));
    return {
      position,
      orientation: lookAtOrientation(position, center),
      pivot: center,
    };
  }

  private resize() {
    this.framePacer.wake();
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    const ratio = this.pixelRatio(width, height);
    if (this.renderer.getPixelRatio() !== ratio)
      this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const fit = (horizontal: number) =>
      MathUtils.radToDeg(
        2 * Math.atan(Math.tan(horizontal / 2) / this.camera.aspect),
      );
    const framing = this.look.camera;
    // A scene composed for a lens keeps its width on landscape screens and a fixed height on portrait ones.
    this.camera.fov = framing
      ? Math.min(
          fit(MathUtils.degToRad(framing.horizontalFov)),
          framing.maxVerticalFov,
        )
      : MathUtils.clamp(
          fit(MIN_HORIZONTAL_FOV),
          BASE_VERTICAL_FOV,
          MAX_VERTICAL_FOV,
        );
    this.camera.updateProjectionMatrix();
  }

  private frame(time: number) {
    if (document.hidden) {
      this.framePacer.wake();
      this.lastFrame = this.lastRender = null;
      return;
    }
    const frameDelta = Math.min(
      (time - (this.lastFrame ?? time)) / 1000,
      MAX_FRAME_SECONDS,
    );
    this.lastFrame = time;
    const seconds = time / 1000;

    const scripted = this.look.updateCameraShot?.(seconds, frameDelta);
    if (
      !this.framePacer.shouldRender(
        time,
        this.look.idleFps,
        Boolean(scripted) || this.rig.isMoving,
      )
    )
      return;
    const delta = Math.min(
      (time - (this.lastRender ?? time)) / 1000,
      MAX_FRAME_SECONDS,
    );
    this.lastRender = time;
    if (scripted)
      this.rig.moveTo(
        { position: this.camera.position, orientation: this.camera.quaternion },
        true,
      );
    else this.rig.update(delta);
    if (!scripted && !this.reducedMotion)
      this.camera.position.add(
        swayOffset(seconds, this.sway).multiplyScalar(this.look.swayScale ?? 1),
      );
    this.updateViewShift(delta);
    this.camera.updateMatrixWorld();
    this.look.update(seconds, delta);
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
    // The scripted shot already fits the portrait viewport. Account for the measured panel only.
    const goalY =
      (this.focusing && !this.framingShot && !wide
        ? height * SHEET_SHIFT_FRACTION
        : 0) + lift;
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
    const range = this.look.pinRange ?? Infinity;
    for (const [element, center] of this.pins) {
      this.projected.copy(center).project(this.camera);
      const { x, y, z } = this.projected;
      const onScreen =
        z < 1 &&
        Math.abs(x) <= 1 &&
        Math.abs(y) <= 1 &&
        center.distanceTo(this.camera.position) < range;
      element.style.visibility = onScreen ? 'visible' : 'hidden';
      if (onScreen) {
        const left = ((x + 1) / 2) * width;
        const top = ((1 - y) / 2) * height;
        element.style.transform = `translate(-50%, -50%) translate(${left}px, ${top}px)`;
      }
    }
  }
}

/** The built-in environment, as a look. */
function proceduralLook(scene: Scene, theme: SceneTheme): SceneLook {
  const environment = createEnvironment(scene, theme);
  return {
    update: (seconds) => environment.update(seconds),
    dispose: () => environment.dispose(),
  };
}
