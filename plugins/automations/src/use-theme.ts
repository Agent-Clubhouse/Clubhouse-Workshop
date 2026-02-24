/**
 * React hook that bridges the Clubhouse ThemeAPI to CSS custom properties.
 *
 * Usage:
 *   const { style, themeType } = useTheme(api.theme);
 *   return <div style={{ ...style, height: '100%' }}>...</div>;
 *
 * CSS variables set on the root element cascade to all children,
 * so existing var(--token, fallback) references resolve dynamically.
 */
const React = globalThis.React;
const { useState, useEffect, useMemo } = React;

import type { ThemeAPI, ThemeInfo } from '@clubhouse/plugin-types';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mapThemeToCSS(theme: ThemeInfo): Record<string, string> {
  const c = theme.colors;
  const onAccent = theme.type === 'dark' ? '#ffffff' : '#000000';
  return {
    // Text
    '--text-primary': c.text,
    '--text-secondary': c.subtext1,
    '--text-tertiary': c.subtext0,
    '--text-muted': c.surface2,
    '--text-error': c.error,
    '--text-success': c.success,
    '--text-warning': c.warning,
    '--text-info': c.info,
    '--text-accent': c.accent,
    '--text-on-badge': onAccent,
    '--text-on-accent': onAccent,
    // Backgrounds
    '--bg-primary': c.base,
    '--bg-secondary': c.mantle,
    '--bg-tertiary': c.crust,
    '--bg-surface': c.surface0,
    '--bg-surface-hover': c.surface1,
    '--bg-surface-raised': c.surface2,
    '--bg-active': c.surface1,
    '--bg-error': hexToRgba(c.error, 0.1),
    '--bg-error-subtle': hexToRgba(c.error, 0.05),
    '--bg-success': hexToRgba(c.success, 0.15),
    '--bg-warning': hexToRgba(c.warning, 0.15),
    '--bg-info': hexToRgba(c.info, 0.1),
    '--bg-accent': hexToRgba(c.accent, 0.15),
    '--bg-overlay': 'rgba(0, 0, 0, 0.5)',
    // Borders
    '--border-primary': c.surface0,
    '--border-secondary': c.surface1,
    '--border-error': hexToRgba(c.error, 0.3),
    '--border-info': hexToRgba(c.info, 0.3),
    '--border-accent': hexToRgba(c.accent, 0.3),
    // Shadows & overlays
    '--shadow': 'rgba(0, 0, 0, 0.3)',
    '--shadow-light': 'rgba(0, 0, 0, 0.15)',
    '--shadow-heavy': 'rgba(0, 0, 0, 0.5)',
    '--shadow-menu': 'rgba(0, 0, 0, 0.3)',
    '--shadow-color': 'rgba(0, 0, 0, 0.5)',
    '--overlay': 'rgba(0, 0, 0, 0.5)',
    '--glow-error': hexToRgba(c.error, 0.3),
    '--glow-accent': hexToRgba(c.accent, 0.3),
    // Fonts
    '--font-family': 'system-ui, -apple-system, sans-serif',
    '--font-mono': 'ui-monospace, monospace',
    // Color aliases (file icons, labels, etc.)
    '--color-blue': c.info,
    '--color-green': c.success,
    '--color-yellow': c.warning,
    '--color-orange': c.warning,
    '--color-red': c.error,
    '--color-purple': c.accent,
    '--color-cyan': c.info,
  };
}

export function useTheme(themeApi: ThemeAPI): { style: React.CSSProperties; themeType: 'dark' | 'light' } {
  const [theme, setTheme] = useState<ThemeInfo>(() => themeApi.getCurrent());

  useEffect(() => {
    // Sync in case theme changed between initial render and effect
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t: ThemeInfo) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);

  const style = useMemo(
    () => mapThemeToCSS(theme) as unknown as React.CSSProperties,
    [theme],
  );

  return { style, themeType: theme.type };
}
