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
    '--text-primary': c.text,
    '--text-secondary': c.subtext1,
    '--text-tertiary': c.subtext0,
    '--text-muted': c.surface2,
    '--text-error': c.error,
    '--text-success': c.success,
    '--text-warning': c.warning,
    '--text-info': c.info,
    '--text-accent': c.accent,
    '--text-on-accent': onAccent,
    '--bg-primary': c.base,
    '--bg-secondary': c.mantle,
    '--bg-tertiary': c.crust,
    '--bg-surface': c.surface0,
    '--bg-surface-hover': c.surface1,
    '--bg-surface-raised': c.surface2,
    '--bg-active': c.surface1,
    '--bg-error': hexToRgba(c.error, 0.1),
    '--bg-success': hexToRgba(c.success, 0.15),
    '--bg-warning': hexToRgba(c.warning, 0.15),
    '--bg-info': hexToRgba(c.info, 0.1),
    '--bg-accent': hexToRgba(c.accent, 0.15),
    '--border-primary': c.surface0,
    '--border-secondary': c.surface1,
    '--border-accent': hexToRgba(c.accent, 0.3),
    '--shadow': 'rgba(0, 0, 0, 0.3)',
    '--shadow-light': 'rgba(0, 0, 0, 0.15)',
    '--font-family': 'system-ui, -apple-system, sans-serif',
    '--font-mono': 'ui-monospace, monospace',
  };
}

export function useTheme(themeApi: ThemeAPI): { style: Record<string, string>; themeType: 'dark' | 'light' } {
  const React = globalThis.React;
  const [theme, setTheme] = React.useState<ThemeInfo>(() => themeApi.getCurrent());

  React.useEffect(() => {
    setTheme(themeApi.getCurrent());
    const disposable = themeApi.onDidChange((t: ThemeInfo) => setTheme(t));
    return () => disposable.dispose();
  }, [themeApi]);

  const style = React.useMemo(() => mapThemeToCSS(theme), [theme]);

  return { style, themeType: theme.type };
}
