import { describe, it, expect } from 'vitest';
import { color } from '../src/styles';
import { getFileIconColor } from '../src/file-icons';

describe('theme compliance', () => {
  describe('styles.ts color tokens', () => {
    it('all color tokens use CSS custom properties', () => {
      for (const [key, value] of Object.entries(color)) {
        expect(value, `color.${key} should use var() but got: ${value}`).toMatch(
          /^var\(--[\w-]+,\s*.+\)$/,
        );
      }
    });

    it('text colors reference --text-* custom properties', () => {
      const textTokens = ['text', 'textSecondary', 'textTertiary', 'textError', 'textSuccess', 'textAccent', 'textWarning', 'textOnAccent'] as const;
      for (const key of textTokens) {
        expect(color[key], `color.${key}`).toMatch(/var\(--text-/);
      }
    });

    it('background colors reference --bg-* custom properties', () => {
      const bgTokens = ['bg', 'bgSecondary', 'bgTertiary', 'bgActive', 'bgError', 'successBg', 'warningBg', 'errorBgSubtle', 'accentBg', 'overlayBg'] as const;
      for (const key of bgTokens) {
        expect(color[key], `color.${key}`).toMatch(/var\(--bg-/);
      }
    });

    it('border colors reference --border-* custom properties', () => {
      const borderTokens = ['border', 'borderSecondary', 'errorBorder'] as const;
      for (const key of borderTokens) {
        expect(color[key], `color.${key}`).toMatch(/var\(--border-/);
      }
    });

    it('icon colors reference --icon-* custom properties', () => {
      const iconTokens = ['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'cyan', 'gray'] as const;
      for (const key of iconTokens) {
        expect(color[key], `color.${key}`).toMatch(/var\(--icon-/);
      }
    });

    it('shadow tokens reference --shadow-* custom properties', () => {
      expect(color.shadowMenu).toMatch(/var\(--shadow-/);
      expect(color.shadowDialog).toMatch(/var\(--shadow-/);
    });
  });

  describe('file-icons.ts', () => {
    it('returns theme-aware colors using CSS custom properties', () => {
      const extensions = ['md', 'js', 'ts', 'json', 'css', 'py', 'go', 'html', 'txt'];
      for (const ext of extensions) {
        const iconColor = getFileIconColor(ext);
        expect(iconColor, `icon color for .${ext}`).toMatch(/^var\(--/);
      }
    });

    it('returns a CSS custom property for unknown extensions', () => {
      expect(getFileIconColor('xyz')).toMatch(/^var\(--/);
    });
  });
});
