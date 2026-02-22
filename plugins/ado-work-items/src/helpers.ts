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
