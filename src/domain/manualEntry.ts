import { canonicalModule } from './modules';
import { closestMatch } from './text';
import { parseDuration } from './time';
import type { EntryKind, Settings, WorkEntry } from './types';

export interface ManualEntryInput {
  kind: EntryKind;
  ticket: string;
  hours: string;
  module: string;
  description: string;
  /** Blank means the default for this kind of activity. */
  category?: string;
  requestedBy?: string;
}

export type ManualEntryField = 'ticket' | 'hours' | 'module';

export type ManualEntryResult =
  { ok: true; entry: WorkEntry } | { ok: false; errors: Partial<Record<ManualEntryField, string>> };

interface Context {
  settings: Settings;
  ticketModules: ReadonlyMap<string, string>;
  createId: () => string;
}

const MEETING_LABEL = 'Reunion';

/** Category and requester an activity gets unless the user changes them. */
export function entryDefaults(kind: EntryKind, settings: Settings) {
  return kind === 'meeting'
    ? { category: MEETING_LABEL, requestedBy: settings.daily.requestedBy }
    : { category: settings.defaultCategory, requestedBy: settings.defaultRequestedBy };
}

/** Builds an entry from the direct form, applying the same defaults as the quick notes. */
export function buildManualEntry(input: ManualEntryInput, context: Context): ManualEntryResult {
  const { settings, ticketModules, createId } = context;
  const errors: Partial<Record<ManualEntryField, string>> = {};

  const ticket = input.ticket.trim();
  if (input.kind === 'ticket' && !/^\d+$/.test(ticket)) {
    errors.ticket = 'Escribe el número de ticket.';
  }

  const durationMinutes = parseDuration(input.hours);
  if (durationMinutes === null) errors.hours = 'Usa un formato como 1h, 1.5 o 1:30.';

  const typedModule = input.module.trim();
  const module =
    canonicalModule(typedModule, settings.modules) ??
    (typedModule ? (closestMatch(typedModule, settings.modules) ?? typedModule) : '') ??
    '';
  const resolvedModule =
    module || (input.kind === 'ticket' ? (ticketModules.get(ticket) ?? '') : '');
  if (!resolvedModule && input.kind !== 'meeting') errors.module = 'Elige el módulo.';

  if (durationMinutes === null || Object.keys(errors).length > 0) return { ok: false, errors };

  const defaults = entryDefaults(input.kind, settings);
  const activities: Record<EntryKind, string> = {
    ticket,
    noPlan: settings.noPlanLabel,
    meeting: MEETING_LABEL,
  };

  return {
    ok: true,
    entry: {
      id: createId(),
      kind: input.kind,
      activity: activities[input.kind],
      module: resolvedModule,
      category: input.category?.trim() || defaults.category,
      requestedBy: input.requestedBy?.trim() || defaults.requestedBy,
      durationMinutes,
      fixedStartMinutes: null,
      note: input.description.trim(),
    },
  };
}
