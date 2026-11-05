import { isWeekday } from './dates';
import type { DayLog, IsoDate, Settings } from './types';

/** Neutral defaults: each user sets their real names and modules in Ajustes. */
export const DEFAULT_SETTINGS: Settings = {
  workdayStartMinutes: 8 * 60,
  workdayEndMinutes: 17 * 60,
  lunchStartMinutes: 12 * 60,
  lunchDurationMinutes: 60,
  expectedDayMinutes: 8 * 60,
  daily: {
    enabled: true,
    startMinutes: 8 * 60 + 30,
    durationMinutes: 30,
    label: 'Daily Scrum',
    requestedBy: 'Equipo',
  },
  defaultCategory: 'Programación',
  defaultRequestedBy: 'Líder técnico',
  noPlanLabel: 'No plan',
  modules: ['Core', 'Notas', 'Pedidos', 'Planilla'],
  exportFilePrefix: 'Bitacora',
};

/** Merges stored settings over the defaults so older documents gain newly added fields. */
export function withSettingsDefaults(stored: Partial<Settings> | null | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    daily: { ...DEFAULT_SETTINGS.daily, ...stored?.daily },
  };
}

export function createEmptyDay(date: IsoDate, settings: Settings): DayLog {
  return {
    date,
    dayType: 'full',
    includeDaily: settings.daily.enabled && isWeekday(date),
    startMinutes: null,
    entries: [],
    exportedAt: null,
    exportedFingerprint: null,
  };
}
