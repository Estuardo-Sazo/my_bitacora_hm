import { addDays, isWeekday, today } from '@/domain/dates';
import { markExported } from '@/domain/csv/exportCsv';
import { createEmptyDay, DEFAULT_SETTINGS } from '@/domain/defaults';
import type { DayLog, IsoDate, Settings, WorkEntry } from '@/domain/types';
import type { LogbookSnapshot } from './repository';

const demoSettings: Settings = {
  ...DEFAULT_SETTINGS,
  modules: ['Core', 'Facturas', 'Inventario', 'Reportes', 'Usuarios'],
  defaultRequestedBy: 'Ana Ejemplo',
  daily: { ...DEFAULT_SETTINGS.daily, requestedBy: 'Equipo Demo' },
};

function previousWorkdays(from: IsoDate, count: number): IsoDate[] {
  const dates: IsoDate[] = [];
  let cursor = addDays(from, -1);
  while (dates.length < count) {
    if (isWeekday(cursor)) dates.push(cursor);
    cursor = addDays(cursor, -1);
  }
  return dates;
}

function demoEntry(activity: string, module: string, hours: number, note = ''): WorkEntry {
  const isTicket = /^\d+$/.test(activity);
  return {
    id: crypto.randomUUID(),
    kind: isTicket ? 'ticket' : 'noPlan',
    activity,
    module,
    category: demoSettings.defaultCategory,
    requestedBy: demoSettings.defaultRequestedBy,
    durationMinutes: hours * 60,
    fixedStartMinutes: null,
    note,
  };
}

function demoDay(date: IsoDate, entries: WorkEntry[]): DayLog {
  return { ...createEmptyDay(date, demoSettings), entries };
}

/** Fictional sample data, dated relative to today so the demo always looks current. */
export function createDemoSnapshot(now: IsoDate = today()): LogbookSnapshot {
  const [yesterday = now, twoDaysAgo = now, threeDaysAgo = now] = previousWorkdays(now, 3);
  const exportedAt = new Date().toISOString();

  return {
    unsyncedChanges: 0,
    settings: demoSettings,
    days: [
      markExported(
        demoDay(threeDaysAgo, [
          demoEntry('1204', 'Facturas', 2),
          demoEntry('1207', 'Inventario', 2),
          demoEntry('1190', 'Reportes', 4),
        ]),
        demoSettings,
        exportedAt,
      ),
      demoDay(twoDaysAgo, [
        demoEntry('1207', 'Inventario', 3),
        demoEntry('1211', 'Usuarios', 2),
        demoEntry('1190', 'Reportes', 3),
      ]),
      demoDay(yesterday, [
        demoEntry('1190', 'Reportes', 1),
        demoEntry('1215', 'Facturas', 2),
        demoEntry('No plan', 'Core', 2, 'Soporte a producción'),
        demoEntry('1211', 'Usuarios', 3),
      ]),
    ],
    pending: [
      {
        id: crypto.randomUUID(),
        text: 'Revisar por qué no llega el correo de bienvenida',
        date: yesterday,
        createdAt: exportedAt,
      },
    ],
  };
}
