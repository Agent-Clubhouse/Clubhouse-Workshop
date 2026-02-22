const React = globalThis.React;
const { useState, useEffect, useCallback, useRef } = React;

import type { PluginAPI, FilesAPI, FileNode } from '@clubhouse/plugin-types';
import { wikiState } from './state';
import { WikiMarkdownPreview } from './WikiMarkdownPreview';
import { SendToAgentDialog } from './SendToAgentDialog';
import { color, font, overlay, dialog } from './styles';

// ── Helpers ────────────────────────────────────────────────────────────

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

function prettifyName(name: string, wikiStyle: string = 'github'): string {
  let base = name.replace(/\.md$/i, '');
  if (wikiStyle === 'ado') {
    base = base.replace(/%2D/gi, '\x00').replace(/-/g, ' ').replace(/\x00/g, '-');
  } else {
    base = base.replace(/[-_]/g, ' ');
  }
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getBreadcrumb(path: string): string {
  return path.replace(/\//g, ' / ');
}

// ── Collect markdown files from a FileNode tree ────────────────────────

function collectMarkdownFiles(nodes: FileNode[], result: { name: string; path: string }[]): void {
  for (const node of nodes) {
    if (node.isDirectory) {
      if (node.children) {
        collectMarkdownFiles(node.children, result);
      }
    } else if (node.name.endsWith('.md')) {
      result.push({ name: node.name, path: node.path });
    }
  }
}

// ── Simple Code Editor (replaces MonacoEditor) ────────────────────────

interface SimpleEditorProps {
  value: string;
  onSave: (content: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  filePath: string;
}

function SimpleEditor({ value, onSave, onDirtyChange, filePath }: SimpleEditorProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialValueRef = useRef(value);

  // Update when a new file is loaded
  useEffect(() => {
    setCurrentValue(value);
    initialValueRef.current = value;
  }, [value, filePath]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setCurrentValue(newValue);
    onDirtyChange(newValue !== initialValueRef.current);
  }, [onDirtyChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+S or Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave(currentValue);
      initialValueRef.current = currentValue;
      onDirtyChange(false);
    }
    // Tab key inserts spaces instead of focus change
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newValue = currentValue.substring(0, start) + '  ' + currentValue.substring(end);
        setCurrentValue(newValue);
        onDirtyChange(newValue !== initialValueRef.current);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    }
  }, [currentValue, onSave, onDirtyChange]);

  return React.createElement('textarea', {
    ref: textareaRef,
    value: currentValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    spellCheck: false,
    style: {
      width: '100%',
      height: '100%',
      padding: 16,
      fontSize: 13,
      lineHeight: 1.6,
      fontFamily: font.mono,
      color: color.text,
      background: color.bg,
      border: 'none',
      outline: 'none',
      resize: 'none',
      tabSize: 2,
    },
  });
}

// ── Unsaved Changes Dialog ────────────────────────────────────────────

