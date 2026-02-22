/**
 * Theme-aware style constants using CSS custom properties.
 * All colors adapt to the host app's active theme.
 */

export const font = {
  family: 'var(--font-family, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

export const color = {
  text: 'var(--text-primary, #cdd6f4)',
  textSecondary: 'var(--text-secondary, #bac2de)',
  textTertiary: 'var(--text-tertiary, #a6adc8)',
  textMuted: 'var(--text-muted, #6c7086)',

  bg: 'var(--bg-primary, #1e1e2e)',
  bgSecondary: 'var(--bg-secondary, #181825)',
  bgTertiary: 'var(--bg-tertiary, #11111b)',
  bgSurface: 'var(--bg-surface, #313244)',
  bgSurfaceHover: 'var(--bg-surface-hover, #45475a)',
  bgSurfaceRaised: 'var(--bg-surface-raised, #585b70)',
  bgActive: 'var(--bg-active, #45475a)',

  border: 'var(--border-primary, #313244)',
  borderSecondary: 'var(--border-secondary, #45475a)',

  accent: 'var(--text-accent, #89b4fa)',
  accentBg: 'var(--bg-accent, rgba(137, 180, 250, 0.15))',
  accentBorder: 'var(--border-accent, rgba(137, 180, 250, 0.3))',

  success: 'var(--text-success, #a6e3a1)',
  successBg: 'var(--bg-success, rgba(166, 227, 161, 0.15))',

  warning: 'var(--text-warning, #f9e2af)',
  warningBg: 'var(--bg-warning, rgba(249, 226, 175, 0.15))',

  error: 'var(--text-error, #f38ba8)',
  errorBg: 'var(--bg-error, rgba(243, 139, 168, 0.1))',
  errorBorder: 'rgba(243, 139, 168, 0.3)',

  blue: 'var(--text-info, #89b4fa)',
  blueBg: 'var(--bg-info, rgba(137, 180, 250, 0.15))',
  blueBorder: 'var(--border-info, rgba(137, 180, 250, 0.3))',
};

// ── Common style patterns ──────────────────────────────────────────────

export const container: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  background: color.bg,
  fontFamily: font.family,
  color: color.text,
};

export const sidebar: React.CSSProperties = {
  width: 256,
  flexShrink: 0,
  borderRight: `1px solid ${color.border}`,
  background: color.bgSecondary,
  display: 'flex',
  flexDirection: 'column',
};

export const sidebarHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: `1px solid ${color.border}`,
};

export const baseInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 12px',
  fontSize: 13,
  borderRadius: 8,
  background: color.bgSecondary,
  border: `1px solid ${color.bgSurfaceRaised}`,
  color: color.text,
  outline: 'none',
  fontFamily: font.family,
};

export const baseButton: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  color: color.textTertiary,
  cursor: 'pointer',
  fontFamily: font.family,
};

export const accentButton: React.CSSProperties = {
  ...baseButton,
  background: color.accent,
  color: 'var(--text-on-accent, #fff)',
  fontWeight: 500,
};

export const dangerButton: React.CSSProperties = {
  ...baseButton,
  color: color.error,
  border: `1px solid ${color.errorBorder}`,
};

export const label: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: color.textSecondary,
  marginBottom: 4,
};

export const section: React.CSSProperties = {
  padding: 16,
  borderBottom: `1px solid ${color.border}`,
};

export const statusDot = (status: 'running' | 'completed' | 'failed'): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
  background:
    status === 'running' ? color.warning :
    status === 'completed' ? color.success :
    color.error,
});

export const statusText = (status: 'running' | 'completed' | 'failed'): React.CSSProperties => ({
  fontSize: 10,
  flexShrink: 0,
  color:
    status === 'running' ? color.warning :
    status === 'completed' ? color.success :
    color.error,
});

export const badge = (variant: 'off' | 'on' | 'running'): React.CSSProperties => ({
  fontSize: 9,
  padding: '1px 4px',
  borderRadius: 4,
  flexShrink: 0,
  background:
    variant === 'off' ? color.bgSurfaceRaised :
    variant === 'running' ? color.successBg :
    color.blueBg,
  color:
    variant === 'off' ? color.textTertiary :
    variant === 'running' ? color.success :
    color.blue,
});
