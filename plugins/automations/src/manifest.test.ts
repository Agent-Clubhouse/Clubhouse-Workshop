import { describe, it, expect } from 'vitest';
import manifest from '../manifest.json';

describe('automations plugin manifest', () => {
  it('has correct id', () => {
    expect(manifest.id).toBe('automations');
  });

  it('is project-scoped', () => {
    expect(manifest.scope).toBe('project');
  });

  it('targets API v0.6', () => {
    expect(manifest.engine.api).toBe(0.6);
  });

  it('declares required permissions', () => {
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(['storage', 'agents', 'commands', 'notifications', 'navigation', 'widgets', 'theme']),
    );
    expect(manifest.permissions).toHaveLength(7);
  });

  it('contributes help topics', () => {
    expect(manifest.contributes?.help).toBeDefined();
    expect(manifest.contributes!.help!.topics).toBeDefined();
    expect(manifest.contributes!.help!.topics!.length).toBeGreaterThan(0);
  });

  it('contributes a full-layout tab', () => {
    expect(manifest.contributes?.tab).toBeDefined();
    expect(manifest.contributes!.tab!.layout).toBe('full');
    expect(manifest.contributes!.tab!.label).toBe('Automations');
  });

  it('contributes a create command', () => {
    const cmds = manifest.contributes?.commands;
    expect(cmds).toBeDefined();
    expect(cmds!.some((c: any) => c.id === 'create')).toBe(true);
  });

  it('has a tab icon (SVG string)', () => {
    expect(manifest.contributes!.tab!.icon).toContain('<svg');
  });

  it('specifies main entry point', () => {
    expect(manifest.main).toBe('./dist/main.js');
  });

  it('does not contribute a rail item (project-scoped only)', () => {
    expect((manifest.contributes as any)?.railItem).toBeUndefined();
  });
});
