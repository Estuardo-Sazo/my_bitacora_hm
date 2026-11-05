import { parseCsvDate } from '../dates';
import { createEmptyDay } from '../defaults';
import { canonicalModule } from '../modules';
import { closestMatch, normalizeText } from '../text';
import { parseClock } from '../time';
import type { DayLog, EntryKind, IsoDate, Settings, WorkEntry } from '../types';
import { markExported } from './exportCsv';

export interface ImportContext {
  settings: Settings;
  existingDates: ReadonlySet<IsoDate>;
  createId: () => string;
  importedAt: string;
}

export interface SkippedRow {
  line: number;
  reason: string;
}

export interface ImportResult {
  days: DayLog[];
  /** The catalog after adding modules found in the file. */
  modules: string[];
  rowsRead: number;
  rowsImported: number;
  skippedRows: SkippedRow[];
  duplicatesRemoved: number;
  existingDaysKept: number;
  /** Module spellings merged into their canonical name, as `from → to`. */
  moduleCorrections: string[];
  fieldCorrections: number;
}

const NO_PLAN = /^no\s*plan/i;
const MEETING = /^reuni[oó]n/i;
const TICKET = /^\d{3,}$/;
const HAS_LETTERS = /\p{L}/u;

/** Splits CSV text into records, honoring quotes. Handles the `;` that some Excel locales write. */
export function parseCsvRecords(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      record.push(field);
      field = '';
    } else if (character === '\n') {
      record.push(field.replace(/\r$/, ''));
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || record.length > 0) {
    record.push(field.replace(/\r$/, ''));
    records.push(record);
  }
  return records;
}

type ColumnKey =
  'date' | 'start' | 'end' | 'module' | 'category' | 'activity' | 'requestedBy' | 'note';

const HEADER_NAMES: Readonly<Record<string, ColumnKey>> = {
  fecha: 'date',
  inicio: 'start',
  fin: 'end',
  modulo: 'module',
  categoria: 'category',
  actividad: 'activity',
  'solicitado por': 'requestedBy',
  columna1: 'note',
  comentario: 'note',
  comentarios: 'note',
};

type ImportRow = Partial<Record<ColumnKey, string>> & { line: number };

function readRows(records: readonly string[][]): ImportRow[] {
  const [header = [], ...body] = records;
  const columns = header.map((name) => HEADER_NAMES[normalizeText(name)]);
  return body.flatMap((record, index) => {
    if (record.every((cell) => !cell.trim())) return [];
    const row: ImportRow = { line: index + 2 };
    columns.forEach((key, column) => {
      if (key) row[key] = (record[column] ?? '').replace(/\u00a0/g, ' ').trim();
    });
    return [row];
  });
}

/**
 * Builds the module catalog from the file, most-used spelling first, so that a rare misspelling
 * folds into the common form and not the other way around.
 */
function buildModuleResolver(rows: readonly ImportRow[], settings: Settings) {
  const counts = new Map<string, number>();
  for (const { module } of rows) {
    if (module && !NO_PLAN.test(module)) counts.set(module, (counts.get(module) ?? 0) + 1);
  }

  const catalog = [...settings.modules];
  const resolved = new Map<string, string>();
  const spellings = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

  for (const spelling of spellings) {
    const known = canonicalModule(spelling, catalog) ?? closestMatch(spelling, catalog);
    if (!known) catalog.push(spelling);
    resolved.set(spelling, known ?? spelling);
  }
  return { catalog, resolved };
}

function kindOf(activity: string): EntryKind {
  if (TICKET.test(activity)) return 'ticket';
  return MEETING.test(activity) ? 'meeting' : 'noPlan';
}

/** Imports an existing logbook. Its days are already in the system, so they arrive as exported. */
export function importCsv(text: string, context: ImportContext): ImportResult {
  const { settings, existingDates, createId, importedAt } = context;
  const rows = readRows(parseCsvRecords(text));
  const { catalog, resolved } = buildModuleResolver(rows, settings);
  const catalogSettings = { ...settings, modules: catalog };
  const dailyLabel = normalizeText(settings.daily.label);

  const days = new Map<IsoDate, DayLog>();
  const seenBlocks = new Set<string>();
  const skippedRows: SkippedRow[] = [];
  const existingDaysKept = new Set<IsoDate>();
  const moduleCorrections = new Set<string>();
  let rowsImported = 0;
  let duplicatesRemoved = 0;
  let fieldCorrections = 0;

  for (const row of rows) {
    const date = parseCsvDate(row.date ?? '');
    if (!date) {
      skippedRows.push({ line: row.line, reason: `Fecha no válida: “${row.date ?? ''}”` });
      continue;
    }
    if (existingDates.has(date)) {
      existingDaysKept.add(date);
      continue;
    }

    const day = days.get(date) ?? { ...createEmptyDay(date, settings), includeDaily: false };
    days.set(date, day);

    const activity = row.activity ?? '';
    const category = row.category ?? '';
    if (normalizeText(category) === dailyLabel || normalizeText(activity) === dailyLabel) {
      day.includeDaily = true;
      rowsImported += 1;
      continue;
    }

    const start = parseClock(row.start ?? '');
    const end = parseClock(row.end ?? '');
    if (start === null || end === null || end <= start) {
      skippedRows.push({
        line: row.line,
        reason: `Horario no válido: “${row.start ?? ''}–${row.end ?? ''}”`,
      });
      continue;
    }

    const blockKey = `${date}|${start}|${end}|${activity}`;
    if (seenBlocks.has(blockKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenBlocks.add(blockKey);

    const rawModule = row.module ?? '';
    const module = resolved.get(rawModule) ?? '';
    if (rawModule && module && rawModule !== module) {
      moduleCorrections.add(`${rawModule} → ${module}`);
    }

    const kind = kindOf(activity);
    const requestedBy = row.requestedBy ?? '';
    const validCategory = HAS_LETTERS.test(category);
    const validRequester = HAS_LETTERS.test(requestedBy);
    const normalizedNoPlan = kind === 'noPlan' && activity !== settings.noPlanLabel;
    if (!validCategory || !validRequester || normalizedNoPlan) fieldCorrections += 1;

    const entry: WorkEntry = {
      id: createId(),
      kind,
      activity: kind === 'noPlan' ? settings.noPlanLabel : activity,
      module,
      category: validCategory ? category : settings.defaultCategory,
      requestedBy: validRequester ? requestedBy : settings.defaultRequestedBy,
      // Taken from Inicio/Fin: the Duracion column is hand-typed and can be wrong.
      durationMinutes: end - start,
      fixedStartMinutes: start,
      note: row.note ?? '',
    };
    day.entries.push(entry);
    rowsImported += 1;
  }

  return {
    days: [...days.values()]
      .filter((day) => day.includeDaily || day.entries.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => markExported(day, catalogSettings, importedAt)),
    modules: catalog,
    rowsRead: rows.length,
    rowsImported,
    skippedRows,
    duplicatesRemoved,
    existingDaysKept: existingDaysKept.size,
    moduleCorrections: [...moduleCorrections],
    fieldCorrections,
  };
}
