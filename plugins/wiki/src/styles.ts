/**
 * Shared style constants using CSS custom properties for theming.
 * All colors adapt to the host app's theme.
 */

export const font = {
  family: 'var(--font-family, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

export const color = {
  text: 'var(--text-primary, #333333)',
  textSecondary: 'var(--text-secondary, #666666)',
  textTertiary: 'var(--text-tertiary, #999999)',
  textError: 'var(--text-error, #cc3333)',
  textSuccess: 'var(--text-success, #339933)',
  textAccent: 'var(--text-accent, #0066cc)',
  textWarning: 'var(--text-warning, #cc8800)',

  bg: 'var(--bg-primary, #f5f5f5)',
  bgSecondary: 'var(--bg-secondary, #ebebeb)',
  bgTertiary: 'var(--bg-tertiary, #e0e0e0)',
  bgActive: 'var(--bg-active, #d9d9d9)',
  bgError: 'var(--bg-error, #f5e6e6)',

  border: 'var(--border-primary, #cccccc)',
  borderSecondary: 'var(--border-secondary, #bbbbbb)',
  accent: 'var(--text-accent, #0066cc)',
  accentBg: 'var(--bg-accent, rgba(0, 102, 204, 0.1))',

  // Status badge backgrounds
  bgSuccess: 'var(--bg-success, rgba(51, 153, 51, 0.15))',
  bgWarning: 'var(--bg-warning, rgba(204, 136, 0, 0.15))',
  bgErrorSubtle: 'var(--bg-error-subtle, rgba(204, 51, 51, 0.15))',

  // Overlay & shadow
  overlay: 'var(--bg-overlay, rgba(0, 0, 0, 0.3))',
  shadow: 'var(--shadow-color, rgba(0, 0, 0, 0.2))',
  shadowMenu: 'var(--shadow-menu, rgba(0, 0, 0, 0.15))',

  // Text on accent backgrounds
  textOnAccent: 'var(--text-on-accent, #ffffff)',

  // File icon colors by extension
  blue: 'var(--color-blue, #3b82f6)',
  green: 'var(--color-green, #22c55e)',
  yellow: 'var(--color-yellow, #eab308)',
  orange: 'var(--color-orange, #f97316)',
  red: 'var(--color-red, #ef4444)',
  purple: 'var(--color-purple, #a855f7)',
  cyan: 'var(--color-cyan, #06b6d4)',
};

// Common style patterns
export const baseInput: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 12,
  borderRadius: 8,
  background: color.bgSecondary,
  border: `1px solid ${color.border}`,
  color: color.text,
  outline: 'none',
  fontFamily: font.family,
};

export const baseButton: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 12,
  borderRadius: 8,
  border: `1px solid ${color.border}`,
  background: 'transparent',
  color: color.textSecondary,
  cursor: 'pointer',
  fontFamily: font.family,
};

export const accentButton: React.CSSProperties = {
  ...baseButton,
  background: color.accent,
  border: 'none',
  color: color.textOnAccent,
  fontWeight: 500,
};

export const dangerButton: React.CSSProperties = {
  ...baseButton,
  color: color.textError,
  borderColor: 'var(--border-error, rgba(248, 113, 113, 0.3))',
};

export const overlay: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: color.overlay,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

export const dialog: React.CSSProperties = {
  background: color.bg,
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  boxShadow: `0 25px 50px -12px ${color.shadow}`,
  width: '100%',
  maxWidth: 480,
  margin: '0 16px',
  padding: 16,
};
