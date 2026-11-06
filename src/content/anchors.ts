/**
 * The missing-anchor rule: an item whose anchor isn't in the GLB is hidden and logged, and the scene
 * carries on. Anchor names are the contract between the artist, the 3D engineer and the CMS.
 */
export function filterByAnchors<T extends { anchor: string }>(
  items: T[],
  available: ReadonlySet<string>,
  kind: 'hotspot' | 'viewpoint',
): T[] {
  return items.filter((item) => {
    if (available.has(item.anchor)) return true;
    console.warn(
      `[scene] Hiding ${kind}: anchor "${item.anchor}" is not in the model.`,
    );
    return false;
  });
}
