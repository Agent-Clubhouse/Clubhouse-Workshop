import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FileNode } from '@clubhouse/plugin-types';
import { parseOrderFile, sortByOrder, filterMarkdownTree } from '../src/WikiTree';

// ── parseOrderFile tests ─────────────────────────────────────────────

describe('parseOrderFile', () => {
  it('parses simple .order file content', () => {
    const result = parseOrderFile('Home\nGetting-Started\nAPI-Reference');
    expect(result).toEqual(['Home', 'Getting-Started', 'API-Reference']);
  });

  it('ignores empty lines', () => {
    const result = parseOrderFile('Home\n\nGetting-Started\n\n');
    expect(result).toEqual(['Home', 'Getting-Started']);
  });

  it('trims whitespace', () => {
    const result = parseOrderFile('  Home  \n  Getting-Started  ');
    expect(result).toEqual(['Home', 'Getting-Started']);
  });

  it('ignores comment lines starting with #', () => {
    const result = parseOrderFile('# comment\nHome\n# another comment\nGuide');
    expect(result).toEqual(['Home', 'Guide']);
  });

  it('returns empty array for empty content', () => {
    expect(parseOrderFile('')).toEqual([]);
    expect(parseOrderFile('\n\n')).toEqual([]);
  });
});

// ── sortByOrder tests ────────────────────────────────────────────────

describe('sortByOrder', () => {
  const nodes: FileNode[] = [
    { name: 'Zebra.md', path: 'Zebra.md', isDirectory: false },
    { name: 'Apple.md', path: 'Apple.md', isDirectory: false },
    { name: 'Banana.md', path: 'Banana.md', isDirectory: false },
    { name: 'guides', path: 'guides', isDirectory: true },
  ];

  it('sorts nodes according to .order list', () => {
    const order = ['Banana', 'Zebra', 'guides', 'Apple'];
    const sorted = sortByOrder(nodes, order);
    expect(sorted.map((n) => n.name)).toEqual(['Banana.md', 'Zebra.md', 'guides', 'Apple.md']);
  });

  it('puts ordered items first, unordered items alphabetically after', () => {
    const order = ['Banana'];
    const sorted = sortByOrder(nodes, order);
    expect(sorted[0].name).toBe('Banana.md');
    // Remaining items should be alphabetical
    expect(sorted.slice(1).map((n) => n.name)).toEqual(['Apple.md', 'guides', 'Zebra.md']);
  });

  it('returns original order when order list is empty', () => {
    const sorted = sortByOrder(nodes, []);
    expect(sorted).toEqual(nodes);
  });

  it('matches case-insensitively', () => {
    const order = ['zebra', 'APPLE'];
    const sorted = sortByOrder(nodes, order);
    expect(sorted[0].name).toBe('Zebra.md');
    expect(sorted[1].name).toBe('Apple.md');
  });

  it('matches directories without extension', () => {
    const order = ['guides', 'Apple'];
    const sorted = sortByOrder(nodes, order);
    expect(sorted[0].name).toBe('guides');
    expect(sorted[1].name).toBe('Apple.md');
  });
});

// ── filterMarkdownTree tests ─────────────────────────────────────────

