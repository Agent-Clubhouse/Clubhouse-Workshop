import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { relativeTime, isSafeUrl } from './helpers';

describe('relativeTime', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns "just now" for recent dates', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:30Z'));
    expect(relativeTime('2026-01-15T12:00:00Z')).toBe('just now');
  });

  it('returns minutes ago', () => {
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'));
    expect(relativeTime('2026-01-15T12:00:00Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    vi.setSystemTime(new Date('2026-01-15T15:00:00Z'));
    expect(relativeTime('2026-01-15T12:00:00Z')).toBe('3h ago');
  });

  it('returns days ago', () => {
    vi.setSystemTime(new Date('2026-01-20T12:00:00Z'));
    expect(relativeTime('2026-01-15T12:00:00Z')).toBe('5d ago');
  });

  it('returns months ago', () => {
    vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    expect(relativeTime('2026-01-15T12:00:00Z')).toBe('3mo ago');
  });
});

describe('isSafeUrl', () => {
  it('accepts http URLs', () => {
    expect(isSafeUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isSafeUrl('https://example.com/path')).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<h1>Hi</h1>')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isSafeUrl('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSafeUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });
});
