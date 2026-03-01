// ---------------------------------------------------------------------------
// Plan Parser — Extracts structured deliverables from leader's plan.md
// ---------------------------------------------------------------------------

import type { Deliverable } from "../types";

export interface ParsedPlan {
  summary: string;
  deliverables: Deliverable[];
}

/**
 * Parse a plan.md file written by the leader agent.
 *
 * Expected format:
 * ```
 * ---
 * deliverables:
 *   - id: d1
 *     title: "Some task"
 *     assignee: "memberId"
 *     dependencies: []
 *     description: "Details about the task"
 *   - id: d2
 *     ...
 * ---
 *
 * ## Summary
 * High-level approach...
 * ```
 *
 * Falls back gracefully if frontmatter is malformed.
 */
export function parsePlan(content: string): ParsedPlan | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Try to extract YAML frontmatter
  const fmMatch = trimmed.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!fmMatch) {
    // No frontmatter — treat the whole thing as summary, no structured deliverables
    return { summary: trimmed, deliverables: [] };
  }

  const yamlBlock = fmMatch[1];
  const body = fmMatch[2].trim();

  const deliverables = parseDeliverables(yamlBlock);

  return {
    summary: body || "Plan provided (see deliverables)",
    deliverables,
  };
}

/**
 * Lightweight YAML-subset parser for the deliverables list.
 * We avoid pulling in a full YAML library; the format is constrained.
 */
function parseDeliverables(yaml: string): Deliverable[] {
  const deliverables: Deliverable[] = [];
  const lines = yaml.split("\n");

  // Find the "deliverables:" key
  let i = 0;
  while (i < lines.length && !lines[i].match(/^\s*deliverables:\s*$/)) {
    i++;
  }
  if (i >= lines.length) return [];
  i++; // skip past "deliverables:"

  // Parse each "- id:" block
  let current: Partial<Deliverable> | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // New item starts with "  - id:"
    const idMatch = line.match(/^\s+-\s+id:\s*(.+)/);
    if (idMatch) {
      if (current?.id) {
        deliverables.push(finishDeliverable(current));
      }
      current = { id: idMatch[1].trim().replace(/^["']|["']$/g, "") };
      i++;
      continue;
    }

    // Properties of the current item (indented with spaces)
    if (current && line.match(/^\s{4,}/)) {
      const kvMatch = line.match(/^\s+(title|assignee|description|dependencies):\s*(.+)/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim().replace(/^["']|["']$/g, "");

        if (key === "title") current.title = val;
        else if (key === "description") current.description = val;
        else if (key === "assignee") current.assigneeId = val;
        else if (key === "dependencies") current.dependencies = parseDependencyList(val);
      }
      i++;
      continue;
    }

    // If we hit something non-indented and not a new item, we're done
    if (!line.match(/^\s/) && line.trim() !== "") break;
    i++;
  }

  if (current?.id) {
    deliverables.push(finishDeliverable(current));
  }

  return deliverables;
}

function parseDependencyList(val: string): string[] {
  // Handle: [], ["d1"], ["d1", "d2"], d1, [d1, d2]
  const cleaned = val.replace(/[\[\]"']/g, "").trim();
  if (!cleaned) return [];
  return cleaned.split(",").map(s => s.trim()).filter(Boolean);
}

function finishDeliverable(partial: Partial<Deliverable>): Deliverable {
  return {
    id: partial.id || "unknown",
    title: partial.title || "Untitled deliverable",
    description: partial.description || "",
    assigneeId: partial.assigneeId || "",
    status: "pending",
    dependencies: partial.dependencies || [],
  };
}
