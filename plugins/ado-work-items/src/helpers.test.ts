import { describe, it, expect } from "vitest";
import {
  relativeTime,
  typeColor,
  stateColor,
  priorityLabel,
  statusBadgeStyle,
  stripHtml,
  escapeWiql,
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
// typeColor — must return CSS custom property references with fallbacks
// ---------------------------------------------------------------------------

describe("typeColor", () => {
  it("returns var(--text-error) for bug", () => {
    expect(typeColor("Bug")).toBe("var(--text-error, #cc293d)");
  });

  it("returns var(--text-warning) for task", () => {
    expect(typeColor("Task")).toBe("var(--text-warning, #f2cb1d)");
  });

  it("returns var(--text-info) for user story", () => {
    expect(typeColor("User Story")).toBe("var(--text-info, #009ccc)");
  });

  it("returns var(--text-info) for product backlog item", () => {
    expect(typeColor("Product Backlog Item")).toBe("var(--text-info, #009ccc)");
  });

  it("returns var(--text-accent) for feature", () => {
    expect(typeColor("Feature")).toBe("var(--text-accent, #773b93)");
  });

  it("returns var(--text-warning) for epic", () => {
    expect(typeColor("Epic")).toBe("var(--text-warning, #ff7b00)");
  });

  it("returns var(--text-info) for issue", () => {
    expect(typeColor("Issue")).toBe("var(--text-info, #009ccc)");
  });

  it("returns var(--text-error) for impediment", () => {
    expect(typeColor("Impediment")).toBe("var(--text-error, #cc293d)");
  });

  it("returns var(--text-tertiary) for unknown types", () => {
    expect(typeColor("Unknown")).toBe("var(--text-tertiary, #888)");
  });

  it("is case-insensitive", () => {
    expect(typeColor("BUG")).toBe("var(--text-error, #cc293d)");
    expect(typeColor("bug")).toBe("var(--text-error, #cc293d)");
  });

  it("always returns a var() reference", () => {
    const types = ["Bug", "Task", "User Story", "Feature", "Epic", "Issue", "Impediment", "Whatever"];
    for (const t of types) {
      expect(typeColor(t)).toMatch(/^var\(--[a-z-]+,\s*#[0-9a-fA-F]+\)$/);
    }
  });
});

// ---------------------------------------------------------------------------
// stateColor — must return CSS custom property references with fallbacks
// ---------------------------------------------------------------------------

describe("stateColor", () => {
  it("returns themed colors for 'New'", () => {
    const c = stateColor("New");
    expect(c.fg).toMatch(/^var\(--/);
    expect(c.bg).toMatch(/^var\(--/);
    expect(c.border).toMatch(/^var\(--/);
  });

  it("returns themed colors for 'Active'", () => {
    const c = stateColor("Active");
    expect(c.fg).toMatch(/^var\(--/);
    expect(c.bg).toMatch(/^var\(--/);
    expect(c.border).toMatch(/^var\(--/);
  });

  it("returns themed colors for 'Resolved'", () => {
    const c = stateColor("Resolved");
    expect(c.fg).toMatch(/^var\(--/);
    expect(c.bg).toMatch(/^var\(--/);
    expect(c.border).toMatch(/^var\(--/);
  });

  it("returns themed colors for 'Closed'", () => {
    const c = stateColor("Closed");
    expect(c.fg).toMatch(/^var\(--/);
    expect(c.bg).toMatch(/^var\(--/);
    expect(c.border).toMatch(/^var\(--/);
  });

  it("returns themed colors for unknown states", () => {
    const c = stateColor("SomeUnknownState");
    expect(c.fg).toMatch(/^var\(--/);
    expect(c.bg).toMatch(/^var\(--/);
    expect(c.border).toMatch(/^var\(--/);
  });

  it("is case-insensitive", () => {
    const upper = stateColor("ACTIVE");
    const lower = stateColor("active");
    expect(upper).toEqual(lower);
  });

  it("maps 'To Do' and 'Proposed' to same category as 'New'", () => {
    expect(stateColor("To Do")).toEqual(stateColor("New"));
    expect(stateColor("Proposed")).toEqual(stateColor("New"));
  });

  it("maps 'In Progress', 'Committed', 'Doing' to same category as 'Active'", () => {
    expect(stateColor("In Progress")).toEqual(stateColor("Active"));
    expect(stateColor("Committed")).toEqual(stateColor("Active"));
    expect(stateColor("Doing")).toEqual(stateColor("Active"));
  });

  it("maps 'Done' to same category as 'Resolved'", () => {
    expect(stateColor("Done")).toEqual(stateColor("Resolved"));
  });

  it("maps 'Removed' to same category as 'Closed'", () => {
    expect(stateColor("Removed")).toEqual(stateColor("Closed"));
  });
});

// ---------------------------------------------------------------------------
// statusBadgeStyle — must return CSS custom property references
// ---------------------------------------------------------------------------

describe("statusBadgeStyle", () => {
  it("uses themed green for sleeping", () => {
    const style = statusBadgeStyle("sleeping");
    expect(style.color).toMatch(/^var\(--/);
    expect(style.background as string).toMatch(/^var\(--/);
  });

  it("uses themed yellow for running", () => {
    const style = statusBadgeStyle("running");
    expect(style.color).toMatch(/^var\(--/);
    expect(style.background as string).toMatch(/^var\(--/);
  });

  it("uses themed red for error", () => {
    const style = statusBadgeStyle("error");
    expect(style.color).toMatch(/^var\(--text-error/);
    expect(style.background as string).toMatch(/^var\(--bg-error/);
  });

  it("returns base styles without color for unknown status", () => {
    const style = statusBadgeStyle("unknown");
    expect(style.color).toBeUndefined();
    expect(style.fontSize).toBe("9px");
  });
});

// ---------------------------------------------------------------------------
// priorityLabel
// ---------------------------------------------------------------------------

describe("priorityLabel", () => {
  it("returns correct labels", () => {
    expect(priorityLabel(1)).toBe("Critical");
    expect(priorityLabel(2)).toBe("High");
    expect(priorityLabel(3)).toBe("Medium");
    expect(priorityLabel(4)).toBe("Low");
    expect(priorityLabel(0)).toBe("");
    expect(priorityLabel(5)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// stripHtml
// ---------------------------------------------------------------------------

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("converts br to newlines", () => {
    expect(stripHtml("line1<br/>line2")).toBe("line1\nline2");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39;")).toBe('& < > " \'');
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });

  it("collapses excessive newlines", () => {
    expect(stripHtml("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });
});

// ---------------------------------------------------------------------------
// escapeWiql — prevents WIQL injection by escaping single quotes
// ---------------------------------------------------------------------------

describe("escapeWiql", () => {
  it("returns normal strings unchanged", () => {
    expect(escapeWiql("MyProject")).toBe("MyProject");
    expect(escapeWiql("Project\\Team")).toBe("Project\\Team");
  });

  it("doubles single quotes", () => {
    expect(escapeWiql("it's")).toBe("it''s");
  });

  it("handles multiple single quotes", () => {
    expect(escapeWiql("it's a 'test'")).toBe("it''s a ''test''");
  });

  it("handles empty string", () => {
    expect(escapeWiql("")).toBe("");
  });

  it("neutralizes a basic injection payload", () => {
    const payload = "MyProject' OR 1=1 --";
    const escaped = escapeWiql(payload);
    expect(escaped).toBe("MyProject'' OR 1=1 --");
    // When interpolated into WIQL: '...MyProject'' OR 1=1 --...'
    // The doubled quote stays inside the string literal, so injection fails
    expect(escaped).not.toContain("' OR");
  });

  it("handles a value that is only a single quote", () => {
    expect(escapeWiql("'")).toBe("''");
  });

  it("handles consecutive single quotes", () => {
    expect(escapeWiql("'''")).toBe("''''''");
  });
});
