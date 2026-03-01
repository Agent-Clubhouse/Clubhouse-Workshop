import { describe, it, expect, vi, beforeEach } from 'vitest';
import { activate, deactivate, detectDefaultBranch } from '../src/main';
import { createMockContext, createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI, PluginContext } from '@clubhouse/plugin-types';

// ── detectDefaultBranch() ──────────────────────────────────────────

describe('detectDefaultBranch()', () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = createMockAPI();
  });

  it('returns the user-configured setting when present', async () => {
    const customApi = createMockAPI({
      settings: {
        get: vi.fn((key: string) => (key === 'defaultBranch' ? 'develop' : undefined)),
        getAll: vi.fn(() => ({ defaultBranch: 'develop' })),
        onChange: vi.fn(() => ({ dispose: vi.fn() })),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('develop');
  });

  it('does not call git rev-parse when setting is configured', async () => {
    const execSpy = vi.fn();
    const customApi = createMockAPI({
      settings: {
        get: vi.fn((key: string) => (key === 'defaultBranch' ? 'master' : undefined)),
        getAll: vi.fn(() => ({ defaultBranch: 'master' })),
        onChange: vi.fn(() => ({ dispose: vi.fn() })),
      },
      process: { exec: execSpy },
    });
    await detectDefaultBranch(customApi);
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('auto-detects via git rev-parse when no setting is configured', async () => {
    const execSpy = vi.fn().mockResolvedValue({
      stdout: 'origin/master\n',
      stderr: '',
      exitCode: 0,
    });
    const customApi = createMockAPI({
      process: { exec: execSpy },
    });
    const result = await detectDefaultBranch(customApi);
    expect(result).toBe('master');
    expect(execSpy).toHaveBeenCalledWith('git', [
      'rev-parse',
      '--abbrev-ref',
      'origin/HEAD',
    ]);
  });

  it('strips origin/ prefix from rev-parse output', async () => {
    const customApi = createMockAPI({
      process: {
        exec: vi.fn().mockResolvedValue({
          stdout: 'origin/develop',
          stderr: '',
          exitCode: 0,
        }),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('develop');
  });

  it('falls back to "main" when rev-parse returns HEAD', async () => {
    const customApi = createMockAPI({
      process: {
        exec: vi.fn().mockResolvedValue({
          stdout: 'HEAD\n',
          stderr: '',
          exitCode: 0,
        }),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('main');
  });

  it('falls back to "main" when rev-parse throws', async () => {
    const customApi = createMockAPI({
      process: {
        exec: vi.fn().mockRejectedValue(new Error('fatal: ref not found')),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('main');
  });

  it('falls back to "main" when rev-parse returns empty stdout', async () => {
    const customApi = createMockAPI({
      process: {
        exec: vi.fn().mockResolvedValue({
          stdout: '',
          stderr: '',
          exitCode: 1,
        }),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('main');
  });

  it('ignores empty string in settings (treats as unconfigured)', async () => {
    const customApi = createMockAPI({
      settings: {
        get: vi.fn((key: string) => (key === 'defaultBranch' ? '' : undefined)),
        getAll: vi.fn(() => ({ defaultBranch: '' })),
        onChange: vi.fn(() => ({ dispose: vi.fn() })),
      },
      process: {
        exec: vi.fn().mockResolvedValue({
          stdout: 'origin/trunk\n',
          stderr: '',
          exitCode: 0,
        }),
      },
    });
    expect(await detectDefaultBranch(customApi)).toBe('trunk');
  });
});

// ── activate() ─────────────────────────────────────────────────────

describe('code-review plugin activate()', () => {
  let ctx: PluginContext;
  let api: PluginAPI;
  let registerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ctx = createMockContext({ pluginId: 'code-review' });
    registerSpy = vi.fn(() => ({ dispose: vi.fn() }));
    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
    });
  });

  it('registers reviewStaged command', () => {
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledWith(
      'code-review.reviewStaged',
      expect.any(Function)
    );
  });

  it('registers reviewBranch command', () => {
    activate(ctx, api);
    expect(registerSpy).toHaveBeenCalledWith(
      'code-review.reviewBranch',
      expect.any(Function)
    );
  });

  it('pushes 2 disposables to ctx.subscriptions', () => {
    activate(ctx, api);
    expect(ctx.subscriptions).toHaveLength(2);
    for (const sub of ctx.subscriptions) {
      expect(typeof sub.dispose).toBe('function');
    }
  });

  it('logs activation message', () => {
    const infoSpy = vi.fn();
    api = createMockAPI({
      commands: { register: registerSpy, execute: vi.fn() },
      logging: {
        info: infoSpy,
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    });
    activate(ctx, api);
    expect(infoSpy).toHaveBeenCalledWith('Code Review plugin activated');
  });
});

// ── deactivate() ───────────────────────────────────────────────────

describe('code-review plugin deactivate()', () => {
  it('does not throw', () => {
    expect(() => deactivate()).not.toThrow();
  });

  it('is idempotent', () => {
    deactivate();
    deactivate();
    deactivate();
  });
});

// ── manifest ───────────────────────────────────────────────────────

describe('code-review manifest', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const manifest = require('../manifest.json');

  it('has defaultBranch setting', () => {
    const ids = manifest.contributes.settings.map((s: { id: string }) => s.id);
    expect(ids).toContain('defaultBranch');
  });

  it('defaultBranch setting defaults to empty string', () => {
    const setting = manifest.contributes.settings.find(
      (s: { id: string }) => s.id === 'defaultBranch'
    );
    expect(setting.default).toBe('');
  });

  it('defaultBranch setting is type string', () => {
    const setting = manifest.contributes.settings.find(
      (s: { id: string }) => s.id === 'defaultBranch'
    );
    expect(setting.type).toBe('string');
  });

  it('has process permission for git commands', () => {
    expect(manifest.permissions).toContain('process');
  });

  it('allows git commands', () => {
    expect(manifest.allowedCommands).toContain('git');
  });
});

// ── Module exports ─────────────────────────────────────────────────

describe('code-review module exports', () => {
  it('exports activate function', () => {
    expect(typeof activate).toBe('function');
  });

  it('exports deactivate function', () => {
    expect(typeof deactivate).toBe('function');
  });

  it('exports detectDefaultBranch function', () => {
    expect(typeof detectDefaultBranch).toBe('function');
  });
});
