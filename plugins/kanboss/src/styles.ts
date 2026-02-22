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
  text: 'var(--text-primary, #e4e4e7)',
  textSecondary: 'var(--text-secondary, #a1a1aa)',
  textTertiary: 'var(--text-tertiary, #71717a)',
  textError: 'var(--text-error, #f87171)',
  textSuccess: 'var(--text-success, #22c55e)',
  textWarning: 'var(--text-warning, #eab308)',
  textInfo: 'var(--text-info, #3b82f6)',
  textAccent: 'var(--text-accent, #8b5cf6)',
  textOnBadge: 'var(--text-on-badge, #fff)',

  // Backgrounds
  bg: 'var(--bg-primary, #18181b)',
  bgSecondary: 'var(--bg-secondary, #27272a)',
  bgTertiary: 'var(--bg-tertiary, #333338)',
  bgActive: 'var(--bg-active, #3f3f46)',
  bgError: 'var(--bg-error, #2a1515)',
  bgSuccess: 'var(--bg-success, rgba(34, 197, 94, 0.15))',
  bgInfo: 'var(--bg-info, rgba(59, 130, 246, 0.1))',
  bgErrorSubtle: 'var(--bg-error-subtle, rgba(248, 113, 113, 0.05))',

  // Borders
  border: 'var(--border-primary, #3f3f46)',
  borderSecondary: 'var(--border-secondary, #52525b)',
  borderError: 'var(--border-error, rgba(248, 113, 113, 0.3))',
  borderInfo: 'var(--border-info, rgba(59, 130, 246, 0.3))',

  // Accent
  accent: 'var(--text-accent, #8b5cf6)',
  accentBg: 'var(--bg-accent, rgba(139, 92, 246, 0.15))',

  // Glows (card state indicators)
  glowError: 'var(--glow-error, rgba(248, 113, 113, 0.3))',
  glowAccent: 'var(--glow-accent, rgba(139, 92, 246, 0.3))',

  // Shadows & overlays
  shadow: 'var(--shadow, rgba(0, 0, 0, 0.3))',
  shadowLight: 'var(--shadow-light, rgba(0, 0, 0, 0.15))',
  shadowHeavy: 'var(--shadow-heavy, rgba(0, 0, 0, 0.5))',
  overlay: 'var(--overlay, rgba(0, 0, 0, 0.5))',
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
