import { describe, it, expect } from 'vitest';
import manifest from '../manifest.json';

describe('KanBoss manifest', () => {
  it('has correct plugin id', () => {
    expect(manifest.id).toBe('kanboss');
  });

  it('has correct scope', () => {
    expect(manifest.scope).toBe('project');
  });

  it('targets API version 0.5', () => {
    expect(manifest.engine.api).toBe(0.5);
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('agents');
    expect(manifest.permissions).toContain('commands');
    expect(manifest.permissions).toContain('notifications');
    expect(manifest.permissions).toContain('logging');
  });

  it('contributes a tab with sidebar-content layout', () => {
    expect(manifest.contributes.tab).toBeDefined();
    expect(manifest.contributes.tab.label).toBe('KanBoss');
    expect(manifest.contributes.tab.layout).toBe('sidebar-content');
  });

  it('has icon SVG', () => {
    expect(manifest.contributes.tab.icon).toContain('<svg');
  });

  it('contributes commands', () => {
    const ids = manifest.contributes.commands.map((c: { id: string }) => c.id);
    expect(ids).toContain('refresh');
    expect(ids).toContain('new-board');
  });

  it('contributes help topics', () => {
    expect(manifest.contributes.help.topics.length).toBeGreaterThanOrEqual(1);
    const ids = manifest.contributes.help.topics.map((t: { id: string }) => t.id);
    expect(ids).toContain('kanboss');
    expect(ids).toContain('kanboss-automation');
  });
});
