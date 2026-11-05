import { createContext, useContext } from 'react';
import type { LogbookSnapshot } from '@/data/repository';
import type { DayLog, IsoDate, PendingItem, Settings } from '@/domain/types';

export interface Logbook extends LogbookSnapshot {
  /** Keeps unsaved notes separate per account on a shared browser. */
  draftScope: string;
  ticketModules: ReadonlyMap<string, string>;
  getDay: (date: IsoDate) => DayLog;
  saveDay: (day: DayLog) => void;
  saveDays: (days: readonly DayLog[]) => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  addPending: (items: readonly PendingItem[]) => void;
  removePending: (ids: readonly string[]) => void;
}

export const LogbookContext = createContext<Logbook | null>(null);

export function useLogbook(): Logbook {
  const value = useContext(LogbookContext);
  if (!value) throw new Error('useLogbook debe usarse dentro de LogbookProvider');
  return value;
}
