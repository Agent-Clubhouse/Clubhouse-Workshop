import { describe, it, expect } from 'vitest';
import { buildRunHistoryEntry, RUN_HISTORY_KEY, RUN_OUTCOME_CONFIG } from './types';
import type { RunHistoryEntry, RunOutcome } from './types';

describe('buildRunHistoryEntry', () => {
  const baseOpts = {
    cardId: 'card_1',
    cardTitle: 'Fix auth flow',
    boardId: 'board_1',
    stateId: 'state_2',
    stateName: 'In Review',
    swimlaneId: 'lane_1',
    outcome: 'passed' as RunOutcome,
    agentSummary: 'Added auth middleware and updated tests',
    filesModified: ['src/auth.ts', 'src/auth.test.ts'],
    attempt: 1,
    startedAt: 1000,
  };

  it('generates an entry with a unique id prefixed with run_', () => {
    const entry = buildRunHistoryEntry(baseOpts);
    expect(entry.id).toMatch(/^run_/);
  });

  it('generates different ids for each call', () => {
    const e1 = buildRunHistoryEntry(baseOpts);
    const e2 = buildRunHistoryEntry(baseOpts);
    expect(e1.id).not.toBe(e2.id);
  });

  it('copies all fields from options', () => {
    const entry = buildRunHistoryEntry(baseOpts);
    expect(entry.cardId).toBe('card_1');
    expect(entry.cardTitle).toBe('Fix auth flow');
    expect(entry.boardId).toBe('board_1');
    expect(entry.stateId).toBe('state_2');
    expect(entry.stateName).toBe('In Review');
    expect(entry.swimlaneId).toBe('lane_1');
    expect(entry.outcome).toBe('passed');
    expect(entry.agentSummary).toBe('Added auth middleware and updated tests');
    expect(entry.filesModified).toEqual(['src/auth.ts', 'src/auth.test.ts']);
    expect(entry.attempt).toBe(1);
    expect(entry.startedAt).toBe(1000);
  });

  it('sets completedAt to approximately now', () => {
    const before = Date.now();
    const entry = buildRunHistoryEntry(baseOpts);
    const after = Date.now();
    expect(entry.completedAt).toBeGreaterThanOrEqual(before);
    expect(entry.completedAt).toBeLessThanOrEqual(after);
  });

  it('works with failed outcome', () => {
    const entry = buildRunHistoryEntry({ ...baseOpts, outcome: 'failed' });
    expect(entry.outcome).toBe('failed');
  });

  it('works with stuck outcome', () => {
    const entry = buildRunHistoryEntry({ ...baseOpts, outcome: 'stuck' });
    expect(entry.outcome).toBe('stuck');
  });

  it('works with empty summary and no files', () => {
    const entry = buildRunHistoryEntry({
      ...baseOpts,
      agentSummary: '',
      filesModified: [],
    });
    expect(entry.agentSummary).toBe('');
    expect(entry.filesModified).toEqual([]);
  });
});

describe('RUN_HISTORY_KEY', () => {
  it('is a string constant', () => {
    expect(typeof RUN_HISTORY_KEY).toBe('string');
    expect(RUN_HISTORY_KEY).toBe('run-history');
  });
});

describe('RUN_OUTCOME_CONFIG', () => {
  it('has entries for all outcomes', () => {
    expect(RUN_OUTCOME_CONFIG.passed).toBeDefined();
    expect(RUN_OUTCOME_CONFIG.failed).toBeDefined();
    expect(RUN_OUTCOME_CONFIG.stuck).toBeDefined();
  });

  it('each outcome has label and color', () => {
    for (const key of ['passed', 'failed', 'stuck'] as RunOutcome[]) {
      expect(RUN_OUTCOME_CONFIG[key].label).toBeTruthy();
      expect(RUN_OUTCOME_CONFIG[key].color).toBeTruthy();
    }
  });

  it('uses CSS custom properties with fallbacks', () => {
    const cssVarPattern = /^var\(--[\w-]+,\s*.+\)$/;
    expect(RUN_OUTCOME_CONFIG.passed.color).toMatch(cssVarPattern);
    expect(RUN_OUTCOME_CONFIG.failed.color).toMatch(cssVarPattern);
    expect(RUN_OUTCOME_CONFIG.stuck.color).toMatch(cssVarPattern);
  });
});
