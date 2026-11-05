import type { DayLog, PendingItem, Settings } from '@/domain/types';
import type { LogbookData, LogbookRepository, LogbookSnapshot } from './repository';

/** What the server must offer. Keeping it this small lets the sync logic be tested without it. */
export interface LogbookRemote {
  fetchAll(): Promise<LogbookData>;
  upsertDays(days: readonly DayLog[]): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  addPending(items: readonly PendingItem[]): Promise<void>;
  removePending(ids: readonly string[]): Promise<void>;
}

/** Writes waiting for the server, keyed so a newer edit replaces an older one. */
interface Outbox {
  days: Record<string, DayLog>;
  settings: Settings | null;
  pendingAdds: Record<string, PendingItem>;
  pendingRemovals: string[];
}

const emptyOutbox = (): Outbox => ({
  days: {},
  settings: null,
  pendingAdds: {},
  pendingRemovals: [],
});

function countChanges(outbox: Outbox): number {
  return (
    Object.keys(outbox.days).length +
    Object.keys(outbox.pendingAdds).length +
    outbox.pendingRemovals.length +
    (outbox.settings ? 1 : 0)
  );
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const stored = storage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

/** Layers local changes over server data, so a refresh never undoes unsent work. */
function applyOutbox(data: LogbookData, outbox: Outbox): LogbookData {
  const days = new Map(data.days.map((day) => [day.date, day]));
  Object.values(outbox.days).forEach((day) => days.set(day.date, day));

  const pending = new Map(data.pending.map((item) => [item.id, item]));
  Object.values(outbox.pendingAdds).forEach((item) => pending.set(item.id, item));
  outbox.pendingRemovals.forEach((id) => pending.delete(id));

  return {
    days: [...days.values()],
    pending: [...pending.values()],
    settings: outbox.settings ?? data.settings,
  };
}

/**
 * Local-first repository. Every write lands on the device first and reaches the server when it
 * can, because Supabase, unlike Firestore, has no offline mode and phones lose signal. Each write
 * survives a closed app in the outbox. The last save of a day wins.
 */
export function createSyncedRepository(
  remote: LogbookRemote,
  scope: string,
  storage: Storage = localStorage,
): LogbookRepository {
  const dataKey = `bitacora.cache.${scope}`;
  const outboxKey = `bitacora.outbox.${scope}`;

  let data = readJson<LogbookData>(storage, dataKey);
  const outbox = readJson<Outbox>(storage, outboxKey) ?? emptyOutbox();
  let flushing: Promise<void> | null = null;
  const listeners = new Set<(snapshot: LogbookSnapshot) => void>();

  const persist = () => {
    if (data) storage.setItem(dataKey, JSON.stringify(data));
    storage.setItem(outboxKey, JSON.stringify(outbox));
  };

  const emit = () => {
    if (!data) return;
    const snapshot = { ...data, unsyncedChanges: countChanges(outbox) };
    listeners.forEach((listener) => {
      listener(snapshot);
    });
  };

  const commit = (change: (current: Outbox) => void): Promise<void> => {
    change(outbox);
    if (data) data = applyOutbox(data, outbox);
    persist();
    emit();
    void flush().catch(() => undefined);
    return Promise.resolve();
  };

  /** Sends one snapshot of the outbox, clearing only what did not change while in flight. */
  async function sendOutbox(): Promise<void> {
    const sent: Outbox = structuredClone(outbox);

    if (sent.settings) {
      await remote.saveSettings(sent.settings);
      if (JSON.stringify(outbox.settings) === JSON.stringify(sent.settings)) outbox.settings = null;
      persist();
    }

    const days = Object.values(sent.days);
    if (days.length > 0) {
      await remote.upsertDays(days);
      days.forEach((day) => {
        if (JSON.stringify(outbox.days[day.date]) === JSON.stringify(day)) {
          outbox.days = without(outbox.days, day.date);
        }
      });
      persist();
    }

    const adds = Object.values(sent.pendingAdds);
    if (adds.length > 0) {
      await remote.addPending(adds);
      adds.forEach((item) => {
        outbox.pendingAdds = without(outbox.pendingAdds, item.id);
      });
      persist();
    }

    if (sent.pendingRemovals.length > 0) {
      await remote.removePending(sent.pendingRemovals);
      outbox.pendingRemovals = outbox.pendingRemovals.filter(
        (id) => !sent.pendingRemovals.includes(id),
      );
      persist();
    }
  }

  async function sendAll(): Promise<void> {
    while (countChanges(outbox) > 0) await sendOutbox();
  }

  function flush(): Promise<void> {
    flushing ??= sendAll().finally(() => {
      flushing = null;
      emit();
    });
    return flushing;
  }

  async function refresh(): Promise<void> {
    await flush();
    const remoteData = await remote.fetchAll();
    data = applyOutbox(remoteData, outbox);
    persist();
    emit();
  }

  return {
    subscribe(onChange, onError) {
      listeners.add(onChange);
      if (data) {
        const cached = data;
        queueMicrotask(() => {
          onChange({ ...cached, unsyncedChanges: countChanges(outbox) });
        });
      }

      const sync = () => {
        refresh().catch((error: unknown) => {
          // With local data the app keeps working and retries; without it there is nothing to show.
          if (!data) onError(error instanceof Error ? error : new Error(String(error)));
        });
      };
      const syncWhenVisible = () => {
        if (document.visibilityState === 'visible') sync();
      };

      window.addEventListener('online', sync);
      document.addEventListener('visibilitychange', syncWhenVisible);
      sync();

      return () => {
        listeners.delete(onChange);
        window.removeEventListener('online', sync);
        document.removeEventListener('visibilitychange', syncWhenVisible);
      };
    },
    saveDays(days) {
      return commit((current) => {
        days.forEach((day) => {
          current.days[day.date] = day;
        });
      });
    },
    saveSettings(settings) {
      return commit((current) => {
        current.settings = settings;
      });
    },
    addPending(items) {
      return commit((current) => {
        items.forEach((item) => {
          current.pendingAdds[item.id] = item;
        });
      });
    },
    removePending(ids) {
      if (data) {
        const remaining = data.pending.filter((item) => !ids.includes(item.id));
        data = { ...data, pending: remaining };
      }
      return commit((current) => {
        ids.forEach((id) => {
          // An item the server never received only needs to leave the outbox.
          if (current.pendingAdds[id]) current.pendingAdds = without(current.pendingAdds, id);
          else current.pendingRemovals.push(id);
        });
      });
    },
  };
}

/** Removes this account's copy from the device, unless it holds work the server does not have. */
export function clearLocalCopy(scope: string, storage: Storage = localStorage): void {
  const outboxKey = `bitacora.outbox.${scope}`;
  const outbox = readJson<Outbox>(storage, outboxKey);
  if (outbox && countChanges(outbox) > 0) return;
  storage.removeItem(`bitacora.cache.${scope}`);
  storage.removeItem(outboxKey);
}
