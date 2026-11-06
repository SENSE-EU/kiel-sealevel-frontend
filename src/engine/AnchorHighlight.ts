import {
  Color,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';

const HIGHLIGHT_COLOR = new Color(0x7fd1b9);

/** Glows the meshes under an anchor. Anchors that are empty nodes simply don't highlight. */
export class AnchorHighlight {
  private entries: {
    mesh: Mesh;
    original: Mesh['material'];
    clone: MeshStandardMaterial;
  }[] = [];

  constructor(private readonly reducedMotion: boolean) {}

  set(anchor: Object3D | null) {
    this.clear();
    anchor?.traverse((object) => {
      const mesh = object as Mesh;
      const material = mesh.material as Material | Material[] | undefined;
      if (!mesh.isMesh || Array.isArray(material)) return;
      if (!(material as MeshStandardMaterial).isMeshStandardMaterial) return;

      // Materials are shared between meshes in a GLB, so only ever touch a private copy.
      const clone = (material as MeshStandardMaterial).clone();
      clone.emissive = HIGHLIGHT_COLOR;
      this.entries.push({ mesh, original: mesh.material, clone });
      mesh.material = clone;
    });
    this.update(0);
  }

  update(timeSeconds: number) {
    const intensity = this.reducedMotion
      ? 0.4
      : 0.35 + 0.2 * Math.sin(timeSeconds * 2.5);
    for (const { clone } of this.entries) clone.emissiveIntensity = intensity;
  }

  clear() {
    for (const { mesh, original, clone } of this.entries) {
      mesh.material = original;
      clone.dispose();
    }
    this.entries = [];
  }
}
