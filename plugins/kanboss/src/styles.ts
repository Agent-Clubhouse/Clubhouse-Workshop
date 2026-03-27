/**
 * Shared style constants using CSS custom properties for theming.
 * All colors adapt to the host app's theme.
 */

export const font = {
  family: 'var(--font-family, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

export const color = {
  // Text
  text: 'var(--text-primary, #333333)',
  textSecondary: 'var(--text-secondary, #666666)',
  textTertiary: 'var(--text-tertiary, #999999)',
  textError: 'var(--text-error, #cc3333)',
  textSuccess: 'var(--text-success, #339933)',
  textWarning: 'var(--text-warning, #cc8800)',
  textInfo: 'var(--text-info, #0066cc)',
  textAccent: 'var(--text-accent, #0066cc)',
  textOnBadge: 'var(--text-on-badge, #ffffff)',

  // Backgrounds
  bg: 'var(--bg-primary, #f5f5f5)',
  bgSecondary: 'var(--bg-secondary, #ebebeb)',
  bgTertiary: 'var(--bg-tertiary, #e0e0e0)',
  bgActive: 'var(--bg-active, #d9d9d9)',
  bgError: 'var(--bg-error, #f5e6e6)',
  bgSuccess: 'var(--bg-success, rgba(51, 153, 51, 0.1))',
  bgInfo: 'var(--bg-info, rgba(0, 102, 204, 0.1))',
  bgErrorSubtle: 'var(--bg-error-subtle, rgba(204, 51, 51, 0.05))',

  // Borders
  border: 'var(--border-primary, #cccccc)',
  borderSecondary: 'var(--border-secondary, #bbbbbb)',
  borderError: 'var(--border-error, rgba(204, 51, 51, 0.3))',
  borderInfo: 'var(--border-info, rgba(0, 102, 204, 0.3))',

  // Accent
  accent: 'var(--text-accent, #0066cc)',
  accentBg: 'var(--bg-accent, rgba(0, 102, 204, 0.1))',

  // Glows (card state indicators)
  glowError: 'var(--glow-error, rgba(204, 51, 51, 0.3))',
  glowAccent: 'var(--glow-accent, rgba(0, 102, 204, 0.3))',

  // Shadows & overlays
  shadow: 'var(--shadow, rgba(0, 0, 0, 0.2))',
  shadowLight: 'var(--shadow-light, rgba(0, 0, 0, 0.1))',
  shadowHeavy: 'var(--shadow-heavy, rgba(0, 0, 0, 0.3))',
  overlay: 'var(--overlay, rgba(0, 0, 0, 0.3))',
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
  color: color.textOnBadge,
  fontWeight: 500,
};

export const dangerButton: React.CSSProperties = {
  ...baseButton,
  color: color.textError,
  borderColor: color.borderError,
};

export const overlay: React.CSSProperties = {
  position: 'fixed',
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
  boxShadow: `0 25px 50px -12px ${color.shadowHeavy}`,
  width: '100%',
  maxWidth: 480,
  margin: '0 16px',
};

export const dialogWide: React.CSSProperties = {
  ...dialog,
  maxWidth: 640,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
};
