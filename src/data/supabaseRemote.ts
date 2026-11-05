import type { SupabaseClient } from '@supabase/supabase-js';
import { withSettingsDefaults } from '@/domain/defaults';
import type { DayLog, DayType, PendingItem, Settings, WorkEntry } from '@/domain/types';
import type { LogbookRemote } from './syncedRepository';

/** PostgREST returns at most this many rows per request. */
const PAGE_SIZE = 1000;
const WRITE_BATCH_SIZE = 400;

export interface DayRow {
  user_id: string;
  date: string;
  day_type: string;
  include_daily: boolean;
  start_minutes: number | null;
  entries: WorkEntry[];
  exported_at: string | null;
  exported_fingerprint: string | null;
}

export interface PendingRow {
  id: string;
  user_id: string;
  text: string;
  date: string;
  created_at: string;
}

export function dayToRow(day: DayLog, userId: string): DayRow {
  return {
    user_id: userId,
    date: day.date,
    day_type: day.dayType,
    include_daily: day.includeDaily,
    start_minutes: day.startMinutes,
    entries: day.entries,
    exported_at: day.exportedAt,
    exported_fingerprint: day.exportedFingerprint,
  };
}

export function rowToDay(row: DayRow): DayLog {
  return {
    date: row.date,
    dayType: row.day_type as DayType,
    includeDaily: row.include_daily,
    startMinutes: row.start_minutes,
    entries: row.entries,
    exportedAt: row.exported_at,
    exportedFingerprint: row.exported_fingerprint,
  };
}

export function pendingToRow(item: PendingItem, userId: string): PendingRow {
  return {
    id: item.id,
    user_id: userId,
    text: item.text,
    date: item.date,
    created_at: item.createdAt,
  };
}

export function rowToPending(row: PendingRow): PendingItem {
  return { id: row.id, text: row.text, date: row.date, createdAt: row.created_at };
}

export function createSupabaseRemote(client: SupabaseClient, userId: string): LogbookRemote {
  async function fetchAllDays(): Promise<DayRow[]> {
    const rows: DayRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from('day_logs')
        .select('*')
        .order('date')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      rows.push(...(data as DayRow[]));
      if (data.length < PAGE_SIZE) return rows;
    }
  }

  return {
    async fetchAll() {
      const [days, pending, settings] = await Promise.all([
        fetchAllDays(),
        client.from('pending_items').select('*').order('created_at'),
        client.from('user_settings').select('settings').maybeSingle(),
      ]);
      if (pending.error) throw new Error(pending.error.message);
      if (settings.error) throw new Error(settings.error.message);

      const stored = settings.data as { settings: Partial<Settings> } | null;
      return {
        days: days.map(rowToDay),
        pending: (pending.data as PendingRow[]).map(rowToPending),
        settings: withSettingsDefaults(stored?.settings),
      };
    },
    async upsertDays(days) {
      for (let start = 0; start < days.length; start += WRITE_BATCH_SIZE) {
        const rows = days
          .slice(start, start + WRITE_BATCH_SIZE)
          .map((day) => dayToRow(day, userId));
        const { error } = await client.from('day_logs').upsert(rows);
        if (error) throw new Error(error.message);
      }
    },
    async saveSettings(settings) {
      const { error } = await client.from('user_settings').upsert({ user_id: userId, settings });
      if (error) throw new Error(error.message);
    },
    async addPending(items) {
      const rows = items.map((item) => pendingToRow(item, userId));
      const { error } = await client.from('pending_items').upsert(rows);
      if (error) throw new Error(error.message);
    },
    async removePending(ids) {
      const { error } = await client
        .from('pending_items')
        .delete()
        .in('id', [...ids]);
      if (error) throw new Error(error.message);
    },
  };
}
