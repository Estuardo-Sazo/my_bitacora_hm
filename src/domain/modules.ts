import { closestMatch, normalizeText } from './text';

export interface ModuleMatch {
  module: string;
  /** How many leading words of the input the module used. */
  wordsUsed: number;
  /** The original text, when it was corrected from a typo. */
  correctedFrom: string | null;
}

const MAX_MODULE_WORDS = 3;

/** Finds a module at the start of `words`, trying longer names first (`Pagina Web` over `Pagina`). */
export function matchModule(
  words: readonly string[],
  modules: readonly string[],
): ModuleMatch | null {
  const byNormalizedName = new Map(modules.map((module) => [normalizeText(module), module]));

  for (let size = Math.min(MAX_MODULE_WORDS, words.length); size >= 1; size -= 1) {
    const candidate = words.slice(0, size).join(' ');
    const exact = byNormalizedName.get(normalizeText(candidate));
    if (exact) return { module: exact, wordsUsed: size, correctedFrom: null };
  }

  const firstWord = words[0];
  if (firstWord === undefined) return null;
  const close = closestMatch(firstWord, modules);
  return close ? { module: close, wordsUsed: 1, correctedFrom: firstWord } : null;
}

/** Case-insensitive catalog lookup, returning the canonical spelling. */
export function canonicalModule(value: string, modules: readonly string[]): string | null {
  const target = normalizeText(value);
  return modules.find((module) => normalizeText(module) === target) ?? null;
}
