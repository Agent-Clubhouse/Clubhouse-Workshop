/**
 * File icon color mapping based on file extension.
 */

const EXT_COLORS: Record<string, string> = {
  // Markdown
  md: '#3b82f6',
  mdx: '#3b82f6',
  // JavaScript/TypeScript
  js: '#eab308',
  jsx: '#eab308',
  ts: '#3b82f6',
  tsx: '#3b82f6',
  // Config/data
  json: '#22c55e',
  yaml: '#22c55e',
  yml: '#22c55e',
  toml: '#22c55e',
  xml: '#f97316',
  // Styles
  css: '#a855f7',
  scss: '#a855f7',
  less: '#a855f7',
  // Shell
  sh: '#22c55e',
  bash: '#22c55e',
  zsh: '#22c55e',
  // Python
  py: '#3b82f6',
  // Rust
  rs: '#f97316',
  // Go
  go: '#06b6d4',
  // HTML
  html: '#f97316',
  htm: '#f97316',
  // Images
  png: '#a855f7',
  jpg: '#a855f7',
  jpeg: '#a855f7',
  gif: '#a855f7',
  svg: '#a855f7',
  // Text
  txt: '#a1a1aa',
  log: '#a1a1aa',
};

const DEFAULT_COLOR = '#a1a1aa';

export function getFileIconColor(ext: string): string {
  return EXT_COLORS[ext.toLowerCase()] || DEFAULT_COLOR;
}
