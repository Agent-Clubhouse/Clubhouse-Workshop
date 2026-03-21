import { describe, it, expect } from 'vitest';
import { resolveExecutionAgent, resolveEvaluationAgent } from './AutomationEngine';
import type { BoardState, Swimlane } from './types';

function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    id: 's1',
    name: 'Test State',
    order: 0,
    isAutomatic: true,
    automationPrompt: 'do work',
    evaluationPrompt: '',
    wipLimit: 0,
    executionAgentId: null,
    evaluationAgentId: null,
    ...overrides,
  };
}

function makeSwimlane(overrides: Partial<Swimlane> = {}): Swimlane {
  return {
    id: 'l1',
    name: 'Default',
    order: 0,
    managerAgentId: null,
    evaluationAgentId: null,
    ...overrides,
  };
}

describe('resolveExecutionAgent', () => {
  it('returns state executionAgentId when set', () => {
    const state = makeState({ executionAgentId: 'agent-state' });
    const lane = makeSwimlane({ managerAgentId: 'agent-lane' });
    expect(resolveExecutionAgent(state, lane)).toBe('agent-state');
  });

  it('falls back to swimlane managerAgentId when state has no executionAgentId', () => {
    const state = makeState({ executionAgentId: null });
    const lane = makeSwimlane({ managerAgentId: 'agent-lane' });
    expect(resolveExecutionAgent(state, lane)).toBe('agent-lane');
  });

  it('returns null when neither state nor swimlane has an agent', () => {
    const state = makeState({ executionAgentId: null });
    const lane = makeSwimlane({ managerAgentId: null });
    expect(resolveExecutionAgent(state, lane)).toBeNull();
  });

  it('prefers state agent even when swimlane also has one', () => {
    const state = makeState({ executionAgentId: 'state-exec' });
    const lane = makeSwimlane({ managerAgentId: 'lane-mgr' });
    expect(resolveExecutionAgent(state, lane)).toBe('state-exec');
  });
});

describe('resolveEvaluationAgent', () => {
  it('returns state evaluationAgentId when set', () => {
    const state = makeState({ evaluationAgentId: 'agent-state-eval' });
    const lane = makeSwimlane({ evaluationAgentId: 'agent-lane-eval', managerAgentId: 'agent-lane-mgr' });
    expect(resolveEvaluationAgent(state, lane)).toBe('agent-state-eval');
  });

  it('falls back to swimlane evaluationAgentId when state has none', () => {
    const state = makeState({ evaluationAgentId: null });
    const lane = makeSwimlane({ evaluationAgentId: 'agent-lane-eval', managerAgentId: 'agent-lane-mgr' });
    expect(resolveEvaluationAgent(state, lane)).toBe('agent-lane-eval');
  });

  it('falls back to swimlane managerAgentId when no evaluation agents are set', () => {
    const state = makeState({ evaluationAgentId: null });
    const lane = makeSwimlane({ evaluationAgentId: null, managerAgentId: 'agent-lane-mgr' });
    expect(resolveEvaluationAgent(state, lane)).toBe('agent-lane-mgr');
  });

  it('returns null when no agents are assigned anywhere', () => {
    const state = makeState({ evaluationAgentId: null });
    const lane = makeSwimlane({ evaluationAgentId: null, managerAgentId: null });
    expect(resolveEvaluationAgent(state, lane)).toBeNull();
  });

  it('state evaluationAgentId takes priority over all swimlane agents', () => {
    const state = makeState({ evaluationAgentId: 'state-eval' });
    const lane = makeSwimlane({ evaluationAgentId: 'lane-eval', managerAgentId: 'lane-mgr' });
    expect(resolveEvaluationAgent(state, lane)).toBe('state-eval');
  });
});
