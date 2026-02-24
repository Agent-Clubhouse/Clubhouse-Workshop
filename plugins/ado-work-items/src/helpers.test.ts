import { describe, it, expect } from "vitest";
import {
  relativeTime,
  typeColor,
  stateColor,
  priorityLabel,
  statusBadgeStyle,
  stripHtml,
  escapeWiql,
  validateOrgUrl,
  validateProjectName,
  normalizeProjectName,
  parseRawWorkItem,
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
    // When interpolated into WIQL as: '[Field] = '${escaped}''
    // the '' is interpreted as a literal single-quote character,
    // keeping the entire value inside the string literal.
    // The original unescaped single quote is no longer present:
    expect(escaped).not.toMatch(/[^']'[^']/);
  });

  it("handles a value that is only a single quote", () => {
    expect(escapeWiql("'")).toBe("''");
  });

  it("handles consecutive single quotes", () => {
    expect(escapeWiql("'''")).toBe("''''''");
  });
});

// ---------------------------------------------------------------------------
// validateOrgUrl — prevents command injection via organization URL setting
// ---------------------------------------------------------------------------

describe("validateOrgUrl", () => {
  it("accepts standard dev.azure.com URLs", () => {
    expect(validateOrgUrl("https://dev.azure.com/my-org")).toBe(true);
    expect(validateOrgUrl("https://dev.azure.com/myOrg123")).toBe(true);
  });

  it("accepts dev.azure.com URLs with trailing slash", () => {
    expect(validateOrgUrl("https://dev.azure.com/my-org/")).toBe(true);
  });

  it("accepts visualstudio.com URLs", () => {
    expect(validateOrgUrl("https://my-org.visualstudio.com")).toBe(true);
    expect(validateOrgUrl("https://my-org.visualstudio.com/")).toBe(true);
  });

  it("rejects HTTP (non-HTTPS) URLs", () => {
    expect(validateOrgUrl("http://dev.azure.com/my-org")).toBe(false);
  });

  it("rejects URLs with shell metacharacters", () => {
    expect(validateOrgUrl("https://dev.azure.com/test; echo pwned")).toBe(false);
    expect(validateOrgUrl("https://dev.azure.com/test$(whoami)")).toBe(false);
    expect(validateOrgUrl("https://dev.azure.com/test`id`")).toBe(false);
    expect(validateOrgUrl("https://dev.azure.com/test|cat /etc/passwd")).toBe(false);
    expect(validateOrgUrl("https://dev.azure.com/test&rm -rf /")).toBe(false);
  });

  it("rejects URLs with extra path segments", () => {
    expect(validateOrgUrl("https://dev.azure.com/my-org/extra/path")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateOrgUrl("")).toBe(false);
  });

  it("rejects arbitrary URLs", () => {
    expect(validateOrgUrl("https://evil.com/dev.azure.com/my-org")).toBe(false);
    expect(validateOrgUrl("https://example.com")).toBe(false);
  });

  it("rejects URLs with query strings or fragments", () => {
    expect(validateOrgUrl("https://dev.azure.com/my-org?foo=bar")).toBe(false);
    expect(validateOrgUrl("https://dev.azure.com/my-org#section")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateProjectName — prevents command injection via project name setting
// ---------------------------------------------------------------------------

describe("validateProjectName", () => {
  it("accepts typical project names", () => {
    expect(validateProjectName("MyProject")).toBe(true);
    expect(validateProjectName("My Project")).toBe(true);
    expect(validateProjectName("my-project")).toBe(true);
    expect(validateProjectName("my_project")).toBe(true);
    expect(validateProjectName("project.v2")).toBe(true);
  });

  it("accepts names with mixed allowed characters", () => {
    expect(validateProjectName("Contoso Web App 2.0")).toBe(true);
    expect(validateProjectName("Team-A_Sprint.1")).toBe(true);
  });

  it("accepts names with parentheses", () => {
    expect(validateProjectName("Kaizen (AIPF)")).toBe(true);
    expect(validateProjectName("Project (v2)")).toBe(true);
    expect(validateProjectName("(Internal)")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateProjectName("")).toBe(false);
  });

  it("rejects names with shell metacharacters", () => {
    expect(validateProjectName("test; echo pwned")).toBe(false);
    expect(validateProjectName("test$(whoami)")).toBe(false);
    expect(validateProjectName("test`id`")).toBe(false);
    expect(validateProjectName("test|cat")).toBe(false);
    expect(validateProjectName("test&rm")).toBe(false);
    expect(validateProjectName("test>file")).toBe(false);
    expect(validateProjectName("test<file")).toBe(false);
  });

  it("rejects names with quotes", () => {
    expect(validateProjectName("test'injection")).toBe(false);
    expect(validateProjectName('test"injection')).toBe(false);
  });

  it("rejects names with slashes", () => {
    expect(validateProjectName("test/path")).toBe(false);
    expect(validateProjectName("test\\path")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeProjectName — decodes URI-encoded project names
// ---------------------------------------------------------------------------

describe("normalizeProjectName", () => {
  it("decodes %20 to spaces", () => {
    expect(normalizeProjectName("Kaizen%20(AIPF)")).toBe("Kaizen (AIPF)");
  });

  it("returns plain names unchanged", () => {
    expect(normalizeProjectName("MyProject")).toBe("MyProject");
    expect(normalizeProjectName("Kaizen (AIPF)")).toBe("Kaizen (AIPF)");
  });

  it("decodes multiple encoded characters", () => {
    expect(normalizeProjectName("My%20Project%20(v2)")).toBe("My Project (v2)");
  });

  it("returns empty string unchanged", () => {
    expect(normalizeProjectName("")).toBe("");
  });

  it("returns invalid percent sequences unchanged", () => {
    expect(normalizeProjectName("test%ZZvalue")).toBe("test%ZZvalue");
  });
});

// ---------------------------------------------------------------------------
// parseRawWorkItem — extracts work item fields from az CLI response objects
// ---------------------------------------------------------------------------

describe("parseRawWorkItem", () => {
  it("returns null when object has no fields property", () => {
    expect(parseRawWorkItem({ id: 1 })).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(parseRawWorkItem({})).toBeNull();
  });

  it("parses a full work item response", () => {
    const raw = {
      id: 246,
      fields: {
        "System.Id": 246,
        "System.Title": "Fix login bug",
        "System.State": "Active",
        "System.WorkItemType": "Bug",
        "System.AssignedTo": "Jane Doe",
        "System.ChangedDate": "2026-02-24T10:00:00Z",
        "System.Tags": "frontend; urgent",
        "Microsoft.VSTS.Common.Priority": 2,
        "System.AreaPath": "MyProject\\Frontend",
        "System.IterationPath": "MyProject\\Sprint 1",
      },
    };
    const result = parseRawWorkItem(raw);
    expect(result).toEqual({
      id: 246,
      title: "Fix login bug",
      state: "Active",
      workItemType: "Bug",
      assignedTo: "Jane Doe",
      changedDate: "2026-02-24T10:00:00Z",
      tags: "frontend; urgent",
      priority: 2,
      areaPath: "MyProject\\Frontend",
      iterationPath: "MyProject\\Sprint 1",
    });
  });

  it("handles identity object for AssignedTo (displayName)", () => {
    const raw = {
      id: 100,
      fields: {
        "System.Title": "Task",
        "System.State": "New",
        "System.WorkItemType": "Task",
        "System.AssignedTo": { displayName: "John Smith", uniqueName: "jsmith@example.com" },
        "System.ChangedDate": "2026-01-01T00:00:00Z",
      },
    };
    const result = parseRawWorkItem(raw);
    expect(result).not.toBeNull();
    expect(result!.assignedTo).toBe("John Smith");
  });

  it("falls back to uniqueName when displayName is missing", () => {
    const raw = {
      id: 101,
      fields: {
        "System.Title": "Task",
        "System.State": "New",
        "System.WorkItemType": "Task",
        "System.AssignedTo": { uniqueName: "jsmith@example.com" },
        "System.ChangedDate": "2026-01-01T00:00:00Z",
      },
    };
    const result = parseRawWorkItem(raw);
    expect(result).not.toBeNull();
    expect(result!.assignedTo).toBe("jsmith@example.com");
  });

  it("handles missing optional fields with defaults", () => {
    const raw = {
      id: 200,
      fields: {
        "System.Title": "Minimal item",
        "System.State": "New",
        "System.WorkItemType": "Task",
        "System.ChangedDate": "2026-01-15T00:00:00Z",
      },
    };
    const result = parseRawWorkItem(raw);
    expect(result).not.toBeNull();
    expect(result!.assignedTo).toBe("");
    expect(result!.tags).toBe("");
    expect(result!.priority).toBe(0);
    expect(result!.areaPath).toBe("");
    expect(result!.iterationPath).toBe("");
  });

  it("handles response matching az boards query format (System.Id only in fields)", () => {
    // This is the format returned by az boards query --wiql "SELECT [System.Id] ..."
    const raw = {
      id: 246,
      fields: { "System.Id": 246 },
      multilineFieldsFormat: {},
      relations: null,
      rev: 4,
      url: "https://freemasoninc.visualstudio.com/_apis/wit/workItems/246",
    };
    const result = parseRawWorkItem(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(246);
    expect(result!.title).toBe("");
    expect(result!.state).toBe("");
  });
});
