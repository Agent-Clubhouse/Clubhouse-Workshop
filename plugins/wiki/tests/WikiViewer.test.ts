import { describe, it, expect, vi } from 'vitest';

// ── loadFile race-condition guard ────────────────────────────────────
//
// WikiViewer.tsx uses a request-counter ref to discard stale readFile
// responses. These tests validate the pattern in isolation so we can
// verify correctness without a full React DOM render.

/** Create a deferred promise whose resolution we control. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Minimal reproduction of the loadFile pattern from WikiViewer.tsx.
 * `requestIdRef` is shared mutable state (like useRef), and `setContent`
 * / `setLoading` are mock state setters.
 */
function createLoadFile(readFile: (path: string) => Promise<string>) {
  const requestIdRef = { current: 0 };
  const setContent = vi.fn();
  const setLoading = vi.fn();

  async function loadFile(path: string) {
    const thisRequest = ++requestIdRef.current;
    setLoading(true);

    try {
      const text = await readFile(path);
      if (thisRequest !== requestIdRef.current) return; // stale
      setContent(text);
    } catch {
      if (thisRequest !== requestIdRef.current) return; // stale
      setContent('');
    }
    setLoading(false);
  }

  return { loadFile, setContent, setLoading, requestIdRef };
}

describe('loadFile race-condition guard', () => {
  it('discards stale response when a newer request is in flight', async () => {
    const dA = deferred<string>();
    const dB = deferred<string>();

    let callCount = 0;
    const readFile = vi.fn(() => {
      callCount++;
      return callCount === 1 ? dA.promise : dB.promise;
    });

    const { loadFile, setContent, setLoading } = createLoadFile(readFile);

    // Start request A (file-a.md)
    const pA = loadFile('file-a.md');
    // Start request B (file-b.md) before A resolves
    const pB = loadFile('file-b.md');

    expect(readFile).toHaveBeenCalledTimes(2);

    // Resolve B first (latest request)
    dB.resolve('Content B');
    await pB;

    expect(setContent).toHaveBeenLastCalledWith('Content B');
    expect(setLoading).toHaveBeenLastCalledWith(false);

    // Resolve A after B (stale)
    dA.resolve('Content A');
    await pA;

    // setContent must NOT have been called with stale data
    expect(setContent).not.toHaveBeenCalledWith('Content A');
    // The last call should still be Content B
    expect(setContent).toHaveBeenLastCalledWith('Content B');
  });

  it('accepts content when only one request is made', async () => {
    const readFile = vi.fn(async () => 'Only file');
    const { loadFile, setContent, setLoading } = createLoadFile(readFile);

    await loadFile('only.md');

    expect(setContent).toHaveBeenCalledWith('Only file');
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenLastCalledWith(false);
  });

  it('accepts latest content when requests resolve in order', async () => {
    const dA = deferred<string>();
    const dB = deferred<string>();

    let callCount = 0;
    const readFile = vi.fn(() => {
      callCount++;
      return callCount === 1 ? dA.promise : dB.promise;
    });

    const { loadFile, setContent } = createLoadFile(readFile);

    const pA = loadFile('file-a.md');
    const pB = loadFile('file-b.md');

    // Resolve A first (stale since B was requested after)
    dA.resolve('Content A');
    await pA;

    // A should be discarded
    expect(setContent).not.toHaveBeenCalledWith('Content A');

    // Resolve B (latest)
    dB.resolve('Content B');
    await pB;

    expect(setContent).toHaveBeenCalledWith('Content B');
  });

  it('discards stale error without clearing newer content', async () => {
    const dA = deferred<string>();
    const dB = deferred<string>();

    let callCount = 0;
    const readFile = vi.fn(() => {
      callCount++;
      return callCount === 1 ? dA.promise : dB.promise;
    });

    const { loadFile, setContent } = createLoadFile(readFile);

    const pA = loadFile('file-a.md');
    const pB = loadFile('file-b.md');

    // Resolve B
    dB.resolve('Content B');
    await pB;
    expect(setContent).toHaveBeenLastCalledWith('Content B');

    // Reject A (stale error) — should not call setContent('')
    dA.reject(new Error('Network error'));
    await pA;

    // Last call should still be Content B, not ''
    expect(setContent).toHaveBeenLastCalledWith('Content B');
  });

  it('handles three rapid requests, only keeps the last', async () => {
    const dA = deferred<string>();
    const dB = deferred<string>();
    const dC = deferred<string>();

    let callCount = 0;
    const readFile = vi.fn(() => {
      callCount++;
      if (callCount === 1) return dA.promise;
      if (callCount === 2) return dB.promise;
      return dC.promise;
    });

    const { loadFile, setContent } = createLoadFile(readFile);

    const pA = loadFile('a.md');
    const pB = loadFile('b.md');
    const pC = loadFile('c.md');

    // Resolve in reverse order
    dC.resolve('Content C');
    await pC;
    expect(setContent).toHaveBeenLastCalledWith('Content C');

    dB.resolve('Content B');
    await pB;
    expect(setContent).not.toHaveBeenCalledWith('Content B');

    dA.resolve('Content A');
    await pA;
    expect(setContent).not.toHaveBeenCalledWith('Content A');

    expect(setContent).toHaveBeenCalledTimes(1);
    expect(setContent).toHaveBeenCalledWith('Content C');
  });

  it('increments requestIdRef on each call', () => {
    const readFile = vi.fn(async () => '');
    const { loadFile, requestIdRef } = createLoadFile(readFile);

    expect(requestIdRef.current).toBe(0);
    loadFile('a.md');
    expect(requestIdRef.current).toBe(1);
    loadFile('b.md');
    expect(requestIdRef.current).toBe(2);
    loadFile('c.md');
    expect(requestIdRef.current).toBe(3);
  });
});
