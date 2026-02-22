// Pure helper functions extracted for testability.

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

/**
 * Returns a color with hex alpha suffix for use in backgroundColor / border.
 * When no label color is provided, falls back to a 6-digit hex with alpha so
 * the value remains valid CSS (CSS variables cannot have hex alpha appended).
 */
export function labelColorAlpha(hex: string, alpha: string): string {
  if (!hex) return `#888888${alpha}`;
  const color = hex.startsWith("#") ? hex : `#${hex}`;
  return `${color}${alpha}`;
}

export function extractYamlValue(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, "m"));
  return match ? match[1] : null;
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

/** Client-side filter: matches title, issue number, and label names. */
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

/**
 * Parse a simple markdown string into text segments for testing.
 * This mirrors the inline regex from the Markdown component.
 */
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

/** Only allow http: and https: image URLs to prevent SSRF via markdown images. */
const SAFE_IMG_URL = /^https?:\/\//i;

export function isSafeImageUrl(src: string): boolean {
  return SAFE_IMG_URL.test(src);
}

/** Detect block-level markdown elements. */
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
