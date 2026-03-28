import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { createMockAPI } from '@clubhouse/plugin-testing';
import type { PluginAPI } from '@clubhouse/plugin-types';
import { WikiViewer } from '../src/WikiViewer';
import { wikiState } from '../src/state';

// ── Helpers ────────────────────────────────────────────────────────────

function createWikiAPI(overrides?: Record<string, unknown>): PluginAPI {
  const api = createMockAPI();

  // Set up a functional mock for files.forRoot that returns a scoped FilesAPI
  const mockScopedFiles = {
    readTree: vi.fn().mockResolvedValue({ name: '.', type: 'directory', children: [] }),
    readFile: vi.fn().mockResolvedValue('# Hello World\n\nThis is wiki content.'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    watch: vi.fn().mockReturnValue(() => {}),
    exists: vi.fn().mockResolvedValue(true),
  };

  api.files.forRoot = vi.fn().mockReturnValue(mockScopedFiles);
  api.settings.get = vi.fn().mockReturnValue('github');

  return api;
}

function getScopedFiles(api: PluginAPI) {
  return (api.files.forRoot as ReturnType<typeof vi.fn>).mock.results[0]?.value;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('WikiViewer', () => {
  let api: PluginAPI;

  beforeEach(() => {
    wikiState.reset();
    api = createWikiAPI();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Empty state ──────────────────────────────────────────────────────

  describe('empty state (no file selected)', () => {
    it('renders empty state message', () => {
      render(<WikiViewer api={api} />);
      expect(screen.getByText('Select a page to view')).toBeTruthy();
      expect(screen.getByText('Click a page in the sidebar')).toBeTruthy();
    });
  });

  // ── File loading ─────────────────────────────────────────────────────

  describe('file loading', () => {
    it('displays file name when a page is selected', async () => {
      wikiState.setSelectedPath('getting-started.md');

      render(<WikiViewer api={api} />);

      // The component should load the file and show the prettified name
      await waitFor(() => {
        // In view mode, the file name is prettified (e.g., "Getting Started")
        expect(screen.getByText('Getting Started')).toBeTruthy();
      });
    });

    it('renders file content after loading', async () => {
      wikiState.setSelectedPath('readme.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        // The markdown preview should render the content
        expect(screen.getByText(/Hello World/)).toBeTruthy();
      });
    });
  });

  // ── View/Edit toggle ─────────────────────────────────────────────────

  describe('view/edit toggle', () => {
    it('shows View and Edit toggle buttons', async () => {
      wikiState.setSelectedPath('test.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        expect(screen.getByText('View')).toBeTruthy();
        expect(screen.getByText('Edit')).toBeTruthy();
      });
    });

    it('switches to edit mode when Edit is clicked', async () => {
      wikiState.setSelectedPath('test.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('Edit'));

      // In edit mode, a textarea/editor should appear
      await waitFor(() => {
        // The SimpleEditor renders a textarea with the file content
        const textarea = document.querySelector('textarea');
        expect(textarea).toBeTruthy();
      });
    });
  });

  // ── Header elements ──────────────────────────────────────────────────

  describe('header elements', () => {
    it('shows back button (disabled when no history)', async () => {
      wikiState.setSelectedPath('test.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        const backButton = screen.getByTitle('Go back');
        expect(backButton).toBeTruthy();
        expect(backButton).toHaveProperty('disabled', true);
      });
    });

    it('shows Send to Agent button', async () => {
      wikiState.setSelectedPath('test.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        expect(screen.getByText(/Send/)).toBeTruthy();
      });
    });
  });

  // ── Breadcrumb ───────────────────────────────────────────────────────

  describe('breadcrumb', () => {
    it('shows breadcrumb for nested paths', async () => {
      wikiState.setSelectedPath('docs/getting-started.md');

      render(<WikiViewer api={api} />);

      await waitFor(() => {
        // Should show breadcrumb path
        expect(screen.getByText(/docs/)).toBeTruthy();
      });
    });
  });
});
