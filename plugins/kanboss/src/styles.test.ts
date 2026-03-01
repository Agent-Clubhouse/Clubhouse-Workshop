import { describe, it, expect } from 'vitest';
import { color, accentButton, dangerButton, overlay, dialog } from './styles';

const cssVarPattern = /^var\(--[\w-]+,\s*.+\)$/;

describe('color tokens', () => {
  const themeColors = { ...color };

  it('all color tokens use CSS custom properties with fallbacks', () => {
    for (const [key, value] of Object.entries(themeColors)) {
      expect(value, `color.${key} should use a CSS variable`).toMatch(cssVarPattern);
    }
  });

  it('includes semantic text tokens', () => {
    expect(color.textSuccess).toMatch(cssVarPattern);
    expect(color.textWarning).toMatch(cssVarPattern);
    expect(color.textInfo).toMatch(cssVarPattern);
    expect(color.textOnBadge).toMatch(cssVarPattern);
  });

  it('includes semantic background tokens', () => {
    expect(color.bgSuccess).toMatch(cssVarPattern);
    expect(color.bgInfo).toMatch(cssVarPattern);
    expect(color.bgErrorSubtle).toMatch(cssVarPattern);
  });

  it('includes semantic border tokens', () => {
    expect(color.borderError).toMatch(cssVarPattern);
    expect(color.borderInfo).toMatch(cssVarPattern);
  });

  it('includes glow tokens for card state indicators', () => {
    expect(color.glowError).toMatch(cssVarPattern);
    expect(color.glowAccent).toMatch(cssVarPattern);
  });

  it('includes shadow and overlay tokens', () => {
    expect(color.shadow).toMatch(cssVarPattern);
    expect(color.shadowLight).toMatch(cssVarPattern);
    expect(color.shadowHeavy).toMatch(cssVarPattern);
    expect(color.overlay).toMatch(cssVarPattern);
  });
});

describe('style patterns use color tokens', () => {
  it('accentButton uses textOnBadge instead of hardcoded #fff', () => {
    expect(accentButton.color).toBe(color.textOnBadge);
    expect(accentButton.color).not.toBe('#fff');
  });

  it('dangerButton uses borderError token', () => {
    expect(dangerButton.borderColor).toBe(color.borderError);
  });

  it('overlay uses overlay token', () => {
    expect(overlay.background).toBe(color.overlay);
  });

  it('dialog boxShadow uses shadowHeavy token', () => {
    expect(dialog.boxShadow).toContain(color.shadowHeavy);
  });
});
