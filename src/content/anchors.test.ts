import { describe, expect, it, vi } from 'vitest';
import { filterByAnchors } from './anchors';

describe('filterByAnchors', () => {
  it('hides items whose anchor is missing and warns about each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const items = [{ anchor: 'hs_a' }, { anchor: 'hs_missing' }];

    expect(filterByAnchors(items, new Set(['hs_a']), 'hotspot')).toEqual([
      { anchor: 'hs_a' },
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('hs_missing');
  });
});
