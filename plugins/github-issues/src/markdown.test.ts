import { describe, it, expect } from 'vitest';
import { isSafeUrl, parseInlineSegments } from './helpers';

// ---------------------------------------------------------------------------
// Markdown rendering XSS prevention (Issues #47, #48)
//
// The github-issues plugin uses a JSX-based markdown renderer (renderInline
// in main.tsx) that guards links and images with isSafeUrl(). These tests
// verify the security contract: unsafe URLs must be blocked at the helper
// layer so the renderer never emits dangerous href or src attributes.
// ---------------------------------------------------------------------------

describe('markdown link XSS prevention', () => {
  it('blocks javascript: URIs in link context', () => {
    expect(isSafeUrl("javascript:alert('XSS')")).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });

  it('blocks javascript: URIs with encoding tricks', () => {
    expect(isSafeUrl('javascript:void(0)')).toBe(false);
  });

  it('blocks data: URIs that could execute scripts', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
  });

  it('blocks vbscript: URIs', () => {
    expect(isSafeUrl("vbscript:MsgBox('XSS')")).toBe(false);
  });

  it('blocks file: URIs (SSRF vector)', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('file:///C:/Windows/System32')).toBe(false);
  });

  it('blocks protocol-relative URLs', () => {
    expect(isSafeUrl('//evil.com/payload.js')).toBe(false);
  });

  it('allows safe http/https URLs', () => {
    expect(isSafeUrl('https://github.com/user/repo')).toBe(true);
    expect(isSafeUrl('http://example.com/image.png')).toBe(true);
  });
});

describe('markdown image XSS prevention', () => {
  it('blocks javascript: in image src', () => {
    expect(isSafeUrl("javascript:alert('img-xss')")).toBe(false);
  });

  it('blocks data: SVG payloads in image src', () => {
    expect(isSafeUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=')).toBe(false);
  });

  it('allows safe image URLs', () => {
    expect(isSafeUrl('https://avatars.githubusercontent.com/u/1234?v=4')).toBe(true);
    expect(isSafeUrl('https://img.shields.io/badge/test-passing-green')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseInlineSegments security — verify parsed segments preserve the original
// href so isSafeUrl can reject dangerous URIs at render time
// ---------------------------------------------------------------------------

describe('parseInlineSegments security', () => {
  it('preserves javascript: href on link segments for validation', () => {
    // The regex captures href up to the first ")", so "javascript:alert(1)"
    // is parsed as href="javascript:alert(1" — isSafeUrl still rejects it.
    const segments = parseInlineSegments('[click](javascript:void)');
    const link = segments.find((s) => s.type === 'link');
    expect(link).toBeDefined();
    expect(link!.href).toBe('javascript:void');
    // Renderer must reject this via isSafeUrl
    expect(isSafeUrl(link!.href!)).toBe(false);
  });

  it('preserves data: src on image segments for validation', () => {
    const segments = parseInlineSegments('![img](data:text/html,<script>alert(1)</script>)');
    const img = segments.find((s) => s.type === 'image');
    expect(img).toBeDefined();
    expect(img!.href).toContain('data:');
    // Renderer must reject this via isSafeUrl
    expect(isSafeUrl(img!.href!)).toBe(false);
  });

  it('preserves safe https href for validation', () => {
    const segments = parseInlineSegments('[GitHub](https://github.com)');
    const link = segments.find((s) => s.type === 'link');
    expect(link).toBeDefined();
    expect(link!.href).toBe('https://github.com');
    expect(isSafeUrl(link!.href!)).toBe(true);
  });

  it('preserves safe image src for validation', () => {
    const segments = parseInlineSegments('![avatar](https://example.com/pic.png)');
    const img = segments.find((s) => s.type === 'image');
    expect(img).toBeDefined();
    expect(img!.href).toBe('https://example.com/pic.png');
    expect(isSafeUrl(img!.href!)).toBe(true);
  });
});
