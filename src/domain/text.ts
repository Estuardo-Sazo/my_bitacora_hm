/** Lowercases, removes accents and collapses spaces, including non-breaking ones. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Optimal string alignment distance: edits, counting a swap of neighbours as one. */
export function editDistance(a: string, b: string): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => rows[i]?.[j] ?? 0;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      (rows[i] as number[])[j] = best;
    }
  }
  return at(a.length, b.length);
}

/**
 * Edits tolerated for a word of this length. Short words stay strict on purpose: `Notas` and
 * `Zonas` are two edits apart and are different modules.
 */
function allowedEdits(length: number): number {
  if (length >= 7) return 2;
  if (length >= 4) return 1;
  return 0;
}

/** Finds the catalog value `value` is a typo of. Ties return null: better to ask than to guess. */
export function closestMatch(value: string, catalog: readonly string[]): string | null {
  const target = normalizeText(value);
  const limit = allowedEdits(target.length);
  if (limit === 0) return null;

  let bestDistance = Number.POSITIVE_INFINITY;
  let matches: string[] = [];
  for (const candidate of catalog) {
    const distance = editDistance(target, normalizeText(candidate));
    if (distance > limit) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      matches = [candidate];
    } else if (distance === bestDistance) {
      matches.push(candidate);
    }
  }
  return matches.length === 1 ? (matches[0] ?? null) : null;
}