interface UnsavedDialogProps {
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

function UnsavedDialog({ fileName, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  return React.createElement('div', {
    style: overlay,
  },
    React.createElement('div', {
      style: { ...dialog, maxWidth: 360 },
    },
      React.createElement('p', { style: { fontSize: 14, color: color.text, marginBottom: 16 } },
        `"${fileName}" has unsaved changes.`,
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
        React.createElement('button', {
          style: { padding: '4px 12px', fontSize: 12, color: color.textSecondary, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: font.family },
          onClick: onCancel,
        }, 'Cancel'),
        React.createElement('button', {
          style: { padding: '4px 12px', fontSize: 12, color: color.textError, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: font.family },
          onClick: onDiscard,
        }, 'Discard'),
        React.createElement('button', {
          style: { padding: '4px 12px', fontSize: 12, background: color.accent, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: font.family },
          onClick: onSave,
        }, 'Save'),
      ),
    ),
  );
}

// ── WikiViewer (MainPanel) ────────────────────────────────────────────

export function WikiViewer({ api }: { api: PluginAPI }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(wikiState.selectedPath);
  const [content, setContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'view' | 'edit'>(wikiState.viewMode);
  const [isDirty, setIsDirty] = useState(wikiState.isDirty);
  const [loading, setLoading] = useState(false);
  const [unsavedDialog, setUnsavedDialog] = useState<{ pendingPath: string } | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [pageNames, setPageNames] = useState<string[]>([]);
  const [canGoBack, setCanGoBack] = useState(wikiState.canGoBack());

  const contentRef = useRef(content);
  contentRef.current = content;

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const selectedPathRef = useRef(selectedPath);
  selectedPathRef.current = selectedPath;

  const wikiFilesRef = useRef<FilesAPI | null>(null);
  const pagePathMapRef = useRef<Map<string, string>>(new Map());
  const wikiStyle = api.settings.get<string>('wikiStyle') || 'github';

  // Obtain scoped files API
  const getScopedFiles = useCallback((): FilesAPI | null => {
    try {
      const scoped = api.files.forRoot('wiki');
      wikiFilesRef.current = scoped;
      return scoped;
    } catch {
      wikiFilesRef.current = null;
      return null;
    }
  }, [api]);

  // Load page names from the wiki root
  const loadPageNames = useCallback(async () => {
    const scoped = getScopedFiles();
    if (!scoped) {
      setPageNames([]);
      pagePathMapRef.current = new Map();
      return;
    }

    try {
      const tree = await scoped.readTree('.', { depth: 10 });
      const files: { name: string; path: string }[] = [];
      collectMarkdownFiles(tree, files);

      const names: string[] = [];
      const pathMap = new Map<string, string>();

      for (const file of files) {
        const baseName = file.name.replace(/\.md$/i, '');
        names.push(baseName);
        // Map by basename (for GitHub [[wiki links]])
        pathMap.set(baseName.toLowerCase(), file.path);
        // Also map by relative path without extension (for ADO path-based links)
        const pathWithoutExt = file.path.replace(/\.md$/i, '').toLowerCase();
        pathMap.set(pathWithoutExt, file.path);
      }

      setPageNames(names);
      pagePathMapRef.current = pathMap;
    } catch {
      setPageNames([]);
      pagePathMapRef.current = new Map();
    }
  }, [getScopedFiles]);

  // Handle wiki link navigation
  const handleWikiNavigate = useCallback((pageName: string) => {
    const key = pageName.toLowerCase();
    // Try direct match (works for both basename and path-based lookup)
    const match = pagePathMapRef.current.get(key);
    if (match) {
      wikiState.setSelectedPath(match);
      return;
    }
    // For ADO-style, also try with .md appended and path variations
    const withMd = pagePathMapRef.current.get(key.replace(/\.md$/i, ''));
    if (withMd) {
      wikiState.setSelectedPath(withMd);
      return;
    }
    // Try matching just the last segment (page name) for cross-directory links
    const lastSegment = key.split('/').pop() || key;
    const fallback = pagePathMapRef.current.get(lastSegment);
    if (fallback) {
      wikiState.setSelectedPath(fallback);
    }
  }, []);

  // Load file content
  const loadFile = useCallback(async (path: string) => {
    setLoading(true);
    const scoped = getScopedFiles();
    if (!scoped) {
      setContent('');
      setLoading(false);
      return;
    }

    try {
      const text = await scoped.readFile(path);
      setContent(text);
    } catch {
      setContent('');
    }
    setLoading(false);
  }, [getScopedFiles]);

  // Load page names on mount
  useEffect(() => {
    loadPageNames();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload page names on refreshCount changes
  useEffect(() => {
    return wikiState.subscribe(() => {
      loadPageNames();
    });
  }, [loadPageNames]);

  // Load initial file if selectedPath is already set on mount
  useEffect(() => {
    if (selectedPath) {
      loadFile(selectedPath);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle file selection with unsaved changes check
  const switchToFile = useCallback((newPath: string | null) => {
    if (!newPath) {
      setSelectedPath(null);
      setContent('');
      return;
    }

    if (isDirtyRef.current && selectedPathRef.current) {
      setUnsavedDialog({ pendingPath: newPath });
      return;
    }

    setSelectedPath(newPath);
    selectedPathRef.current = newPath;
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(newPath);
  }, [loadFile]);

  // Subscribe to wikiState changes
  useEffect(() => {
    return wikiState.subscribe(() => {
      const newPath = wikiState.selectedPath;
      if (newPath !== selectedPathRef.current) {
        switchToFile(newPath);
      }
      setViewMode(wikiState.viewMode);
      setCanGoBack(wikiState.canGoBack());
    });
  }, [switchToFile]);

  // Save file
  const saveFile = useCallback(async () => {
    if (!selectedPath) return;
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    try {
      await scoped.writeFile(selectedPath, contentRef.current);
      setIsDirty(false);
      wikiState.setDirty(false);
    } catch (err) {
      api.ui.showError(`Failed to save: ${err}`);
    }
  }, [api, selectedPath]);

  // Handle dirty change from editor
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
    wikiState.setDirty(dirty);
  }, []);

  // Handle save from editor (Cmd+S)
  const handleSave = useCallback(async (newContent: string) => {
    if (!selectedPath) return;
    const scoped = wikiFilesRef.current;
    if (!scoped) return;
    try {
      setContent(newContent);
      await scoped.writeFile(selectedPath, newContent);
      setIsDirty(false);
      wikiState.setDirty(false);
    } catch (err) {
      api.ui.showError(`Failed to save: ${err}`);
    }
  }, [api, selectedPath]);

  // View/Edit mode toggle
  const handleToggleMode = useCallback((mode: 'view' | 'edit') => {
    setViewMode(mode);
    wikiState.setViewMode(mode);
  }, []);

  // Back navigation
  const handleGoBack = useCallback(() => {
    wikiState.goBack();
  }, []);

  // Unsaved dialog handlers
  const handleDialogSave = useCallback(async () => {
    if (!unsavedDialog) return;
    await saveFile();
    const pendingPath = unsavedDialog.pendingPath;
    setUnsavedDialog(null);
    setSelectedPath(pendingPath);
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(pendingPath);
  }, [unsavedDialog, saveFile, loadFile]);

  const handleDialogDiscard = useCallback(() => {
    if (!unsavedDialog) return;
    const pendingPath = unsavedDialog.pendingPath;
    setUnsavedDialog(null);
    setSelectedPath(pendingPath);
    setIsDirty(false);
    wikiState.setDirty(false);
    loadFile(pendingPath);
  }, [unsavedDialog, loadFile]);

  const handleDialogCancel = useCallback(() => {
    setUnsavedDialog(null);
  }, []);

  // Toggle button style helper
  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    background: active ? color.bgActive : 'transparent',
    color: active ? color.text : color.textSecondary,
    border: 'none',
    cursor: 'pointer',
    fontFamily: font.family,
  });

  // ── Empty state ────────────────────────────────────────────────────

  if (!selectedPath) {
    return React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: color.textSecondary, fontFamily: font.family },
    },
      React.createElement('svg', {
        width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { marginBottom: 12, opacity: 0.5 },
      },
        React.createElement('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
        React.createElement('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
      ),
      React.createElement('p', { style: { fontSize: 12 } }, 'Select a page to view'),
      React.createElement('p', { style: { fontSize: 10, marginTop: 4, opacity: 0.6 } }, 'Click a page in the sidebar'),
    );
  }

  if (loading) {
    return React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: color.textSecondary, fontSize: 12, fontFamily: font.family },
    }, 'Loading...');
  }

