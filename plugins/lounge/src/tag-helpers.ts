/**
 * Orchestrator and model tag color/label helpers.
 * Reimplements the host app's orchestrator-colors.ts logic inline
 * so community plugins can render matching tag badges.
 */

// ── Orchestrator colors ────────────────────────────────────────────────

export const ORCHESTRATOR_COLORS: Record<string, { bg: string; text: string }> = {
  'claude-code': { bg: 'rgba(249,115,22,0.2)', text: '#fb923c' },
  'copilot-cli': { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
};
export const DEFAULT_ORCH_COLOR = { bg: 'rgba(148,163,184,0.2)', text: '#94a3b8' };

export function getOrchestratorColor(id: string): { bg: string; text: string } {
  return ORCHESTRATOR_COLORS[id] || DEFAULT_ORCH_COLOR;
}

// ── Orchestrator labels ────────────────────────────────────────────────

const ORCHESTRATOR_DISPLAY_NAMES: Record<string, string> = {
  'claude-code': 'CC',
  'copilot-cli': 'GHCP',
  'codex-cli': 'Codex',
};

/**
 * Resolve a short display label for an orchestrator ID (for badge use).
 * Fallback chain: orchestrator shortName → static map → raw ID.
 */
export function getOrchestratorLabel(
  orchId: string,
  allOrchestrators?: Array<{ id: string; shortName?: string; displayName?: string }>,
): string {
  const info = allOrchestrators?.find((o) => o.id === orchId);
  if (info) return info.shortName || info.displayName || orchId;
  return ORCHESTRATOR_DISPLAY_NAMES[orchId] || orchId;
}

// ── Model colors ───────────────────────────────────────────────────────

const MODEL_PALETTE = [
  { bg: 'rgba(168,85,247,0.2)', text: '#c084fc' },
  { bg: 'rgba(20,184,166,0.2)', text: '#2dd4bf' },
  { bg: 'rgba(236,72,153,0.2)', text: '#f472b6' },
  { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
  { bg: 'rgba(251,191,36,0.2)', text: '#fbbf24' },
  { bg: 'rgba(99,102,241,0.2)', text: '#818cf8' },
  { bg: 'rgba(14,165,233,0.2)', text: '#38bdf8' },
];

const DEFAULT_MODEL_COLOR = { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8' };

const modelColorCache = new Map<string, { bg: string; text: string }>();

export function getModelColor(model: string): { bg: string; text: string } {
  let color = modelColorCache.get(model);
  if (!color) {
    let hash = 0;
    for (let i = 0; i < model.length; i++) hash = (hash * 31 + model.charCodeAt(i)) | 0;
    color = MODEL_PALETTE[((hash % MODEL_PALETTE.length) + MODEL_PALETTE.length) % MODEL_PALETTE.length];
    modelColorCache.set(model, color);
  }
  return color;
}

// ── Model labels ───────────────────────────────────────────────────────

export function formatModelLabel(model: string | undefined): string {
  if (!model || model === 'default') return 'Default';
  return model.charAt(0).toUpperCase() + model.slice(1);
}

/** Free agent mode badge color */
export const FREE_AGENT_COLOR = { bg: 'rgba(239,68,68,0.15)', text: '#f87171' };

/**
 * Get the color for a model tag badge.
 * Returns the default (grey) for undefined / 'default', otherwise hash-based.
 */
export function getModelTagColor(model: string | undefined): { bg: string; text: string } {
  if (!model || model === 'default') return DEFAULT_MODEL_COLOR;
  return getModelColor(model);
}
