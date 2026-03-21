const React = globalThis.React;
const { useState, useEffect } = React;

import { SHORTCUTS, getShowHelp, subscribeHelp, toggleHelp } from './KeyboardShortcuts';
import * as S from './styles';

export function ShortcutsHelp() {
  const [visible, setVisible] = useState(getShowHelp());

  useEffect(() => {
    return subscribeHelp(() => setVisible(getShowHelp()));
  }, []);

  if (!visible) return null;

  return (
    <div style={S.overlay} onClick={() => toggleHelp()}>
      <div
        style={{
          background: S.color.bg,
          border: `1px solid ${S.color.border}`,
          borderRadius: 12,
          boxShadow: `0 25px 50px -12px ${S.color.shadowHeavy}`,
          padding: '16px 20px',
          maxWidth: 320,
          margin: '0 16px',
          fontFamily: S.font.family,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: S.color.text }}>Keyboard Shortcuts</span>
          <button
            onClick={() => toggleHelp()}
            style={{
              color: S.color.textTertiary,
              fontSize: 16,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {'\u00D7'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHORTCUTS.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <kbd style={{
                fontSize: 10,
                fontFamily: S.font.mono,
                padding: '2px 6px',
                borderRadius: 4,
                background: S.color.bgTertiary,
                border: `1px solid ${S.color.border}`,
                color: S.color.text,
                minWidth: 50,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {s.binding.replace('Meta+', '\u2318').replace('Shift+/', '?')}
              </kbd>
              <span style={{ fontSize: 11, color: S.color.textSecondary }}>{s.description}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 9, color: S.color.textTertiary, textAlign: 'center' }}>
          Press <kbd style={{ fontFamily: S.font.mono, fontSize: 9 }}>?</kbd> or <kbd style={{ fontFamily: S.font.mono, fontSize: 9 }}>Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
