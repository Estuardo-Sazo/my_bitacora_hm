import { isWeekday } from './dates';
import { canonicalModule } from './modules';
import { expectedMinutes, scheduleDay, workedMinutes } from './scheduler';
import { formatClock, formatHours } from './time';
import type { DayLog, Settings } from './types';

export type IssueSeverity = 'error' | 'warning';

export interface DayIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  entryId: string | null;
}

/** Errors block the export because the row would be wrong; warnings only ask for a second look. */
export function validateDay(day: DayLog, settings: Settings): DayIssue[] {
  if (day.dayType === 'off') return [];

  const issues: DayIssue[] = [];
  const add = (severity: IssueSeverity, code: string, message: string, entryId: string | null) => {
    issues.push({ severity, code, message, entryId });
  };

  const seenActivities = new Set<string>();
  for (const entry of day.entries) {
    const label = entry.activity || 'Actividad sin nombre';
    if (!entry.activity.trim()) add('error', 'missingActivity', 'Falta la actividad.', entry.id);
    if (entry.durationMinutes <= 0) {
      add('error', 'missingDuration', `${label}: faltan las horas.`, entry.id);
    }
    if (!entry.category.trim()) {
      add('error', 'missingCategory', `${label}: falta la categoría.`, entry.id);
    }
    if (!entry.requestedBy.trim()) {
      add('error', 'missingRequester', `${label}: falta quién lo solicitó.`, entry.id);
    }
    if (entry.kind !== 'meeting' && !entry.module.trim()) {
      add('error', 'missingModule', `${label}: falta el módulo.`, entry.id);
    } else if (entry.module.trim() && !canonicalModule(entry.module, settings.modules)) {
      add(
        'warning',
        'unknownModule',
        `${label}: “${entry.module}” no está en el catálogo de módulos.`,
        entry.id,
      );
    }
    if (entry.kind === 'ticket' && seenActivities.has(entry.activity)) {
      add('warning', 'repeatedTicket', `${label} aparece más de una vez este día.`, entry.id);
    }
    seenActivities.add(entry.activity);
  }

  const workRows = scheduleDay(day, settings)
    .filter((row) => row.entryId !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  workRows.forEach((row, index) => {
    const next = workRows[index + 1];
    if (next && row.endMinutes > next.startMinutes) {
      add(
        'error',
        'overlap',
        `${row.activity} y ${next.activity} se traslapan a las ${formatClock(next.startMinutes)}.`,
        next.entryId,
      );
    }
  });

  const lastRow = workRows.at(-1);
  if (lastRow && lastRow.endMinutes > settings.workdayEndMinutes) {
    add(
      'warning',
      'pastWorkday',
      `El día termina a las ${formatClock(lastRow.endMinutes)}, después de la hora de salida.`,
      null,
    );
  }

  const worked = workedMinutes(day);
  const expected = expectedMinutes(day, settings);
  if (day.entries.length > 0 && worked !== expected) {
    add(
      'warning',
      'hoursMismatch',
      `Llevas ${formatHours(worked)} de ${formatHours(expected)} esperadas.`,
      null,
    );
  }

  if (day.entries.length > 0 && !isWeekday(day.date)) {
    add('warning', 'weekend', 'Este día cae en fin de semana.', null);
  }
  return issues;
}

export const hasBlockingIssues = (issues: readonly DayIssue[]): boolean =>
  issues.some((issue) => issue.severity === 'error');
