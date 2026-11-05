import { formatCsvDate } from '../dates';
import { scheduleDay } from '../scheduler';
import { formatClock } from '../time';
import type { DayLog, DayStatus, ScheduledRow, Settings } from '../types';
import { encodeWindows1252 } from './windows1252';
import type { EncodedText } from './windows1252';

/** Exact column order the target system imports. Unused columns stay in place, empty. */
export const CSV_COLUMNS = [
  'Fecha',
  'Inicio',
  'Fin',
  'Duracion',
  'Modulo',
  'Categoria',
  'Subcat PSP',
  'Bug',
  'Bug Categoria',
  'Bug Descripcion',
  'Cliente',
  'Contacto',
  'Actividad',
  'Solicitado por',
] as const;

const LINE_BREAK = '\r\n';

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function rowToLine(row: ScheduledRow): string {
  return [
    formatCsvDate(row.date),
    formatClock(row.startMinutes),
    formatClock(row.endMinutes),
    formatClock(row.durationMinutes),
    row.module,
    row.category,
    '',
    '',
    '',
    '',
    '',
    '',
    row.activity,
    row.requestedBy,
  ]
    .map(escapeField)
    .join(',');
}

export function buildCsvText(days: readonly DayLog[], settings: Settings): string {
  const chronological = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const lines = chronological.flatMap((day) => scheduleDay(day, settings).map(rowToLine));
  return [CSV_COLUMNS.join(','), ...lines].join(LINE_BREAK) + LINE_BREAK;
}

export function buildCsvFile(days: readonly DayLog[], settings: Settings): EncodedText {
  return encodeWindows1252(buildCsvText(days, settings));
}

/** `Bitacora_04112026.csv`, following the file names already in use. */
export function buildFileName(prefix: string, exportDate: string): string {
  const [year, month, day] = exportDate.split('-');
  return `${prefix}_${day}${month}${year}.csv`;
}

/**
 * Identifies the work a day reports, to notice edits made after exporting. It covers the blocks
 * and whether the Daily is included, but not the Daily's own label or requester: changing those
 * in Ajustes must not flag the whole history as modified.
 */
export function dayFingerprint(day: DayLog, settings: Settings): string {
  const blocks = scheduleDay(day, settings)
    .filter((row) => row.entryId !== null)
    .map((row) =>
      [
        row.startMinutes,
        row.durationMinutes,
        row.module,
        row.category,
        row.activity,
        row.requestedBy,
      ].join('|'),
    );
  const content = [day.dayType, day.includeDaily, ...blocks].join('\n');
  let hash = 0x811c9dc5; // FNV-1a
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function markExported(day: DayLog, settings: Settings, exportedAt: string): DayLog {
  return { ...day, exportedAt, exportedFingerprint: dayFingerprint(day, settings) };
}

export function dayStatus(day: DayLog | undefined, settings: Settings): DayStatus {
  if (!day) return 'empty';
  if (day.dayType === 'off') return 'off';
  if (day.entries.length === 0) return 'empty';
  if (!day.exportedAt) return 'draft';
  return day.exportedFingerprint === dayFingerprint(day, settings) ? 'exported' : 'modified';
}