describe('filterMarkdownTree', () => {
  it('includes directories with loaded markdown children', () => {
    const nodes: FileNode[] = [
      {
        name: 'docs',
        path: 'docs',
        isDirectory: true,
        children: [
          { name: 'guide.md', path: 'docs/guide.md', isDirectory: false },
        ],
      },
      { name: 'readme.md', path: 'readme.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'github');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('docs');
    expect(result[1].name).toBe('readme.md');
  });

  it('excludes directories with loaded children but no markdown files', () => {
    const nodes: FileNode[] = [
      {
        name: 'assets',
        path: 'assets',
        isDirectory: true,
        children: [
          { name: 'logo.png', path: 'assets/logo.png', isDirectory: false },
        ],
      },
      { name: 'readme.md', path: 'readme.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'github');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('readme.md');
  });

  it('includes directories with empty children (lazy-loaded, not yet expanded)', () => {
    const nodes: FileNode[] = [
      {
        name: 'guides',
        path: 'guides',
        isDirectory: true,
        children: [],
      },
      { name: 'home.md', path: 'home.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'github');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('guides');
  });

  it('includes directories with undefined children', () => {
    const nodes: FileNode[] = [
      {
        name: 'guides',
        path: 'guides',
        isDirectory: true,
      },
      { name: 'home.md', path: 'home.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'github');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('guides');
  });

  it('in ADO mode, hides .order files and same-named .md files', () => {
    const nodes: FileNode[] = [
      {
        name: 'Architecture',
        path: 'Architecture',
        isDirectory: true,
        children: [],
      },
      { name: 'Architecture.md', path: 'Architecture.md', isDirectory: false },
      { name: '.order', path: '.order', isDirectory: false },
      { name: 'FAQ.md', path: 'FAQ.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'ado');
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.name)).toEqual(['Architecture', 'FAQ.md']);
  });

  it('in ADO mode, annotates folder with indexPath when sibling .md exists', () => {
    const nodes: FileNode[] = [
      {
        name: 'Architecture',
        path: 'Architecture',
        isDirectory: true,
        children: [],
      },
      { name: 'Architecture.md', path: 'Architecture.md', isDirectory: false },
      { name: 'FAQ.md', path: 'FAQ.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'ado');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Architecture');
    expect((result[0] as any).indexPath).toBe('Architecture.md');
    expect((result[1] as any).indexPath).toBeUndefined();
  });

  it('in ADO mode, does not set indexPath for folders without sibling .md', () => {
    const nodes: FileNode[] = [
      {
        name: 'Images',
        path: 'Images',
        isDirectory: true,
        children: [],
      },
      { name: 'FAQ.md', path: 'FAQ.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'ado');
    expect(result[0].name).toBe('Images');
    expect((result[0] as any).indexPath).toBeUndefined();
  });

  it('in ADO mode, annotates nested folders with indexPath', () => {
    const nodes: FileNode[] = [
      {
        name: 'Guides',
        path: 'Guides',
        isDirectory: true,
        children: [
          {
            name: 'Advanced',
            path: 'Guides/Advanced',
            isDirectory: true,
            children: [],
          },
          { name: 'Advanced.md', path: 'Guides/Advanced.md', isDirectory: false },
          { name: 'Setup.md', path: 'Guides/Setup.md', isDirectory: false },
        ],
      },
    ];
    const result = filterMarkdownTree(nodes, 'ado');
    expect(result).toHaveLength(1);
    const advancedFolder = result[0].children!.find((n) => n.name === 'Advanced');
    expect(advancedFolder).toBeDefined();
    expect((advancedFolder as any).indexPath).toBe('Guides/Advanced.md');
    expect(result[0].children!.find((n) => n.name === 'Advanced.md')).toBeUndefined();
  });

  it('in github mode, does not annotate folders with indexPath', () => {
    const nodes: FileNode[] = [
      {
        name: 'docs',
        path: 'docs',
        isDirectory: true,
        children: [
          { name: 'guide.md', path: 'docs/guide.md', isDirectory: false },
        ],
      },
      { name: 'docs.md', path: 'docs.md', isDirectory: false },
    ];
    const result = filterMarkdownTree(nodes, 'github');
    expect(result).toHaveLength(2);
    expect((result[0] as any).indexPath).toBeUndefined();
  });

  it('in ADO mode, shows nested directories with empty children', () => {
    const nodes: FileNode[] = [
      {
        name: 'Guides',
        path: 'Guides',
        isDirectory: true,
        children: [
          { name: 'Setup.md', path: 'Guides/Setup.md', isDirectory: false },
          {
            name: 'Advanced',
            path: 'Guides/Advanced',
            isDirectory: true,
            children: [],
          },
        ],
      },
    ];
    const result = filterMarkdownTree(nodes, 'ado');
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children![1].name).toBe('Advanced');
  });
});
