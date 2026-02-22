import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mutateStorage, _resetMutexes } from './storageQueue';
import type { ScopedStorage } from '@clubhouse/plugin-types';

function createMockStorage(initial: Record<string, unknown[]> = {}): ScopedStorage {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    read: vi.fn(async (key: string) => store.get(key) ?? null),
    write: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
    delete: vi.fn(async (key: string) => { store.delete(key); }),
    list: vi.fn(async () => [...store.keys()]),
  };
}

describe('mutateStorage', () => {
  beforeEach(() => {
    _resetMutexes();
  });

  it('reads current value, applies updater, and writes result', async () => {
    const storage = createMockStorage({ items: [1, 2, 3] });

    const result = await mutateStorage<number>(storage, 'items', (current) => {
      return [...current, 4];
    });

    expect(result).toEqual([1, 2, 3, 4]);
    expect(storage.read).toHaveBeenCalledWith('items');
    expect(storage.write).toHaveBeenCalledWith('items', [1, 2, 3, 4]);
  });

  it('defaults to empty array when key does not exist', async () => {
    const storage = createMockStorage();

    const result = await mutateStorage<string>(storage, 'missing', (current) => {
      expect(current).toEqual([]);
      return ['new-item'];
    });

    expect(result).toEqual(['new-item']);
  });

  it('serializes concurrent mutations to the same key', async () => {
    const storage = createMockStorage({ counter: [0] });
    const executionOrder: string[] = [];

    // Launch two concurrent mutations. Without serialization, both would
    // read [0] and write [1], losing one increment. With serialization,
    // the second waits for the first to finish, reads [1], and writes [2].
    const p1 = mutateStorage<number>(storage, 'counter', async (current) => {
      executionOrder.push('p1-read');
      // Simulate async work
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push('p1-write');
      return [current[0] + 1];
    });

    const p2 = mutateStorage<number>(storage, 'counter', async (current) => {
      executionOrder.push('p2-read');
      executionOrder.push('p2-write');
      return [current[0] + 1];
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    // p1 should complete before p2 starts
    expect(executionOrder).toEqual(['p1-read', 'p1-write', 'p2-read', 'p2-write']);

    // Both increments should be preserved
    expect(r1).toEqual([1]);
    expect(r2).toEqual([2]);
  });

  it('allows concurrent mutations to different keys', async () => {
    const storage = createMockStorage({ a: ['a'], b: ['b'] });
    const executionOrder: string[] = [];

    const p1 = mutateStorage<string>(storage, 'a', async (current) => {
      executionOrder.push('a-start');
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push('a-end');
      return [...current, 'a2'];
    });

    const p2 = mutateStorage<string>(storage, 'b', async (current) => {
      executionOrder.push('b-start');
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push('b-end');
      return [...current, 'b2'];
    });

    await Promise.all([p1, p2]);

    // b should finish before a since they run in parallel and b is faster
    expect(executionOrder.indexOf('b-end')).toBeLessThan(executionOrder.indexOf('a-end'));
  });

  it('releases the mutex even if the updater throws', async () => {
    const storage = createMockStorage({ items: ['initial'] });

    // First mutation throws
    await expect(
      mutateStorage<string>(storage, 'items', () => {
        throw new Error('updater failed');
      })
    ).rejects.toThrow('updater failed');

    // Second mutation should still be able to proceed (mutex was released)
    const result = await mutateStorage<string>(storage, 'items', (current) => {
      return [...current, 'recovered'];
    });

    expect(result).toEqual(['initial', 'recovered']);
  });

  it('handles three concurrent mutations in order', async () => {
    const storage = createMockStorage({ items: [] as string[] });

    const p1 = mutateStorage<string>(storage, 'items', async (current) => {
      await new Promise((r) => setTimeout(r, 30));
      return [...current, 'first'];
    });

    const p2 = mutateStorage<string>(storage, 'items', async (current) => {
      await new Promise((r) => setTimeout(r, 10));
      return [...current, 'second'];
    });

    const p3 = mutateStorage<string>(storage, 'items', async (current) => {
      return [...current, 'third'];
    });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toEqual(['first']);
    expect(r2).toEqual(['first', 'second']);
    expect(r3).toEqual(['first', 'second', 'third']);
  });

  it('supports async updater functions', async () => {
    const storage = createMockStorage({ data: [1] });

    const result = await mutateStorage<number>(storage, 'data', async (current) => {
      await new Promise((r) => setTimeout(r, 10));
      return [...current, 2];
    });

    expect(result).toEqual([1, 2]);
  });
});
