import type { BoardState, Swimlane } from './types';
import { generateId } from './types';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => { states: BoardState[]; swimlanes: Swimlane[] };
}

function makeState(name: string, order: number, overrides: Partial<BoardState> = {}): BoardState {
  return {
    id: generateId('state'),
    name,
    order,
    isAutomatic: false,
    automationPrompt: '',
    evaluationPrompt: '',
    wipLimit: 0,
    ...overrides,
  };
}

function makeDefaultSwimlane(): Swimlane[] {
  return [{ id: generateId('lane'), name: 'Default', order: 0, managerAgentId: null, evaluationAgentId: null }];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Simple three-column board for general task tracking.',
    icon: '\u25A6',
    create: () => ({
      states: [
        makeState('Todo', 0),
        makeState('In Progress', 1),
        makeState('Done', 2),
      ],
      swimlanes: makeDefaultSwimlane(),
    }),
  },
  {
    id: 'bug-triage',
    name: 'Bug Triage',
    description: 'Track bugs from report through fix and verification.',
    icon: '\uD83D\uDC1B',
    create: () => ({
      states: [
        makeState('Reported', 0),
        makeState('Triaging', 1),
        makeState('Fixing', 2),
        makeState('Verifying', 3),
        makeState('Closed', 4),
      ],
      swimlanes: makeDefaultSwimlane(),
    }),
  },
  {
    id: 'sprint',
    name: 'Sprint',
    description: 'Agile sprint board with backlog, review, and done columns.',
    icon: '\uD83C\uDFC3',
    create: () => ({
      states: [
        makeState('Backlog', 0),
        makeState('Todo', 1),
        makeState('In Progress', 2),
        makeState('In Review', 3),
        makeState('Done', 4),
      ],
      swimlanes: makeDefaultSwimlane(),
    }),
  },
  {
    id: 'cicd-pipeline',
    name: 'CI/CD Pipeline',
    description: 'Automated build, test, and deploy pipeline with agent-driven stages.',
    icon: '\uD83D\uDE80',
    create: () => ({
      states: [
        makeState('Queued', 0),
        makeState('Building', 1, {
          isAutomatic: true,
          automationPrompt: 'Build the project. Run the build command and ensure the output compiles without errors. Report any build failures with the exact error messages.',
          evaluationPrompt: 'Verify the build completed successfully with no compilation errors.',
        }),
        makeState('Testing', 2, {
          isAutomatic: true,
          automationPrompt: 'Run the full test suite. Execute all unit and integration tests. Report test results including any failures with file, test name, and error details.',
          evaluationPrompt: 'Verify all tests pass. Fail if any test is broken or skipped without justification.',
        }),
        makeState('Deploying', 3, {
          isAutomatic: true,
          automationPrompt: 'Deploy the changes to the target environment. Follow the deployment procedure and verify the deployment completes successfully.',
          evaluationPrompt: 'Verify the deployment completed without errors and the service is responding correctly.',
        }),
        makeState('Deployed', 4),
      ],
      swimlanes: [
        { id: generateId('lane'), name: 'Production', order: 0, managerAgentId: null, evaluationAgentId: null },
        { id: generateId('lane'), name: 'Staging', order: 1, managerAgentId: null, evaluationAgentId: null },
      ],
    }),
  },
];
