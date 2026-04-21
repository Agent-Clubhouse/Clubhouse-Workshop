import { describe, it, expect, vi } from 'vitest';
import * as loungeModule from './main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';

describe('lounge main', () => {
  it('exports required PluginModule members', () => {
    expect(loungeModule.activate).toBeDefined();
    expect(typeof loungeModule.activate).toBe('function');
    expect(loungeModule.deactivate).toBeDefined();
    expect(typeof loungeModule.deactivate).toBe('function');
    expect(loungeModule.MainPanel).toBeDefined();
    expect(typeof loungeModule.MainPanel).toBe('function');
  });

  it('activate does not throw', () => {
    const ctx = createMockContext({ pluginId: 'lounge', scope: 'app' });
    const api = createMockAPI({
      context: { mode: 'app' },
    });

    expect(() => loungeModule.activate(ctx, api)).not.toThrow();
  });

  it('deactivate does not throw', () => {
    expect(() => loungeModule.deactivate()).not.toThrow();
  });

  it('exports MainPanel component', () => {
    expect(loungeModule.MainPanel).toBeDefined();
    expect(typeof loungeModule.MainPanel).toBe('function');
  });
});
