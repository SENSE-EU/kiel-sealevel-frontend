import { describe, expect, it } from 'vitest';
import { readVisited, writeVisited } from './visited';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('visited storage', () => {
  it('round-trips per scene', () => {
    const storage = memoryStorage();
    writeVisited('munitions', ['a', 'b'], storage);
    expect(readVisited('munitions', storage)).toEqual(['a', 'b']);
    expect(readVisited('other', storage)).toEqual([]);
  });

  it('survives corrupt data and unavailable storage', () => {
    const corrupt = memoryStorage({
      'kiel-sealevel:visited:munitions': '{not json',
    });
    expect(readVisited('munitions', corrupt)).toEqual([]);

    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readVisited('munitions', broken)).toEqual([]);
    expect(() => writeVisited('munitions', ['a'], broken)).not.toThrow();
  });
});
