import { describe, it, expect } from 'vitest';
import { createWikiLinkExtension, escapeHtml, renderWikiMarkdown, resolveAdoLink } from '../src/WikiMarkdownPreview';

// ── escapeHtml ──────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters together', () => {
    expect(escapeHtml('"><img src=x onerror=alert(1)>')).toBe(
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('returns plain strings unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

// ── createWikiLinkExtension ─────────────────────────────────────────

describe('createWikiLinkExtension', () => {
  it('tokenizes [[Page Name]] syntax', () => {
    const ext = createWikiLinkExtension(['Getting Started']);
    const result = ext.tokenizer('[[Getting Started]] and more');
    expect(result).toBeDefined();
    expect(result!.type).toBe('wikiLink');
    expect(result!.raw).toBe('[[Getting Started]]');
    expect(result!.pageName).toBe('Getting Started');
  });

  it('returns undefined for non-wiki-link text', () => {
    const ext = createWikiLinkExtension([]);
    expect(ext.tokenizer('no wiki links here')).toBeUndefined();
  });

  it('renders valid link with wiki-link class', () => {
    const ext = createWikiLinkExtension(['My Page']);
    const html = ext.renderer({ pageName: 'My Page' });
    expect(html).toContain('class="wiki-link"');
    expect(html).toContain('data-wiki-link="My Page"');
    expect(html).not.toContain('wiki-link-broken');
  });

  it('renders broken link with wiki-link-broken class', () => {
    const ext = createWikiLinkExtension(['Other Page']);
    const html = ext.renderer({ pageName: 'Missing Page' });
    expect(html).toContain('wiki-link-broken');
    expect(html).toContain('data-wiki-link="Missing Page"');
  });

  it('matches case-insensitively', () => {
    const ext = createWikiLinkExtension(['Getting Started']);
    const html = ext.renderer({ pageName: 'getting started' });
    expect(html).toContain('class="wiki-link"');
    expect(html).not.toContain('wiki-link-broken');
  });

  it('strips .md extension from page names for matching', () => {
    const ext = createWikiLinkExtension(['README.md']);
    const html = ext.renderer({ pageName: 'README' });
    expect(html).toContain('class="wiki-link"');
    expect(html).not.toContain('wiki-link-broken');
  });

  it('start() finds opening bracket position', () => {
    const ext = createWikiLinkExtension([]);
    expect(ext.start('foo [[bar]]')).toBe(4);
    expect(ext.start('no brackets')).toBe(-1);
  });
});

// ── renderWikiMarkdown ──────────────────────────────────────────────

describe('renderWikiMarkdown', () => {
  it('renders wiki links with data-wiki-link attributes', () => {
    const html = renderWikiMarkdown('See [[My Page]] for details.', ['My Page']);
    expect(html).toContain('data-wiki-link="My Page"');
    expect(html).toContain('class="wiki-link"');
  });

  it('marks broken links with wiki-link-broken class', () => {
    const html = renderWikiMarkdown('See [[Missing]] here.', ['Other']);
    expect(html).toContain('wiki-link-broken');
  });

  it('renders standard markdown alongside wiki links', () => {
    const html = renderWikiMarkdown('# Title\n\nSee [[Page]]', ['Page']);
    expect(html).toContain('<h1');
    expect(html).toContain('data-wiki-link="Page"');
  });

  it('renders multiple wiki links in one line', () => {
    const html = renderWikiMarkdown('Link [[A]] and [[B]].', ['A', 'B']);
    expect(html).toMatch(/data-wiki-link="A"/);
    expect(html).toMatch(/data-wiki-link="B"/);
  });

  it('handles content with no wiki links', () => {
    const html = renderWikiMarkdown('# Just markdown\n\nHello world', []);
    expect(html).toContain('<h1');
    expect(html).toContain('Hello world');
    expect(html).not.toContain('data-wiki-link');
  });

  it('renders code blocks correctly', () => {
    const html = renderWikiMarkdown('```javascript\nconst x = 1;\n```', []);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });
});

// ── XSS sanitization ────────────────────────────────────────────────

describe('renderWikiMarkdown XSS sanitization', () => {
  it('strips <script> tags from output', () => {
    const html = renderWikiMarkdown('<script>alert("xss")</script>', []);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert');
  });

  it('strips onerror handlers from img tags', () => {
    const html = renderWikiMarkdown('<img src=x onerror="alert(document.cookie)">', []);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert');
  });

  it('strips onclick handlers from elements', () => {
    const html = renderWikiMarkdown('<a onclick="alert(1)">click</a>', []);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('alert');
  });

  it('strips javascript: protocol from href', () => {
    const html = renderWikiMarkdown('<a href="javascript:alert(1)">click</a>', []);
    expect(html).not.toContain('javascript:');
  });

  it('strips iframe tags', () => {
    const html = renderWikiMarkdown('<iframe src="https://evil.com"></iframe>', []);
    expect(html).not.toContain('<iframe');
  });

  it('preserves safe markdown content after sanitization', () => {
    const html = renderWikiMarkdown('# Hello\n\n**bold** and *italic*', []);
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('preserves wiki-link data attributes after sanitization', () => {
    const html = renderWikiMarkdown('See [[My Page]] for info.', ['My Page']);
    expect(html).toContain('data-wiki-link="My Page"');
    expect(html).toContain('class="wiki-link"');
  });

  it('preserves code blocks after sanitization', () => {
    const html = renderWikiMarkdown('```javascript\nconst x = 1;\n```', []);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('preserves target attribute on external links in ADO mode', () => {
    const html = renderWikiMarkdown('[Link](https://example.com)', [], 'ado');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('href="https://example.com"');
  });

  it('escapes wiki link page names in renderer to prevent attribute breakout (issue #44)', () => {
    const ext = createWikiLinkExtension([]);
    const html = ext.renderer({ pageName: '"><img src=x onerror=alert(1)>' });
    // The renderer must escape quotes so the payload can't break out of the attribute
    expect(html).toContain('data-wiki-link="&quot;');
    // Angle brackets must be escaped at the source — no real <img> tag
    expect(html).not.toMatch(/<img\s/);
    // All dangerous characters are entity-encoded
    expect(html).toContain('&lt;img');
    expect(html).toContain('&gt;');
  });

  it('escapes single-quote XSS in wiki link page names at renderer level', () => {
    const ext = createWikiLinkExtension([]);
    const html = ext.renderer({ pageName: "'><script>alert(1)</script>" });
    // The renderer must escape angle brackets so no real tags are injected
    expect(html).not.toMatch(/<script[\s>]/);
    expect(html).toContain('&#39;');
  });

  it('prevents wiki link attribute breakout in full render pipeline (issue #44)', () => {
    const html = renderWikiMarkdown('[["><img src=x onerror=alert(1)>]]', []);
    // After DOMPurify, the quote in the attribute must remain escaped
    expect(html).toContain('data-wiki-link="&quot;');
    // The data-wiki-link attribute must not be split by unescaped quotes
    // (DOMPurify keeps unexecutable content inside quoted attributes, which is safe)
  });

  it('escapes ADO link titles to prevent attribute breakout', () => {
    const md = '[Click](./page ""><img src=x onerror=alert(1)>")';
    const html = renderWikiMarkdown(md, [], 'ado');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<img src=x');
  });
});

// ── resolveAdoLink ──────────────────────────────────────────────────

describe('resolveAdoLink', () => {
  it('resolves absolute ADO wiki paths', () => {
    expect(resolveAdoLink('/Getting-Started')).toBe('Getting-Started');
  });

  it('resolves relative ADO wiki paths', () => {
    expect(resolveAdoLink('./Sub-Page')).toBe('Sub-Page');
  });

  it('resolves paths with directory segments', () => {
    expect(resolveAdoLink('/Architecture/API-Design')).toBe('Architecture/API-Design');
  });

  it('strips .md extension', () => {
    expect(resolveAdoLink('/Page-Name.md')).toBe('Page-Name');
  });

  it('decodes URI components', () => {
    expect(resolveAdoLink('/Page%20Name')).toBe('Page Name');
  });

  it('returns null for external URLs', () => {
    expect(resolveAdoLink('https://example.com')).toBeNull();
    expect(resolveAdoLink('http://example.com')).toBeNull();
  });

  it('returns null for anchors', () => {
    expect(resolveAdoLink('#section')).toBeNull();
  });

  it('returns null for mailto links', () => {
    expect(resolveAdoLink('mailto:test@example.com')).toBeNull();
  });

  it('returns null for empty path', () => {
    expect(resolveAdoLink('/')).toBeNull();
  });
});

// ── renderWikiMarkdown ADO mode ─────────────────────────────────────

describe('renderWikiMarkdown (ADO mode)', () => {
  it('marks internal links with data-wiki-link in ADO mode', () => {
    const html = renderWikiMarkdown('[Getting Started](/Getting-Started)', [], 'ado');
    expect(html).toContain('data-wiki-link="Getting-Started"');
    expect(html).toContain('class="wiki-link"');
  });

  it('renders external links normally in ADO mode', () => {
    const html = renderWikiMarkdown('[Google](https://google.com)', [], 'ado');
    expect(html).toContain('href="https://google.com"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('data-wiki-link');
  });

  it('does not use [[wiki link]] extension in ADO mode', () => {
    const html = renderWikiMarkdown('See [[Page Name]]', ['Page Name'], 'ado');
    // In ADO mode, [[Page Name]] should NOT be processed as a wiki link
    expect(html).not.toContain('data-wiki-link="Page Name"');
  });

  it('renders standard markdown in ADO mode', () => {
    const html = renderWikiMarkdown('# Title\n\n**bold** text', [], 'ado');
    expect(html).toContain('<h1');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('handles ADO links with paths', () => {
    const html = renderWikiMarkdown('[API Guide](/docs/API-Guide)', [], 'ado');
    expect(html).toContain('data-wiki-link="docs/API-Guide"');
  });

  it('handles relative ADO links', () => {
    const html = renderWikiMarkdown('[Subpage](./Child-Page)', [], 'ado');
    expect(html).toContain('data-wiki-link="Child-Page"');
  });
});
