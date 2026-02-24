// Pure helper functions extracted for testability.

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReportType = "bug" | "enhancement";

export const SEVERITIES: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const REPORT_TYPES: ReportType[] = ["bug", "enhancement"];

export const REPO = "Agent-Clubhouse/Clubhouse";

export function severityColor(severity: Severity): string {
  switch (severity) {
    case "CRITICAL": return "var(--red, #e5534b)";
    case "HIGH": return "var(--orange, #d29922)";
    case "MEDIUM": return "var(--yellow, #c69026)";
    case "LOW": return "var(--green, #57ab5a)";
  }
}

export function typeColor(type: ReportType): string {
  switch (type) {
    case "bug": return "var(--text-error, #d73a4a)";
    case "enhancement": return "var(--text-info, #a2eeef)";
  }
}

export function formatTitle(severity: Severity, title: string): string {
  return `[${severity}] ${title}`;
}

export function parseSeverityFromTitle(title: string): { severity: Severity | null; cleanTitle: string } {
  const match = title.match(/^\[(LOW|MEDIUM|HIGH|CRITICAL)\]\s*(.*)/);
  if (match) {
    return { severity: match[1] as Severity, cleanTitle: match[2] };
  }
  return { severity: null, cleanTitle: title };
}

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

export function labelColor(hex: string): string {
  if (!hex) return "var(--text-tertiary, #888888)";
  return hex.startsWith("#") ? hex : `#${hex}`;
}

export function labelColorAlpha(hex: string, alpha: string): string {
  if (!hex) return `#888888${alpha}`;
  const color = hex.startsWith("#") ? hex : `#${hex}`;
  return `${color}${alpha}`;
}

export interface IssueListItem {
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: { login: string };
  labels: Array<{ name: string; color: string }>;
}

export function filterIssues(issues: IssueListItem[], query: string): IssueListItem[] {
  if (!query.trim()) return issues;
  const q = query.toLowerCase();
  return issues.filter(
    i =>
      i.title.toLowerCase().includes(q) ||
      `#${i.number}`.includes(q) ||
      i.labels.some(l => l.name.toLowerCase().includes(q)),
  );
}

export function parseInlineSegments(
  text: string,
): Array<{ type: "text" | "bold" | "italic" | "code" | "link" | "strikethrough" | "image"; content: string; href?: string }> {
  const segments: Array<{ type: "text" | "bold" | "italic" | "code" | "link" | "strikethrough" | "image"; content: string; href?: string }> = [];
  const inlineRe =
    /!\[([^\]]*)\]\(([^)]+)\)|(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    if (match.index > last) segments.push({ type: "text", content: text.slice(last, match.index) });
    const m = match[0];

    if (m.startsWith("![")) {
      segments.push({ type: "image", content: match[1], href: match[2] });
    } else if (m.startsWith("[")) {
      segments.push({ type: "link", content: match[4], href: match[5] });
    } else if (m.startsWith("`")) {
      segments.push({ type: "code", content: m.slice(1, -1) });
    } else if (m.startsWith("**") || m.startsWith("__")) {
      segments.push({ type: "bold", content: m.slice(2, -2) });
    } else if (m.startsWith("~~")) {
      segments.push({ type: "strikethrough", content: m.slice(2, -2) });
    } else if (m.startsWith("*") || m.startsWith("_")) {
      segments.push({ type: "italic", content: m.slice(1, -1) });
    }
    last = match.index + m.length;
  }

  if (last < text.length) segments.push({ type: "text", content: text.slice(last) });
  return segments;
}

export function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function classifyLine(
  line: string,
): "heading" | "code-fence" | "blockquote" | "unordered-list" | "ordered-list" | "hr" | "paragraph" | "blank" {
  if (!line.trim()) return "blank";
  if (line.startsWith("```")) return "code-fence";
  if (/^#{1,6}\s+/.test(line)) return "heading";
  if (/^[-*_]{3,}\s*$/.test(line)) return "hr";
  if (line.startsWith("> ") || line === ">") return "blockquote";
  if (/^\s*[-*+]\s/.test(line)) return "unordered-list";
  if (/^\s*\d+[.)]\s/.test(line)) return "ordered-list";
  return "paragraph";
}
