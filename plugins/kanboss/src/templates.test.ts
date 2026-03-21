import { describe, it, expect } from 'vitest';
import { BOARD_TEMPLATES } from './templates';

describe('BOARD_TEMPLATES', () => {
  it('has at least 4 templates', () => {
    expect(BOARD_TEMPLATES.length).toBeGreaterThanOrEqual(4);
  });

  it('each template has required fields', () => {
    for (const tmpl of BOARD_TEMPLATES) {
      expect(tmpl.id).toBeTruthy();
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.description).toBeTruthy();
      expect(tmpl.icon).toBeTruthy();
      expect(typeof tmpl.create).toBe('function');
    }
  });

  it('all template IDs are unique', () => {
    const ids = BOARD_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes default, bug-triage, sprint, and cicd-pipeline', () => {
    const ids = BOARD_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('default');
    expect(ids).toContain('bug-triage');
    expect(ids).toContain('sprint');
    expect(ids).toContain('cicd-pipeline');
  });
});

describe('template create() functions', () => {
  for (const tmpl of BOARD_TEMPLATES) {
    describe(`${tmpl.name} template`, () => {
      it('produces at least 2 states', () => {
        const { states } = tmpl.create();
        expect(states.length).toBeGreaterThanOrEqual(2);
      });

      it('produces states with sequential order starting at 0', () => {
        const { states } = tmpl.create();
        for (let i = 0; i < states.length; i++) {
          expect(states[i].order).toBe(i);
        }
      });

      it('produces states with unique IDs', () => {
        const { states } = tmpl.create();
        const ids = states.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('produces states with non-empty names', () => {
        const { states } = tmpl.create();
        for (const s of states) {
          expect(s.name.trim()).toBeTruthy();
        }
      });

      it('produces at least 1 swimlane', () => {
        const { swimlanes } = tmpl.create();
        expect(swimlanes.length).toBeGreaterThanOrEqual(1);
      });

      it('produces swimlanes with unique IDs', () => {
        const { swimlanes } = tmpl.create();
        const ids = swimlanes.map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('produces swimlanes with sequential order', () => {
        const { swimlanes } = tmpl.create();
        for (let i = 0; i < swimlanes.length; i++) {
          expect(swimlanes[i].order).toBe(i);
        }
      });

      it('generates fresh IDs on each call', () => {
        const first = tmpl.create();
        const second = tmpl.create();
        const ids1 = first.states.map((s) => s.id);
        const ids2 = second.states.map((s) => s.id);
        // No ID overlap between calls
        for (const id of ids1) {
          expect(ids2).not.toContain(id);
        }
      });
    });
  }
});

describe('CI/CD Pipeline template specifics', () => {
  const cicd = BOARD_TEMPLATES.find((t) => t.id === 'cicd-pipeline')!;

  it('has automatic states for Building, Testing, and Deploying', () => {
    const { states } = cicd.create();
    const autoStates = states.filter((s) => s.isAutomatic);
    const autoNames = autoStates.map((s) => s.name);
    expect(autoNames).toContain('Building');
    expect(autoNames).toContain('Testing');
    expect(autoNames).toContain('Deploying');
  });

  it('automatic states have non-empty automation prompts', () => {
    const { states } = cicd.create();
    const autoStates = states.filter((s) => s.isAutomatic);
    for (const s of autoStates) {
      expect(s.automationPrompt.trim()).toBeTruthy();
    }
  });

  it('automatic states have non-empty evaluation prompts', () => {
    const { states } = cicd.create();
    const autoStates = states.filter((s) => s.isAutomatic);
    for (const s of autoStates) {
      expect(s.evaluationPrompt.trim()).toBeTruthy();
    }
  });

  it('Queued and Deployed states are not automatic', () => {
    const { states } = cicd.create();
    const queued = states.find((s) => s.name === 'Queued');
    const deployed = states.find((s) => s.name === 'Deployed');
    expect(queued?.isAutomatic).toBe(false);
    expect(deployed?.isAutomatic).toBe(false);
  });

  it('has 2 swimlanes (Production and Staging)', () => {
    const { swimlanes } = cicd.create();
    expect(swimlanes.length).toBe(2);
    const names = swimlanes.map((l) => l.name);
    expect(names).toContain('Production');
    expect(names).toContain('Staging');
  });
});
