import { matchModule } from './modules';
import { parseDuration } from './time';
import type { EntryKind, Settings, WorkEntry } from './types';

export interface ParseContext {
  settings: Settings;
  /** Last module used per ticket, so repeat tickets need no module. */
  ticketModules: ReadonlyMap<string, string>;
  createId: () => string;
}

export type LineHint =
  | { type: 'moduleCorrected'; from: string; to: string }
  | { type: 'moduleFromHistory'; module: string }
  | { type: 'missingModule' }
  | { type: 'missingDuration' };

export type ParsedLine =
  | { type: 'entry'; raw: string; entry: WorkEntry; hints: LineHint[] }
  | { type: 'pending'; raw: string; text: string }
  | { type: 'ignored'; raw: string };

const TICKET = /^\d{3,}$/;
const NO_PLAN = /^no\s*plan\w*/i;
const MEETING = /^reuni[oó]n(\s+cliente)?\b/i;
const SUPPORT = /^apoyos?\b/i;
const SECTION_HEADER = /^(tickets?\s+trabajad[oa]s|trabajos|apoyos?:?$)/i;
const HOUR_UNIT = /^(h|hr|hrs|hora|horas)$/i;

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** Takes a duration from the front of `tokens`, including a detached unit as in `2 h`. */
function takeDuration(tokens: string[]): { minutes: number | null; rest: string[] } {
  const [first, second] = tokens;
  if (first === undefined) return { minutes: null, rest: tokens };
  const minutes = parseDuration(first);
  if (minutes === null) return { minutes: null, rest: tokens };
  const hasDetachedUnit = second !== undefined && HOUR_UNIT.test(second);
  return { minutes, rest: tokens.slice(hasDetachedUnit ? 2 : 1) };
}

interface EntryDraft {
  kind: EntryKind;
  activity: string;
  category: string;
  requestedBy: string;
  moduleOptional: boolean;
  tokens: string[];
}

function buildEntry(raw: string, draft: EntryDraft, context: ParseContext): ParsedLine {
  const { minutes, rest } = takeDuration(draft.tokens);
  const hints: LineHint[] = [];
  if (minutes === null) hints.push({ type: 'missingDuration' });

  const match = matchModule(rest, context.settings.modules);
  let module = match?.module ?? '';
  const note = rest.slice(match?.wordsUsed ?? 0).join(' ');

  if (match?.correctedFrom) {
    hints.push({ type: 'moduleCorrected', from: match.correctedFrom, to: match.module });
  }
  if (!module && draft.kind === 'ticket') {
    module = context.ticketModules.get(draft.activity) ?? '';
    if (module) hints.push({ type: 'moduleFromHistory', module });
  }
  if (!module && !draft.moduleOptional) hints.push({ type: 'missingModule' });

  return {
    type: 'entry',
    raw,
    hints,
    entry: {
      id: context.createId(),
      kind: draft.kind,
      activity: draft.activity,
      module,
      category: draft.category,
      requestedBy: draft.requestedBy,
      durationMinutes: minutes ?? 0,
      fixedStartMinutes: null,
      note,
    },
  };
}

function parseLine(raw: string, context: ParseContext): ParsedLine {
  const line = raw.trim();
  const { settings } = context;
  const defaults = {
    category: settings.defaultCategory,
    requestedBy: settings.defaultRequestedBy,
    moduleOptional: false,
  };

  if (SECTION_HEADER.test(line)) return { type: 'ignored', raw };

  const tokens = words(line);
  const [first = ''] = tokens;

  if (TICKET.test(first)) {
    return buildEntry(
      raw,
      { ...defaults, kind: 'ticket', activity: first, tokens: tokens.slice(1) },
      context,
    );
  }

  const noPlan = NO_PLAN.exec(line);
  if (noPlan) {
    return buildEntry(
      raw,
      {
        ...defaults,
        kind: 'noPlan',
        activity: settings.noPlanLabel,
        tokens: words(line.slice(noPlan[0].length)),
      },
      context,
    );
  }

  const meeting = MEETING.exec(line);
  if (meeting) {
    const label = meeting[1] ? 'Reunion Cliente' : 'Reunion';
    return buildEntry(
      raw,
      {
        kind: 'meeting',
        activity: label,
        category: label,
        requestedBy: settings.daily.requestedBy,
        moduleOptional: true,
        tokens: words(line.slice(meeting[0].length)),
      },
      context,
    );
  }

  const support = SUPPORT.exec(line);
  const afterSupport = support ? words(line.slice(support[0].length)) : tokens;
  if (takeDuration(afterSupport).minutes !== null) {
    return buildEntry(
      raw,
      { ...defaults, kind: 'noPlan', activity: settings.noPlanLabel, tokens: afterSupport },
      context,
    );
  }

  return { type: 'pending', raw, text: support ? afterSupport.join(' ') : line };
}

/** Reads quick notes line by line. Text it cannot place becomes a pending item, never an error. */
export function parseNotes(text: string, context: ParseContext): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => parseLine(line, context));
}
