import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/domain/defaults';
import { testDay } from '@/domain/testFixtures';
import type { DayLog } from '@/domain/types';
import type { LogbookData, LogbookRepository, LogbookSnapshot } from './repository';
import type { LogbookRemote } from './syncedRepository';
import { clearLocalCopy, createSyncedRepository } from './syncedRepository';

const DATE = '2030-01-07';
const pendingItem = { id: 'p1', text: 'apoyo', date: DATE, createdAt: '' };

/** In-memory server that can lose its connection. */
function fakeRemote(initial: Partial<LogbookData> = {}) {
  const server: LogbookData = { days: [], pending: [], settings: DEFAULT_SETTINGS, ...initial };
  const state = { online: true };
  const guard = () => {
    if (!state.online) throw new TypeError('Failed to fetch');
  };
  const remote: LogbookRemote = {
    fetchAll: vi.fn(async () => {
      guard();
      return structuredClone(server);
    }),
    upsertDays: vi.fn(async (days: readonly DayLog[]) => {
      guard();
      days.forEach((day) => {
        server.days = [...server.days.filter((item) => item.date !== day.date), day];
      });
    }),
    saveSettings: vi.fn(async (settings) => {
      guard();
      server.settings = settings;
    }),
    addPending: vi.fn(async (items) => {
      guard();
      server.pending.push(...items);
    }),
    removePending: vi.fn(async (ids) => {
      guard();
      server.pending = server.pending.filter((item) => !ids.includes(item.id));
    }),
  };
  return { remote, server, state };
}

/** Subscribes and returns a getter for the latest snapshot. */
function watch(repository: LogbookRepository) {
  let latest: LogbookSnapshot | null = null;
  const errors: Error[] = [];
  const stop = repository.subscribe(
    (snapshot) => {
      latest = snapshot;
    },
    (error) => errors.push(error),
  );
  return { current: () => latest, errors, stop };
}

