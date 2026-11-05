import { DEFAULT_SETTINGS } from './defaults';
import type { DayLog, Settings, WorkEntry } from './types';

/** Fictional names only: real data never goes in the repository. */
export const testSettings: Settings = {
  ...DEFAULT_SETTINGS,
  modules: ['Core', 'Notas', 'Zonas', 'Planilla', 'Pedidos', 'Pagina Web', 'Asignaciones'],
  daily: { ...DEFAULT_SETTINGS.daily, requestedBy: 'ACME' },
  defaultRequestedBy: 'Ana Ejemplo',
};

export function testEntry(overrides: Partial<WorkEntry> = {}): WorkEntry {
  return {
    id: crypto.randomUUID(),
    kind: 'ticket',
    activity: '1001',
    module: 'Notas',
    category: 'Programación',
    requestedBy: 'Ana Ejemplo',
    durationMinutes: 60,
    fixedStartMinutes: null,
    note: '',
    ...overrides,
  };
}

export function testDay(hours: number[], overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: '2026-11-03',
    dayType: 'full',
    includeDaily: true,
    startMinutes: null,
    entries: hours.map((value, index) =>
      testEntry({ activity: String(1000 + index), durationMinutes: value * 60 }),
    ),
    exportedAt: null,
    exportedFingerprint: null,
    ...overrides,
  };
}
