/**
 * File icon color mapping based on file extension.
 */

import { color } from './styles';

const EXT_COLORS: Record<string, string> = {
  // Markdown
  md: color.blue,
  mdx: color.blue,
  // JavaScript/TypeScript
  js: color.yellow,
  jsx: color.yellow,
  ts: color.blue,
  tsx: color.blue,
  // Config/data
  json: color.green,
  yaml: color.green,
  yml: color.green,
  toml: color.green,
  xml: color.orange,
  // Styles
  css: color.purple,
  scss: color.purple,
  less: color.purple,
  // Shell
  sh: color.green,
  bash: color.green,
  zsh: color.green,
  // Python
  py: color.blue,
  // Rust
  rs: color.orange,
  // Go
  go: color.cyan,
  // HTML
  html: color.orange,
  htm: color.orange,
  // Images
  png: color.purple,
  jpg: color.purple,
  jpeg: color.purple,
  gif: color.purple,
  svg: color.purple,
  // Text
  txt: color.textSecondary,
  log: color.textSecondary,
};

export function getFileIconColor(ext: string): string {
  return EXT_COLORS[ext.toLowerCase()] || color.textSecondary;
}