const settle = () => vi.waitFor(() => new Promise((resolve) => setTimeout(resolve, 0)));

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('synced repository', () => {
  it('loads from the server and caches for the next start', async () => {
    const { remote, state } = fakeRemote({ days: [testDay([8], { date: DATE })] });
    const first = watch(createSyncedRepository(remote, 'a'));
    await settle();
    expect(first.current()?.days).toHaveLength(1);
    first.stop();

    state.online = false;
    const second = watch(createSyncedRepository(remote, 'a'));
    await settle();
    expect(second.current()?.days).toHaveLength(1);
    expect(second.errors).toEqual([]);
  });

  it('reports an error only when there is nothing local to show', async () => {
    const { remote, state } = fakeRemote();
    state.online = false;
    const view = watch(createSyncedRepository(remote, 'a'));
    await settle();
    expect(view.current()).toBeNull();
    expect(view.errors).toHaveLength(1);
  });

  it('sends changes right away when online', async () => {
    const { remote, server } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    await repository.saveDays([testDay([8], { date: DATE })]);
    await settle();
    expect(server.days).toHaveLength(1);
    expect(view.current()?.unsyncedChanges).toBe(0);
  });

  it('keeps working offline and sends everything on reconnect', async () => {
    const { remote, server, state } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    state.online = false;
    await repository.saveDays([testDay([8], { date: DATE })]);
    await repository.addPending([pendingItem]);
    await repository.saveSettings({ ...DEFAULT_SETTINGS, noPlanLabel: 'Sin plan' });
    await settle();

    expect(view.current()?.days).toHaveLength(1);
    expect(view.current()?.pending).toHaveLength(1);
    expect(view.current()?.settings.noPlanLabel).toBe('Sin plan');
    expect(view.current()?.unsyncedChanges).toBe(3);
    expect(server.days).toHaveLength(0);

    state.online = true;
    window.dispatchEvent(new Event('online'));
    await settle();

    expect(server.days).toHaveLength(1);
    expect(server.pending).toHaveLength(1);
    expect(server.settings.noPlanLabel).toBe('Sin plan');
    expect(view.current()?.unsyncedChanges).toBe(0);
  });

  it('does not lose offline work when the phone closes the app', async () => {
    const { remote, server, state } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    state.online = false;
    await repository.saveDays([testDay([8], { date: DATE })]);
    await settle();
    view.stop();

    state.online = true;
    const reopened = watch(createSyncedRepository(remote, 'a'));
    await settle();
    expect(server.days).toHaveLength(1);
    expect(reopened.current()?.unsyncedChanges).toBe(0);
  });

  it('keeps only the latest offline edit of a day', async () => {
    const { remote, server, state } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    state.online = false;
    await repository.saveDays([testDay([1], { date: DATE })]);
    await repository.saveDays([testDay([2], { date: DATE })]);
    await settle();
    expect(view.current()?.unsyncedChanges).toBe(1);

    state.online = true;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(server.days[0]?.entries[0]?.durationMinutes).toBe(120);
  });

  it('does not let a refresh undo an edit still waiting to be sent', async () => {
    const stale = testDay([1], { date: DATE });
    const { remote, state } = fakeRemote({ days: [stale] });
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    state.online = false;
    await repository.saveDays([testDay([5], { date: DATE })]);
    await settle();
    state.online = true;
    vi.mocked(remote.upsertDays).mockRejectedValueOnce(new Error('timeout'));
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();

    expect(view.current()?.days[0]?.entries[0]?.durationMinutes).toBe(300);
  });

  it('keeps an edit made while a previous save is in flight', async () => {
    const { remote, server } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    await repository.saveDays([testDay([1], { date: DATE })]);
    await repository.saveDays([testDay([2], { date: DATE })]);
    await settle();

    expect(server.days[0]?.entries[0]?.durationMinutes).toBe(120);
    expect(view.current()?.unsyncedChanges).toBe(0);
  });

  it('cancels a pending item that never reached the server', async () => {
    const { remote, state } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    const view = watch(repository);
    await settle();

    state.online = false;
    await repository.addPending([pendingItem]);
    await repository.removePending(['p1']);
    await settle();
    expect(view.current()?.pending).toEqual([]);
    expect(view.current()?.unsyncedChanges).toBe(0);
  });

  it('removes pending items from the server', async () => {
    const { remote, server } = fakeRemote({ pending: [pendingItem] });
    const repository = createSyncedRepository(remote, 'a');
    watch(repository);
    await settle();
    await repository.removePending(['p1']);
    await settle();
    expect(server.pending).toEqual([]);
  });

  it('keeps accounts apart', async () => {
    const first = fakeRemote({ days: [testDay([8], { date: DATE })] });
    watch(createSyncedRepository(first.remote, 'a'));
    await settle();

    const second = fakeRemote();
    second.state.online = false;
    const view = watch(createSyncedRepository(second.remote, 'b'));
    await settle();
    expect(view.current()).toBeNull();
  });

  it('survives corrupt local data', async () => {
    localStorage.setItem('bitacora.cache.a', '{nope');
    localStorage.setItem('bitacora.outbox.a', '{nope');
    const { remote } = fakeRemote();
    const view = watch(createSyncedRepository(remote, 'a'));
    await settle();
    expect(view.current()?.days).toEqual([]);
  });
});

describe('clearLocalCopy', () => {
  it('removes the cached copy on sign-out', async () => {
    const { remote } = fakeRemote();
    watch(createSyncedRepository(remote, 'a'));
    await settle();
    clearLocalCopy('a');
    expect(localStorage.getItem('bitacora.cache.a')).toBeNull();
  });

  it('never discards work the server does not have', async () => {
    const { remote, state } = fakeRemote();
    const repository = createSyncedRepository(remote, 'a');
    watch(repository);
    await settle();
    state.online = false;
    await repository.saveDays([testDay([8], { date: DATE })]);
    await settle();
    clearLocalCopy('a');
    expect(localStorage.getItem('bitacora.outbox.a')).toContain(DATE);
  });
});
