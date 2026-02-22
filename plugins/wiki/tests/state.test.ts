import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wikiState } from '../src/state';

describe('wikiState', () => {
  beforeEach(() => {
    wikiState.reset();
  });

  it('setSelectedPath updates and notifies', () => {
    const listener = vi.fn();
    wikiState.subscribe(listener);
    wikiState.setSelectedPath('/test.md');
    expect(wikiState.selectedPath).toBe('/test.md');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setDirty updates and notifies', () => {
    const listener = vi.fn();
    wikiState.subscribe(listener);
    wikiState.setDirty(true);
    expect(wikiState.isDirty).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setViewMode updates and notifies', () => {
    const listener = vi.fn();
    wikiState.subscribe(listener);
    wikiState.setViewMode('edit');
    expect(wikiState.viewMode).toBe('edit');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('triggerRefresh increments count and notifies', () => {
    const listener = vi.fn();
    wikiState.subscribe(listener);
    const before = wikiState.refreshCount;
    wikiState.triggerRefresh();
    expect(wikiState.refreshCount).toBe(before + 1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe returns unsubscribe function', () => {
    const listener = vi.fn();
    const unsub = wikiState.subscribe(listener);
    wikiState.notify();
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    wikiState.notify();
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('reset clears all state including viewMode back to view', () => {
    wikiState.setSelectedPath('/file.md');
    wikiState.setDirty(true);
    wikiState.setViewMode('edit');
    wikiState.triggerRefresh();
    const listener = vi.fn();
    wikiState.subscribe(listener);

    wikiState.reset();

    expect(wikiState.selectedPath).toBeNull();
    expect(wikiState.isDirty).toBe(false);
    expect(wikiState.viewMode).toBe('view');
    expect(wikiState.refreshCount).toBe(0);
    expect(wikiState.listeners.size).toBe(0);
  });
});

// ── Navigation history ────────────────────────────────────────────────

describe('wikiState navigation history', () => {
  beforeEach(() => {
    wikiState.reset();
  });

  it('tracks navigation history when setSelectedPath is called', () => {
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath('page2.md');
    wikiState.setSelectedPath('page3.md');
    expect(wikiState.canGoBack()).toBe(true);
  });

  it('goBack navigates to previous page', () => {
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath('page2.md');
    wikiState.setSelectedPath('page3.md');

    wikiState.goBack();
    expect(wikiState.selectedPath).toBe('page2.md');

    wikiState.goBack();
    expect(wikiState.selectedPath).toBe('page1.md');
  });

  it('canGoBack returns false when at start of history', () => {
    expect(wikiState.canGoBack()).toBe(false);

    wikiState.setSelectedPath('page1.md');
    expect(wikiState.canGoBack()).toBe(false);

    wikiState.setSelectedPath('page2.md');
    expect(wikiState.canGoBack()).toBe(true);

    wikiState.goBack();
    expect(wikiState.canGoBack()).toBe(false);
  });

  it('navigating after goBack truncates forward history', () => {
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath('page2.md');
    wikiState.setSelectedPath('page3.md');

    wikiState.goBack(); // at page2
    wikiState.setSelectedPath('page4.md'); // page3 should be dropped

    wikiState.goBack();
    expect(wikiState.selectedPath).toBe('page2.md');

    // Can't go forward to page3 anymore
    expect(wikiState.canGoBack()).toBe(true);
  });

  it('goBack notifies listeners', () => {
    const listener = vi.fn();
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath('page2.md');
    wikiState.subscribe(listener);

    wikiState.goBack();
    expect(listener).toHaveBeenCalled();
  });

  it('reset clears history', () => {
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath('page2.md');
    wikiState.reset();

    expect(wikiState.canGoBack()).toBe(false);
    expect(wikiState.selectedPath).toBeNull();
  });

  it('setSelectedPath(null) does not add to history', () => {
    wikiState.setSelectedPath('page1.md');
    wikiState.setSelectedPath(null);
    expect(wikiState.canGoBack()).toBe(false);
  });
});
