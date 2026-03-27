/**
 * Theme-aware style constants using CSS custom properties.
 * All colors adapt to the host app's active theme.
 */

export const font = {
  family: 'var(--font-family, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

export const color = {
  text: 'var(--text-primary, #333333)',
  textSecondary: 'var(--text-secondary, #666666)',
  textTertiary: 'var(--text-tertiary, #999999)',
  textMuted: 'var(--text-muted, #aaaaaa)',

  bg: 'var(--bg-primary, #f5f5f5)',
  bgSecondary: 'var(--bg-secondary, #ebebeb)',
  bgTertiary: 'var(--bg-tertiary, #e0e0e0)',
  bgSurface: 'var(--bg-surface, #d9d9d9)',
  bgSurfaceHover: 'var(--bg-surface-hover, #cccccc)',
  bgSurfaceRaised: 'var(--bg-surface-raised, #bbbbbb)',
  bgActive: 'var(--bg-active, #cccccc)',

  border: 'var(--border-primary, #d9d9d9)',
  borderSecondary: 'var(--border-secondary, #cccccc)',

  accent: 'var(--text-accent, #0066cc)',
  accentBg: 'var(--bg-accent, rgba(0, 102, 204, 0.1))',
  accentBorder: 'var(--border-accent, rgba(0, 102, 204, 0.3))',

  success: 'var(--text-success, #339933)',
  successBg: 'var(--bg-success, rgba(51, 153, 51, 0.1))',

  warning: 'var(--text-warning, #cc8800)',
  warningBg: 'var(--bg-warning, rgba(204, 136, 0, 0.1))',

  error: 'var(--text-error, #cc3333)',
  errorBg: 'var(--bg-error, rgba(204, 51, 51, 0.1))',
  errorBorder: 'var(--border-error, rgba(204, 51, 51, 0.3))',

  blue: 'var(--text-info, #0066cc)',
  blueBg: 'var(--bg-info, rgba(0, 102, 204, 0.1))',
  blueBorder: 'var(--border-info, rgba(0, 102, 204, 0.3))',
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