  const fileName = getFileName(selectedPath);
  const displayName = viewMode === 'view' ? prettifyName(fileName, wikiStyle) : fileName;

  // Header
  const header = React.createElement('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: `1px solid ${color.border}`, background: color.bgSecondary, flexShrink: 0, fontFamily: font.family },
  },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
      // Back button
      React.createElement('button', {
        style: {
          padding: 2,
          borderRadius: 4,
          flexShrink: 0,
          color: canGoBack ? color.textSecondary : color.bgTertiary,
          cursor: canGoBack ? 'pointer' : 'default',
          background: 'transparent',
          border: 'none',
        },
        onClick: canGoBack ? handleGoBack : undefined,
        disabled: !canGoBack,
        title: 'Go back',
      },
        React.createElement('svg', {
          width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none',
          stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          React.createElement('polyline', { points: '15 18 9 12 15 6' }),
        ),
      ),
      React.createElement('span', { style: { fontSize: 12, fontWeight: 500, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, displayName),
      isDirty
        ? React.createElement('span', {
            style: { width: 8, height: 8, borderRadius: '50%', background: color.orange, flexShrink: 0 },
            title: 'Unsaved changes',
          })
        : null,
    ),
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
      // View/Edit toggle
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', background: color.bgTertiary, borderRadius: 4 } },
        React.createElement('button', {
          style: toggleBtnStyle(viewMode === 'view'),
          onClick: () => handleToggleMode('view'),
        }, 'View'),
        React.createElement('button', {
          style: toggleBtnStyle(viewMode === 'edit'),
          onClick: () => handleToggleMode('edit'),
        }, 'Edit'),
      ),
      // Send to Agent
      React.createElement('button', {
        style: { padding: '2px 8px', fontSize: 10, color: color.accent, background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: font.family },
        onClick: () => setShowSendDialog(true),
      }, 'Send to Agent'),
      // Breadcrumb
      React.createElement('span', {
        style: { fontSize: 10, color: color.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 },
        title: selectedPath,
      }, getBreadcrumb(selectedPath)),
    ),
  );

  // Body
  let body: React.ReactElement;

  if (viewMode === 'view') {
    body = React.createElement('div', { style: { flex: 1, minHeight: 0, overflow: 'auto' } },
      React.createElement(WikiMarkdownPreview, { content, pageNames, onNavigate: handleWikiNavigate, wikiStyle }),
    );
  } else {
    body = React.createElement('div', { style: { flex: 1, minHeight: 0 } },
      React.createElement(SimpleEditor, {
        value: content,
        onSave: handleSave,
        onDirtyChange: handleDirtyChange,
        filePath: selectedPath,
      }),
    );
  }

  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', height: '100%', background: color.bg, position: 'relative', fontFamily: font.family },
  },
    header,
    body,
    // Unsaved changes dialog
    unsavedDialog
      ? React.createElement(UnsavedDialog, {
          fileName: displayName,
          onSave: handleDialogSave,
          onDiscard: handleDialogDiscard,
          onCancel: handleDialogCancel,
        })
      : null,
    // Send to Agent dialog
    showSendDialog
      ? React.createElement(SendToAgentDialog, {
          api,
          filePath: selectedPath,
          content,
          onClose: () => setShowSendDialog(false),
        })
      : null,
  );
}
