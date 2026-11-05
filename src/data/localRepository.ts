import { withSettingsDefaults } from '@/domain/defaults';
import type { DayLog } from '@/domain/types';
import { createDemoSnapshot } from './demoData';
import type { LogbookRepository, LogbookSnapshot } from './repository';

const STORAGE_KEY = 'bitacora.demo.v1';

function load(): LogbookSnapshot {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const snapshot = JSON.parse(stored) as LogbookSnapshot;
      return { ...snapshot, settings: withSettingsDefaults(snapshot.settings), unsyncedChanges: 0 };
    }
  } catch {
    // Unreadable demo data is not worth an error screen: start over from the sample.
  }
  return createDemoSnapshot();
}

/** Demo storage: everything stays in this browser and nothing reaches the server. */
export function createLocalRepository(): LogbookRepository {
  let snapshot = load();
  const listeners = new Set<(snapshot: LogbookSnapshot) => void>();

  const commit = async (next: LogbookSnapshot): Promise<void> => {
    snapshot = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    listeners.forEach((listener) => {
      listener(next);
    });
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      queueMicrotask(() => {
        onChange(snapshot);
      });
      return () => listeners.delete(onChange);
    },
    saveDays(days) {
      const merged = new Map<string, DayLog>(snapshot.days.map((day) => [day.date, day]));
      days.forEach((day) => merged.set(day.date, day));
      return commit({ ...snapshot, days: [...merged.values()] });
    },
    saveSettings(settings) {
      return commit({ ...snapshot, settings });
    },
    addPending(items) {
      return commit({ ...snapshot, pending: [...snapshot.pending, ...items] });
    },
    removePending(ids) {
      const removed = new Set(ids);
      return commit({
        ...snapshot,
        pending: snapshot.pending.filter((item) => !removed.has(item.id)),
      });
    },
  };
}

export function resetDemoData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
