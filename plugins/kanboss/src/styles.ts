/**
 * Shared style constants using CSS custom properties for theming.
 * All colors adapt to the host app's theme.
 */

export const font = {
  family: 'var(--font-family, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, monospace)',
};

export const color = {
  text: 'var(--text-primary, #e4e4e7)',
  textSecondary: 'var(--text-secondary, #a1a1aa)',
  textTertiary: 'var(--text-tertiary, #71717a)',
  textError: 'var(--text-error, #f87171)',
  textSuccess: '#22c55e',
  textAccent: 'var(--text-accent, #8b5cf6)',

  bg: 'var(--bg-primary, #18181b)',
  bgSecondary: 'var(--bg-secondary, #27272a)',
  bgTertiary: 'var(--bg-tertiary, #333338)',
  bgActive: 'var(--bg-active, #3f3f46)',
  bgError: 'var(--bg-error, #2a1515)',

  border: 'var(--border-primary, #3f3f46)',
  borderSecondary: 'var(--border-secondary, #52525b)',
  accent: 'var(--text-accent, #8b5cf6)',
  accentBg: 'var(--bg-accent, rgba(139, 92, 246, 0.15))',
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
  color: '#fff',
  fontWeight: 500,
};

export const dangerButton: React.CSSProperties = {
  ...baseButton,
  color: color.textError,
  borderColor: 'rgba(248, 113, 113, 0.3)',
};

export const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

export const dialog: React.CSSProperties = {
  background: color.bg,
  border: `1px solid ${color.border}`,
  borderRadius: 12,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
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
