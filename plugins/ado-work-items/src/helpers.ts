// ---------------------------------------------------------------------------
// Helpers — pure functions extracted for testability & reuse
// ---------------------------------------------------------------------------

export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  const diffMo = Math.floor(diffD / 30);
  return `${diffMo}mo ago`;
}

export function typeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "bug": return "var(--text-error, #cc293d)";
    case "task": return "var(--text-warning, #f2cb1d)";
    case "user story": return "var(--text-info, #009ccc)";
    case "product backlog item": return "var(--text-info, #009ccc)";
    case "feature": return "var(--text-accent, #773b93)";
    case "epic": return "var(--text-warning, #ff7b00)";
    case "issue": return "var(--text-info, #009ccc)";
    case "impediment": return "var(--text-error, #cc293d)";
    default: return "var(--text-tertiary, #888)";
  }
}

export function stateColor(state: string): { bg: string; fg: string; border: string } {
  const s = state.toLowerCase();
  if (s === "new" || s === "to do" || s === "proposed")
    return { bg: "var(--bg-secondary, rgba(180,180,180,0.1))", fg: "var(--text-secondary, #a1a1aa)", border: "var(--border-secondary, rgba(180,180,180,0.3))" };
  if (s === "active" || s === "in progress" || s === "committed" || s === "doing")
    return { bg: "var(--bg-accent, rgba(0,122,204,0.1))", fg: "var(--text-info, #3b82f6)", border: "var(--border-secondary, rgba(0,122,204,0.3))" };
  if (s === "resolved" || s === "done")
    return { bg: "var(--bg-accent, rgba(64,200,100,0.1))", fg: "var(--text-accent, #4ade80)", border: "var(--border-secondary, rgba(64,200,100,0.3))" };
  if (s === "closed" || s === "removed")
    return { bg: "var(--bg-tertiary, rgba(168,85,247,0.1))", fg: "var(--text-tertiary, #a1a1aa)", border: "var(--border-primary, rgba(168,85,247,0.3))" };
  return { bg: "var(--bg-secondary, rgba(180,180,180,0.1))", fg: "var(--text-secondary, #a1a1aa)", border: "var(--border-secondary, rgba(180,180,180,0.3))" };
}

export function priorityLabel(p: number): string {
  switch (p) {
    case 1: return "Critical";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "";
  }
}

export function statusBadgeStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: "9px",
    padding: "1px 4px",
    borderRadius: "3px",
    display: "inline-block",
  };
  switch (status) {
    case "sleeping":
      return { ...base, background: "var(--bg-accent, rgba(64,200,100,0.15))", color: "var(--text-accent, #4ade80)" };
    case "running":
      return { ...base, background: "var(--bg-accent, rgba(234,179,8,0.15))", color: "var(--text-warning, #facc15)" };
    case "error":
      return { ...base, background: "var(--bg-error, rgba(239,68,68,0.15))", color: "var(--text-error, #f87171)" };
    default:
      return base;
  }
}

/**
 * Escape a value for safe interpolation into a WIQL string literal.
 * WIQL uses doubled single-quotes ('') to represent a literal quote inside
 * a single-quoted string, similar to standard SQL escaping.
 */
export function escapeWiql(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Validate that an Azure DevOps organization URL matches expected patterns.
 * Accepts `https://dev.azure.com/<org>` and `https://<org>.visualstudio.com`
 * with an optional trailing slash.  Rejects URLs containing shell
 * metacharacters or unexpected structure.
 */
export function validateOrgUrl(url: string): boolean {
  return /^https:\/\/(dev\.azure\.com\/[\w-]+|[\w-]+\.visualstudio\.com)\/?$/.test(url);
}

/**
 * Validate that an Azure DevOps project name contains only safe characters.
 * ADO project names may include word characters, spaces, hyphens, dots, and
 * parentheses (e.g. "Kaizen (AIPF)").
 */
export function validateProjectName(name: string): boolean {
  return name.length > 0 && /^[\w\s.()\-]+$/.test(name);
}

/**
 * Normalize a project name by decoding URI-encoded characters (e.g. %20 → space).
 * Users often paste project names from ADO URLs where spaces are encoded.
 */
export function normalizeProjectName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/**
 * Parse the AssignedTo field which may be a string or an identity object.
 */
function parseIdentityField(field: unknown): string {
  if (typeof field === "object" && field !== null) {
    return (field as Record<string, string>).displayName || (field as Record<string, string>).uniqueName || "";
  }
  return typeof field === "string" ? field : "";
}

/**
 * Extract work item list fields from a raw `az boards work-item show` response object.
 * Returns null if the object has no `fields` property.
 */
export function parseRawWorkItem(
  raw: Record<string, unknown>,
): {
  id: number;
  title: string;
  state: string;
  workItemType: string;
  assignedTo: string;
  changedDate: string;
  tags: string;
  priority: number;
  areaPath: string;
  iterationPath: string;
} | null {
  const fields = raw.fields as Record<string, unknown> | undefined;
  if (!fields) return null;
  return {
    id: (raw.id as number) || 0,
    title: (fields["System.Title"] as string) || "",
    state: (fields["System.State"] as string) || "",
    workItemType: (fields["System.WorkItemType"] as string) || "",
    assignedTo: parseIdentityField(fields["System.AssignedTo"]),
    changedDate: (fields["System.ChangedDate"] as string) || "",
    tags: (fields["System.Tags"] as string) || "",
    priority: (fields["Microsoft.VSTS.Common.Priority"] as number) || 0,
    areaPath: (fields["System.AreaPath"] as string) || "",
    iterationPath: (fields["System.IterationPath"] as string) || "",
  };
}

/**
 * Build the common --org and --project CLI args for az commands that accept both.
 * Used by: `az boards query`, `az boards work-item create`, `az boards work-item update`.
 */
export function baseArgs(config: { organization: string; project: string }): string[] {
  const args: string[] = [];
  if (config.organization) args.push("--org", config.organization);
  if (config.project) args.push("--project", config.project);
  return args;
}

/**
 * Build only the --org CLI arg.  Use for `az boards work-item show` which
 * does NOT accept --project (work item IDs are unique within an organization).
 */
export function orgArgs(config: { organization: string }): string[] {
  const args: string[] = [];
  if (config.organization) args.push("--org", config.organization);
  return args;
}

/** Strip HTML tags for plain-text display. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
