import { describe, it, expect } from "vitest";
import {
  relativeTime,
  labelColor,
  labelColorAlpha,
  filterIssues,
  parseInlineSegments,
  classifyLine,
  isSafeUrl,
  severityColor,
  typeColor,
  formatTitle,
  parseSeverityFromTitle,
  SEVERITIES,
  REPORT_TYPES,
  REPO,
  REPOS,
  IssueListItem,
} from "./helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("REPO is Agent-Clubhouse/Clubhouse", () => {
    expect(REPO).toBe("Agent-Clubhouse/Clubhouse");
  });

  it("REPOS maps app and plugins to correct repos", () => {
    expect(REPOS.app).toBe("Agent-Clubhouse/Clubhouse");
    expect(REPOS.plugins).toBe("Agent-Clubhouse/Clubhouse-Workshop");
  });

  it("REPO is an alias for REPOS.app", () => {
    expect(REPO).toBe(REPOS.app);
  });

  it("SEVERITIES contains all four levels", () => {
    expect(SEVERITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it("REPORT_TYPES contains bug and enhancement", () => {
    expect(REPORT_TYPES).toEqual(["bug", "enhancement"]);
  });
});

// ---------------------------------------------------------------------------
// severityColor
// ---------------------------------------------------------------------------

describe("severityColor", () => {
  it("returns red for CRITICAL", () => {
    expect(severityColor("CRITICAL")).toContain("e5534b");
  });

  it("returns orange for HIGH", () => {
    expect(severityColor("HIGH")).toContain("d29922");
  });

  it("returns yellow for MEDIUM", () => {
    expect(severityColor("MEDIUM")).toContain("c69026");
  });

  it("returns green for LOW", () => {
    expect(severityColor("LOW")).toContain("57ab5a");
  });
});

// ---------------------------------------------------------------------------
// typeColor
// ---------------------------------------------------------------------------

describe("typeColor", () => {
  it("returns red-ish for bug", () => {
    expect(typeColor("bug")).toBe("var(--text-error, #d73a4a)");
  });

  it("returns cyan-ish for enhancement", () => {
    expect(typeColor("enhancement")).toBe("var(--text-info, #a2eeef)");
  });
});

// ---------------------------------------------------------------------------
// formatTitle
// ---------------------------------------------------------------------------

describe("formatTitle", () => {
  it("prefixes title with severity bracket", () => {
    expect(formatTitle("HIGH", "Login fails")).toBe("[HIGH] Login fails");
  });

  it("works for all severity levels", () => {
    expect(formatTitle("LOW", "Minor typo")).toBe("[LOW] Minor typo");
    expect(formatTitle("MEDIUM", "Slow load")).toBe("[MEDIUM] Slow load");
    expect(formatTitle("CRITICAL", "Data loss")).toBe("[CRITICAL] Data loss");
  });

  it("includes plugin name when provided", () => {
    expect(formatTitle("HIGH", "Login fails", "Pomodoro")).toBe("[HIGH][Pomodoro] Login fails");
  });

  it("omits plugin name bracket when not provided", () => {
    expect(formatTitle("HIGH", "Login fails")).toBe("[HIGH] Login fails");
    expect(formatTitle("HIGH", "Login fails", undefined)).toBe("[HIGH] Login fails");
  });
});

// ---------------------------------------------------------------------------
// parseSeverityFromTitle
// ---------------------------------------------------------------------------

describe("parseSeverityFromTitle", () => {
  it("extracts severity and clean title", () => {
    const result = parseSeverityFromTitle("[HIGH] Login fails on startup");
    expect(result.severity).toBe("HIGH");
    expect(result.cleanTitle).toBe("Login fails on startup");
  });

  it("returns null severity for titles without prefix", () => {
    const result = parseSeverityFromTitle("Some random issue");
    expect(result.severity).toBeNull();
    expect(result.cleanTitle).toBe("Some random issue");
  });

  it("handles all severity levels", () => {
    expect(parseSeverityFromTitle("[LOW] Minor thing").severity).toBe("LOW");
    expect(parseSeverityFromTitle("[MEDIUM] Some issue").severity).toBe("MEDIUM");
    expect(parseSeverityFromTitle("[HIGH] Important issue").severity).toBe("HIGH");
    expect(parseSeverityFromTitle("[CRITICAL] Urgent issue").severity).toBe("CRITICAL");
  });

  it("does not match invalid severity levels", () => {
    expect(parseSeverityFromTitle("[URGENT] Not a level").severity).toBeNull();
    expect(parseSeverityFromTitle("[low] lowercase").severity).toBeNull();
  });

  it("returns null pluginName for plain severity titles", () => {
    const result = parseSeverityFromTitle("[HIGH] Login fails");
    expect(result.pluginName).toBeNull();
  });

  it("extracts pluginName from [SEV][Plugin] format", () => {
    const result = parseSeverityFromTitle("[HIGH][Pomodoro] Timer stops unexpectedly");
    expect(result.severity).toBe("HIGH");
    expect(result.pluginName).toBe("Pomodoro");
    expect(result.cleanTitle).toBe("Timer stops unexpectedly");
  });

  it("handles all severities with plugin name", () => {
    expect(parseSeverityFromTitle("[LOW][Standup] Minor issue").pluginName).toBe("Standup");
    expect(parseSeverityFromTitle("[MEDIUM][GitHelper] Slow fetch").pluginName).toBe("GitHelper");
    expect(parseSeverityFromTitle("[CRITICAL][Auth] Token leak").pluginName).toBe("Auth");
  });

  it("returns null pluginName for titles without prefix", () => {
    const result = parseSeverityFromTitle("Some random issue");
    expect(result.pluginName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe("relativeTime", () => {
  it("returns 'just now' for recent dates", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(relativeTime(new Date(Date.now() - 3 * 3600000).toISOString())).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(relativeTime(new Date(Date.now() - 2 * 86400000).toISOString())).toBe("2d ago");
  });

  it("returns months ago", () => {
    expect(relativeTime(new Date(Date.now() - 60 * 86400000).toISOString())).toBe("2mo ago");
  });
});

// ---------------------------------------------------------------------------
// labelColor
// ---------------------------------------------------------------------------

describe("labelColor", () => {
  it("returns CSS variable fallback for empty string", () => {
    expect(labelColor("")).toBe("var(--text-tertiary, #888888)");
  });

  it("passes through hex values starting with #", () => {
    expect(labelColor("#ff0000")).toBe("#ff0000");
  });

  it("prepends # to raw hex values", () => {
    expect(labelColor("d73a4a")).toBe("#d73a4a");
  });
});

// ---------------------------------------------------------------------------
// labelColorAlpha
// ---------------------------------------------------------------------------

describe("labelColorAlpha", () => {
  it("returns fallback hex with alpha for empty string", () => {
    expect(labelColorAlpha("", "22")).toBe("#88888822");
  });

  it("appends alpha to # hex values", () => {
    expect(labelColorAlpha("#ff0000", "22")).toBe("#ff000022");
  });

  it("prepends # and appends alpha to raw hex values", () => {
    expect(labelColorAlpha("d73a4a", "44")).toBe("#d73a4a44");
  });
});

// ---------------------------------------------------------------------------
// filterIssues
// ---------------------------------------------------------------------------

describe("filterIssues", () => {
  const issues: IssueListItem[] = [
    {
      number: 1,
      title: "[HIGH] Login page broken",
      state: "open",
      url: "https://github.com/test/repo/issues/1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      author: { login: "alice" },
      labels: [{ name: "bug", color: "d73a4a" }],
    },
    {
      number: 2,
      title: "[LOW] Add dark mode support",
      state: "open",
      url: "https://github.com/test/repo/issues/2",
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      author: { login: "bob" },
      labels: [{ name: "enhancement", color: "a2eeef" }],
    },
  ];

  it("returns all issues for empty query", () => {
    expect(filterIssues(issues, "")).toEqual(issues);
  });

  it("filters by title", () => {
    const result = filterIssues(issues, "login");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it("filters by issue number", () => {
    const result = filterIssues(issues, "#2");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("filters by label name", () => {
    const result = filterIssues(issues, "bug");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it("is case-insensitive", () => {
    const result = filterIssues(issues, "LOGIN");
    expect(result).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    expect(filterIssues(issues, "nonexistent")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseInlineSegments
// ---------------------------------------------------------------------------

describe("parseInlineSegments", () => {
  it("returns plain text for no formatting", () => {
    const result = parseInlineSegments("Hello world");
    expect(result).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("parses bold text", () => {
    const result = parseInlineSegments("Hello **bold** world");
    expect(result).toEqual([
      { type: "text", content: "Hello " },
      { type: "bold", content: "bold" },
      { type: "text", content: " world" },
    ]);
  });

  it("parses inline code", () => {
    const result = parseInlineSegments("Use `npm install`");
    expect(result).toEqual([
      { type: "text", content: "Use " },
      { type: "code", content: "npm install" },
    ]);
  });

  it("parses links", () => {
    const result = parseInlineSegments("Visit [GitHub](https://github.com)");
    expect(result).toEqual([
      { type: "text", content: "Visit " },
      { type: "link", content: "GitHub", href: "https://github.com" },
    ]);
  });

  it("parses strikethrough", () => {
    const result = parseInlineSegments("This is ~~wrong~~ correct");
    expect(result).toEqual([
      { type: "text", content: "This is " },
      { type: "strikethrough", content: "wrong" },
      { type: "text", content: " correct" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// classifyLine
// ---------------------------------------------------------------------------

describe("classifyLine", () => {
  it("detects blank lines", () => {
    expect(classifyLine("")).toBe("blank");
  });

  it("detects headings", () => {
    expect(classifyLine("# Heading")).toBe("heading");
    expect(classifyLine("## Sub")).toBe("heading");
  });

  it("detects code fences", () => {
    expect(classifyLine("```")).toBe("code-fence");
    expect(classifyLine("```js")).toBe("code-fence");
  });

  it("detects blockquotes", () => {
    expect(classifyLine("> quote")).toBe("blockquote");
  });

  it("detects lists", () => {
    expect(classifyLine("- item")).toBe("unordered-list");
    expect(classifyLine("1. item")).toBe("ordered-list");
  });

  it("detects horizontal rules", () => {
    expect(classifyLine("---")).toBe("hr");
  });

  it("defaults to paragraph", () => {
    expect(classifyLine("Regular text")).toBe("paragraph");
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------

describe("isSafeUrl", () => {
  it("allows http/https URLs", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("rejects javascript: URIs", () => {
    expect(isSafeUrl("javascript:alert('XSS')")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects file: URLs", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(isSafeUrl("/path/to/page")).toBe(false);
  });
});
