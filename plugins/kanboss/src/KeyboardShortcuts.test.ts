import { describe, it, expect, beforeEach } from 'vitest';
import { SHORTCUTS, getShowHelp, toggleHelp, subscribeHelp } from './KeyboardShortcuts';

describe('SHORTCUTS', () => {
  it('defines at least 5 shortcuts', () => {
    expect(SHORTCUTS.length).toBeGreaterThanOrEqual(5);
  });

  it('each shortcut has required fields', () => {
    for (const s of SHORTCUTS) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.binding).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('has no duplicate IDs', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate bindings', () => {
    const bindings = SHORTCUTS.map((s) => s.binding);
    expect(new Set(bindings).size).toBe(bindings.length);
  });

  it('includes new-card shortcut bound to N', () => {
    const nc = SHORTCUTS.find((s) => s.id === 'new-card');
    expect(nc).toBeDefined();
    expect(nc?.binding).toBe('N');
  });

  it('includes escape shortcut', () => {
    const esc = SHORTCUTS.find((s) => s.id === 'escape');
    expect(esc).toBeDefined();
    expect(esc?.binding).toBe('Escape');
  });
});

describe('help toggle', () => {
  beforeEach(() => {
    // Reset to hidden
    if (getShowHelp()) toggleHelp();
  });

  it('starts hidden', () => {
    expect(getShowHelp()).toBe(false);
  });

  it('toggleHelp shows then hides', () => {
    toggleHelp();
    expect(getShowHelp()).toBe(true);
    toggleHelp();
    expect(getShowHelp()).toBe(false);
  });

  it('notifies subscribers on toggle', () => {
    let callCount = 0;
    const unsub = subscribeHelp(() => { callCount++; });

    toggleHelp();
    expect(callCount).toBe(1);
    toggleHelp();
    expect(callCount).toBe(2);

    unsub();
    toggleHelp();
    expect(callCount).toBe(2); // unsubscribed
    // clean up
    if (getShowHelp()) toggleHelp();
  });
});
