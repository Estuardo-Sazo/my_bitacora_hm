import type { DayLog, PendingItem, Settings } from '@/domain/types';

export interface LogbookData {
  days: DayLog[];
  pending: PendingItem[];
  settings: Settings;
}

export interface LogbookSnapshot extends LogbookData {
  /** Changes saved on this device that have not reached the server yet. */
  unsyncedChanges: number;
}

/**
 * Storage boundary of the app. The UI depends on this contract only, which lets the demo run on
 * localStorage and the real logbook on Supabase without any change in the screens.
 */
export interface LogbookRepository {
  subscribe(
    onChange: (snapshot: LogbookSnapshot) => void,
    onError: (error: Error) => void,
  ): () => void;
  saveDays(days: readonly DayLog[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  addPending(items: readonly PendingItem[]): Promise<void>;
  removePending(ids: readonly string[]): Promise<void>;
}
