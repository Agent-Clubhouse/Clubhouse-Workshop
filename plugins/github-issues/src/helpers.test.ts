import { describe, it, expect } from "vitest";
import {
  relativeTime,
  labelColor,
  labelColorAlpha,
  extractYamlValue,
  filterIssues,
  parseInlineSegments,
  classifyLine,
  isSafeUrl,
  IssueListItem,
} from "./helpers";

// ---------------------------------------------------------------------------
// relativeTime
// ---------------------------------------------------------------------------

describe("relativeTime", () => {
  it("returns 'just now' for recent dates", () => {
    const now = new Date().toISOString();
    expect(relativeTime(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(relativeTime(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(relativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(relativeTime(twoDaysAgo)).toBe("2d ago");
  });

  it("returns months ago", () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString();
    expect(relativeTime(sixtyDaysAgo)).toBe("2mo ago");
  });
});

// ---------------------------------------------------------------------------
// labelColor
// ---------------------------------------------------------------------------

describe("labelColor", () => {
  it("returns CSS variable with fallback for empty string", () => {
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
  it("returns 6-digit hex with alpha for empty string", () => {
    expect(labelColorAlpha("", "22")).toBe("#88888822");
    expect(labelColorAlpha("", "44")).toBe("#88888844");
  });

  it("appends alpha to hex values starting with #", () => {
    expect(labelColorAlpha("#ff0000", "22")).toBe("#ff000022");
  });

  it("prepends # and appends alpha to raw hex values", () => {
    expect(labelColorAlpha("d73a4a", "44")).toBe("#d73a4a44");
  });
});

// ---------------------------------------------------------------------------
// extractYamlValue
// ---------------------------------------------------------------------------

describe("extractYamlValue", () => {
  it("extracts unquoted values", () => {
    expect(extractYamlValue("name: Bug Report", "name")).toBe("Bug Report");
  });

  it("extracts quoted values", () => {
    expect(extractYamlValue("title: 'My Title'", "title")).toBe("My Title");
  });

  it("returns null for missing keys", () => {
    expect(extractYamlValue("name: Bug Report", "description")).toBeNull();
  });

  it("handles multiline yaml", () => {
    const yaml = "name: Bug Report\ndescription: File a bug\ntitle: '[Bug] '";
    expect(extractYamlValue(yaml, "description")).toBe("File a bug");
    expect(extractYamlValue(yaml, "name")).toBe("Bug Report");
  });
});

// ---------------------------------------------------------------------------
// filterIssues
// ---------------------------------------------------------------------------

describe("filterIssues", () => {
  const issues: IssueListItem[] = [
    {
      number: 1,
      title: "Fix login page",
      state: "open",
      url: "https://github.com/test/repo/issues/1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      author: { login: "alice" },
      labels: [{ name: "bug", color: "d73a4a" }],
    },
    {
      number: 2,
      title: "Add dark mode",
      state: "open",
      url: "https://github.com/test/repo/issues/2",
      createdAt: "2024-01-02T00:00:00Z",
      updatedAt: "2024-01-02T00:00:00Z",
      author: { login: "bob" },
      labels: [{ name: "enhancement", color: "a2eeef" }],
    },
    {
      number: 3,
      title: "Update README",
      state: "open",
      url: "https://github.com/test/repo/issues/3",
      createdAt: "2024-01-03T00:00:00Z",
      updatedAt: "2024-01-03T00:00:00Z",
      author: { login: "charlie" },
      labels: [
        { name: "documentation", color: "0075ca" },
        { name: "good first issue", color: "7057ff" },
      ],
    },
  ];

  it("returns all issues for empty query", () => {
    expect(filterIssues(issues, "")).toEqual(issues);
    expect(filterIssues(issues, "  ")).toEqual(issues);
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

  it("filters by partial label name", () => {
    const result = filterIssues(issues, "enhance");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(2);
  });

  it("is case-insensitive for labels", () => {
    const result = filterIssues(issues, "BUG");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(1);
  });

  it("matches labels with spaces", () => {
    const result = filterIssues(issues, "good first");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(3);
  });

  it("returns empty for no matches", () => {
    expect(filterIssues(issues, "nonexistent")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseInlineSegments (markdown inline parsing)
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

  it("parses italic text", () => {
    const result = parseInlineSegments("Hello *italic* world");
    expect(result).toEqual([
      { type: "text", content: "Hello " },
      { type: "italic", content: "italic" },
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

  it("parses images", () => {
    const result = parseInlineSegments("![alt text](https://example.com/img.png)");
    expect(result).toEqual([
      { type: "image", content: "alt text", href: "https://example.com/img.png" },
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

  it("handles mixed inline formatting", () => {
    const result = parseInlineSegments("**bold** and `code` and *italic*");
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ type: "bold", content: "bold" });
    expect(result[2]).toEqual({ type: "code", content: "code" });
    expect(result[4]).toEqual({ type: "italic", content: "italic" });
  });
});

// ---------------------------------------------------------------------------
// classifyLine (markdown block detection)
// ---------------------------------------------------------------------------

describe("classifyLine", () => {
  it("detects blank lines", () => {
    expect(classifyLine("")).toBe("blank");
    expect(classifyLine("   ")).toBe("blank");
  });

  it("detects headings", () => {
    expect(classifyLine("# Heading")).toBe("heading");
    expect(classifyLine("## Subheading")).toBe("heading");
    expect(classifyLine("###### H6")).toBe("heading");
  });

  it("detects code fences", () => {
    expect(classifyLine("```")).toBe("code-fence");
    expect(classifyLine("```javascript")).toBe("code-fence");
  });

  it("detects blockquotes", () => {
    expect(classifyLine("> quote")).toBe("blockquote");
    expect(classifyLine(">")).toBe("blockquote");
  });

  it("detects unordered lists", () => {
    expect(classifyLine("- item")).toBe("unordered-list");
    expect(classifyLine("* item")).toBe("unordered-list");
    expect(classifyLine("+ item")).toBe("unordered-list");
  });

  it("detects ordered lists", () => {
    expect(classifyLine("1. item")).toBe("ordered-list");
    expect(classifyLine("12) item")).toBe("ordered-list");
  });

  it("detects horizontal rules", () => {
    expect(classifyLine("---")).toBe("hr");
    expect(classifyLine("***")).toBe("hr");
    expect(classifyLine("___")).toBe("hr");
  });

  it("defaults to paragraph", () => {
    expect(classifyLine("Regular text")).toBe("paragraph");
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl (XSS/SSRF prevention — Issues #47, #48)
// ---------------------------------------------------------------------------

describe("isSafeUrl", () => {
  it("allows http URLs", () => {
    expect(isSafeUrl("http://example.com")).toBe(true);
  });

  it("allows https URLs", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
  });

  it("is case-insensitive for protocol", () => {
    expect(isSafeUrl("HTTP://example.com")).toBe(true);
    expect(isSafeUrl("HTTPS://example.com")).toBe(true);
    expect(isSafeUrl("Https://example.com")).toBe(true);
  });

  it("rejects javascript: URIs", () => {
    expect(isSafeUrl("javascript:alert('XSS')")).toBe(false);
  });

  it("rejects javascript: URIs with encoding tricks", () => {
    expect(isSafeUrl("javascript:document.location='https://evil.com'")).toBe(false);
    expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
  });

  it("rejects vbscript: URIs", () => {
    expect(isSafeUrl("vbscript:MsgBox('XSS')")).toBe(false);
  });

  it("rejects ftp: URLs", () => {
    expect(isSafeUrl("ftp://example.com/img.png")).toBe(false);
  });

  it("rejects file: URLs", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(isSafeUrl("/path/to/page")).toBe(false);
    expect(isSafeUrl("relative/path")).toBe(false);
    expect(isSafeUrl("../path.png")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isSafeUrl("")).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeUrl("//evil.com/payload")).toBe(false);
  });
});
