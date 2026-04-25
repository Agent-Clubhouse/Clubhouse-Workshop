import { describe, it, expect } from 'vitest';
import {
  getOrchestratorColor,
  getOrchestratorLabel,
  formatModelLabel,
  getModelColor,
  getModelTagColor,
  ORCHESTRATOR_COLORS,
  DEFAULT_ORCH_COLOR,
  FREE_AGENT_COLOR,
} from './tag-helpers';

describe('getOrchestratorColor', () => {
  it('returns orange for claude-code', () => {
    expect(getOrchestratorColor('claude-code')).toEqual(ORCHESTRATOR_COLORS['claude-code']);
  });

  it('returns blue for copilot-cli', () => {
    expect(getOrchestratorColor('copilot-cli')).toEqual(ORCHESTRATOR_COLORS['copilot-cli']);
  });

  it('returns default grey for unknown orchestrator', () => {
    expect(getOrchestratorColor('unknown-orch')).toEqual(DEFAULT_ORCH_COLOR);
  });
});

describe('getOrchestratorLabel', () => {
  it('uses shortName from orchestrator list when available', () => {
    const orchestrators = [{ id: 'claude-code', displayName: 'Claude Code Agent', shortName: 'CC' }];
    expect(getOrchestratorLabel('claude-code', orchestrators)).toBe('CC');
  });

  it('falls back to displayName when shortName is absent', () => {
    const orchestrators = [{ id: 'claude-code', displayName: 'Claude Code Agent' }];
    expect(getOrchestratorLabel('claude-code', orchestrators)).toBe('Claude Code Agent');
  });

  it('falls back to static map when not in orchestrator list', () => {
    expect(getOrchestratorLabel('claude-code', [])).toBe('CC');
    expect(getOrchestratorLabel('copilot-cli', [])).toBe('GHCP');
    expect(getOrchestratorLabel('codex-cli', [])).toBe('Codex');
  });

  it('falls back to raw ID when not in static map', () => {
    expect(getOrchestratorLabel('my-custom-orch', [])).toBe('my-custom-orch');
  });

  it('falls back to raw ID when orchestrator list is undefined', () => {
    expect(getOrchestratorLabel('my-custom-orch')).toBe('my-custom-orch');
  });

  it('handles empty orchestrator list gracefully', () => {
    expect(getOrchestratorLabel('claude-code', [])).toBe('CC');
  });
});

describe('formatModelLabel', () => {
  it('capitalizes model name', () => {
    expect(formatModelLabel('sonnet')).toBe('Sonnet');
  });

  it('returns Default for undefined', () => {
    expect(formatModelLabel(undefined)).toBe('Default');
  });

  it('returns Default for "default"', () => {
    expect(formatModelLabel('default')).toBe('Default');
  });

  it('handles single character', () => {
    expect(formatModelLabel('a')).toBe('A');
  });
});

describe('getModelColor', () => {
  it('returns consistent color for same model', () => {
    const color1 = getModelColor('sonnet');
    const color2 = getModelColor('sonnet');
    expect(color1).toBe(color2); // same reference from cache
  });

  it('returns a color with bg and text properties', () => {
    const color = getModelColor('opus');
    expect(color).toHaveProperty('bg');
    expect(color).toHaveProperty('text');
    expect(color.bg).toMatch(/^rgba\(/);
    expect(color.text).toMatch(/^#/);
  });

  it('different models may get different colors', () => {
    const c1 = getModelColor('sonnet');
    const c2 = getModelColor('opus');
    // They could theoretically hash to the same bucket, but these specific strings don't
    expect(c1 !== c2 || c1.bg !== c2.bg).toBe(true);
  });
});

describe('getModelTagColor', () => {
  it('returns default grey for undefined model', () => {
    const color = getModelTagColor(undefined);
    expect(color.text).toBe('#94a3b8');
  });

  it('returns default grey for "default" model', () => {
    const color = getModelTagColor('default');
    expect(color.text).toBe('#94a3b8');
  });

  it('returns hash-based color for custom model', () => {
    const color = getModelTagColor('sonnet');
    expect(color.text).not.toBe('#94a3b8');
  });
});

describe('FREE_AGENT_COLOR', () => {
  it('has red tones', () => {
    expect(FREE_AGENT_COLOR.text).toBe('#f87171');
    expect(FREE_AGENT_COLOR.bg).toContain('239,68,68');
  });
});
