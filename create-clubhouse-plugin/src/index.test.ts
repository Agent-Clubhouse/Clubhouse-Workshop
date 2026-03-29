import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toId } from './index';

// ── toId() ─────────────────────────────────────────────────────────────

describe('toId', () => {
  it('converts a normal name to kebab-case', () => {
    expect(toId('My Plugin')).toBe('my-plugin');
  });

  it('converts camelCase to lowercase kebab', () => {
    expect(toId('MyPlugin')).toBe('myplugin');
  });

  it('handles special characters', () => {
    expect(toId('Hello, World!')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toId('--my-plugin--')).toBe('my-plugin');
  });

  it('collapses consecutive non-alphanumeric chars to a single hyphen', () => {
    expect(toId('a   b...c')).toBe('a-b-c');
  });

  it('handles single word', () => {
    expect(toId('plugin')).toBe('plugin');
  });

  it('throws for empty input', () => {
    expect(() => toId('')).toThrow('Plugin name must not be empty');
  });

  it('throws for whitespace-only input', () => {
    expect(() => toId('   ')).toThrow('Plugin name must not be empty');
  });

  it('returns empty string for special-chars-only input', () => {
    expect(toId('!@#$%')).toBe('');
  });

  it('handles numeric names', () => {
    expect(toId('plugin 123')).toBe('plugin-123');
  });
});

// ── Generated file content ─────────────────────────────────────────────
// These tests verify the structure of generated manifest.json and package.json
// by simulating what the scaffolder produces. Since the scaffolder's main()
// function is interactive (uses prompts), we test the generation logic by
// checking the template files and expected output shapes.

describe('template files', () => {
  const templatesDir = join(__dirname, '..', 'templates');

  it('basic template exports MainPanel', () => {
    const content = readFileSync(join(templatesDir, 'basic', 'src', 'main.tsx'), 'utf-8');
    expect(content).toContain('export function MainPanel');
    expect(content).toContain('export function activate');
    expect(content).toContain('export function deactivate');
  });

  it('with-sidebar template exports SidebarPanel and MainPanel', () => {
    const content = readFileSync(join(templatesDir, 'with-sidebar', 'src', 'main.tsx'), 'utf-8');
    expect(content).toContain('export function SidebarPanel');
    expect(content).toContain('export function MainPanel');
  });

  it('app-scoped template exports MainPanel', () => {
    const content = readFileSync(join(templatesDir, 'app-scoped', 'src', 'main.tsx'), 'utf-8');
    expect(content).toContain('export function MainPanel');
  });

  it('agent-workflow template exports MainPanel', () => {
    const content = readFileSync(join(templatesDir, 'agent-workflow', 'src', 'main.tsx'), 'utf-8');
    expect(content).toContain('export function MainPanel');
  });

  it('all four template directories exist', () => {
    expect(existsSync(join(templatesDir, 'basic'))).toBe(true);
    expect(existsSync(join(templatesDir, 'with-sidebar'))).toBe(true);
    expect(existsSync(join(templatesDir, 'app-scoped'))).toBe(true);
    expect(existsSync(join(templatesDir, 'agent-workflow'))).toBe(true);
  });
});

// ── Manifest generation logic ──────────────────────────────────────────
// Test that the manifest template produces correct values.
// We replicate the manifest generation logic here to verify it.

