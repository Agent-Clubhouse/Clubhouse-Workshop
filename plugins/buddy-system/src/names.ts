// ---------------------------------------------------------------------------
// Random Name Generator
// Pattern: {adjective}-{group-word} — ~600 unique combinations
// ---------------------------------------------------------------------------

const ADJECTIVES = [
  "bold", "brave", "bright", "clever", "cosmic",
  "daring", "epic", "fierce", "golden", "grand",
  "hidden", "iron", "keen", "lunar", "mighty",
  "noble", "prime", "proud", "rapid", "regal",
  "royal", "shadow", "silent", "solar", "stellar",
  "swift", "valiant", "vivid", "wild", "wise",
] as const;

const GROUP_WORDS = [
  "alliance", "band", "brigade", "cadre", "clan",
  "cohort", "crew", "ensemble", "force", "guild",
  "league", "order", "pack", "patrol", "posse",
  "squad", "team", "troupe", "unit", "vanguard",
] as const;

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random group name like "cosmic-guild".
 * If `existing` is provided, avoids collisions (retries up to 50 times).
 */
export function generateGroupName(existing?: Set<string>): string {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const name = `${randomItem(ADJECTIVES)}-${randomItem(GROUP_WORDS)}`;
    if (!existing || !existing.has(name)) return name;
  }
  // Fallback: append a numeric suffix
  const base = `${randomItem(ADJECTIVES)}-${randomItem(GROUP_WORDS)}`;
  return `${base}-${Date.now() % 10000}`;
}

/** Expose pools for testing */
export const ADJECTIVE_POOL = ADJECTIVES;
export const GROUP_WORD_POOL = GROUP_WORDS;
