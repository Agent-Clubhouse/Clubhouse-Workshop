/**
 * Convert a wiki filename to a human-readable title.
 * Strips .md extension, converts hyphens/underscores to spaces,
 * and title-cases each word. ADO wikis use %2D for literal hyphens.
 */
export function prettifyName(name: string, wikiStyle: string = 'github'): string {
  let base = name.replace(/\.md$/i, '');
  if (wikiStyle === 'ado') {
    base = base.replace(/%2D/gi, '\x00').replace(/-/g, ' ').replace(/\x00/g, '-');
  } else {
    base = base.replace(/[-_]/g, ' ');
  }
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}