describe('manifest generation', () => {
  function generateManifest(answers: {
    name: string;
    scope: 'project' | 'app' | 'dual';
    permissions: string[];
    layout?: string;
  }) {
    const id = toId(answers.name);
    return {
      id,
      name: answers.name,
      version: '0.1.0',
      description: '',
      author: '',
      engine: { api: 0.7 },
      scope: answers.scope,
      main: './dist/main.js',
      permissions: answers.permissions.length > 0 ? answers.permissions : ['logging'],
      contributes: {
        ...(answers.scope !== 'app'
          ? {
              tab: {
                label: answers.name,
                icon: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>",
                layout: answers.layout || 'full',
              },
            }
          : {}),
        ...(answers.scope === 'app' || answers.scope === 'dual'
          ? {
              railItem: {
                label: answers.name,
                icon: "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='3' width='18' height='18' rx='2'/></svg>",
              },
            }
          : {}),
        help: {
          topics: [{ id: 'overview', title: answers.name, content: `# ${answers.name}\n\nDescribe your plugin here.` }],
        },
      },
    };
  }

  it('generates correct API version (0.7)', () => {
    const manifest = generateManifest({
      name: 'Test Plugin',
      scope: 'project',
      permissions: ['logging'],
    });
    expect(manifest.engine.api).toBe(0.7);
  });

  it('generates correct id from name', () => {
    const manifest = generateManifest({
      name: 'My Cool Plugin',
      scope: 'project',
      permissions: [],
    });
    expect(manifest.id).toBe('my-cool-plugin');
  });

  it('defaults permissions to logging when empty', () => {
    const manifest = generateManifest({
      name: 'Test',
      scope: 'project',
      permissions: [],
    });
    expect(manifest.permissions).toEqual(['logging']);
  });

  it('includes tab for project scope', () => {
    const manifest = generateManifest({
      name: 'Test',
      scope: 'project',
      permissions: [],
    });
    expect(manifest.contributes.tab).toBeDefined();
    expect(manifest.contributes).not.toHaveProperty('railItem');
  });

  it('includes railItem for app scope', () => {
    const manifest = generateManifest({
      name: 'Test',
      scope: 'app',
      permissions: [],
    });
    expect(manifest.contributes).not.toHaveProperty('tab');
    expect(manifest.contributes.railItem).toBeDefined();
  });

  it('includes both tab and railItem for dual scope', () => {
    const manifest = generateManifest({
      name: 'Test',
      scope: 'dual',
      permissions: [],
    });
    expect(manifest.contributes.tab).toBeDefined();
    expect(manifest.contributes.railItem).toBeDefined();
  });

  it('includes help topics', () => {
    const manifest = generateManifest({
      name: 'My Plugin',
      scope: 'project',
      permissions: [],
    });
    expect(manifest.contributes.help.topics).toHaveLength(1);
    expect(manifest.contributes.help.topics[0].title).toBe('My Plugin');
  });
});

// ── Package.json generation ────────────────────────────────────────────

describe('package.json generation', () => {
  function generatePackageJson(name: string) {
    const id = toId(name);
    return {
      name: id,
      version: '0.1.0',
      private: true,
      description: '',
      scripts: {
        build: 'esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js',
        watch: 'esbuild src/main.tsx --bundle --format=esm --platform=browser --external:react --outfile=dist/main.js --watch',
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
      },
      devDependencies: {
        '@clubhouse/plugin-types': '^0.7.0',
        '@types/react': '^19.0.0',
        esbuild: '^0.24.0',
        typescript: '^5.7.0',
        vitest: '^3.0.0',
        '@clubhouse/plugin-testing': '^0.7.0',
      },
    };
  }

  it('uses toId for package name', () => {
    const pkg = generatePackageJson('My Plugin');
    expect(pkg.name).toBe('my-plugin');
  });

  it('includes required build scripts', () => {
    const pkg = generatePackageJson('Test');
    expect(pkg.scripts.build).toContain('esbuild');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('includes plugin-types and plugin-testing deps', () => {
    const pkg = generatePackageJson('Test');
    expect(pkg.devDependencies['@clubhouse/plugin-types']).toBeDefined();
    expect(pkg.devDependencies['@clubhouse/plugin-testing']).toBeDefined();
  });

  it('uses correct SDK dependency versions (^0.7.0)', () => {
    const pkg = generatePackageJson('Test');
    expect(pkg.devDependencies['@clubhouse/plugin-types']).toBe('^0.7.0');
    expect(pkg.devDependencies['@clubhouse/plugin-testing']).toBe('^0.7.0');
  });
});
