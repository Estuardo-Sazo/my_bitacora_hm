import type { IsoDate } from '@/domain/types';

const PREFIX = 'bitacora.draft';

const keyFor = (scope: string, date: IsoDate): string => `${PREFIX}.${scope}.${date}`;

/**
 * Notes not yet added to the day. They are written synchronously on every keystroke so a crash or
 * a closed tab loses nothing, which a debounced database write could not promise.
 */
export function readDraft(scope: string, date: IsoDate): string {
  return localStorage.getItem(keyFor(scope, date)) ?? '';
}

export function writeDraft(scope: string, date: IsoDate, text: string): void {
  if (text.trim()) localStorage.setItem(keyFor(scope, date), text);
  else localStorage.removeItem(keyFor(scope, date));
}

export function listDraftDates(scope: string): IsoDate[] {
  const prefix = `${PREFIX}.${scope}.`;
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort();
}
