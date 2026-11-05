import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs the real migration on a real Postgres (compiled to WebAssembly). Only what Supabase
 * provides around it is stubbed: the roles, `auth.users` and `auth.uid()`.
 */
const OWNER = '11111111-1111-1111-1111-111111111111';
const STRANGER = '22222222-2222-2222-2222-222222222222';
const SECOND_OWNER = '33333333-3333-3333-3333-333333333333';
const PENDING_ID = '44444444-4444-4444-4444-444444444444';

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
`;

const TABLES = ['day_logs', 'pending_items', 'user_settings'];

let db: PGlite;

async function as<T>(role: string, userId: string, run: () => Promise<T>): Promise<T> {
  await db.exec(`set test.user_id = '${userId}'; set role ${role};`);
  try {
    return await run();
  } finally {
    await db.exec(`reset role; set test.user_id = '';`);
  }
}

const asUser = <T>(userId: string, run: () => Promise<T>) => as('authenticated', userId, run);

const rowCount = async (table: string) =>
  (await db.query(`select * from public.${table}`)).rows.length;

const insertDay = (date = '2026-11-03', userId?: string) =>
  db.query(
    `insert into public.day_logs (user_id, date, entries)
     values (coalesce($1::uuid, auth.uid()), $2, '[]')`,
    [userId ?? null, date],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  await db.exec(readFileSync('supabase/migrations/20261104000000_bitacora_schema.sql', 'utf8'));
});

beforeEach(async () => {
  await db.exec(`
    truncate auth.users cascade;
    insert into auth.users values ('${OWNER}'), ('${STRANGER}'), ('${SECOND_OWNER}');
    insert into public.allowed_users (user_id) values ('${OWNER}'), ('${SECOND_OWNER}');
    insert into public.day_logs (user_id, date) values ('${OWNER}', '2026-11-02');
    insert into public.pending_items (id, user_id, text, date)
      values ('${PENDING_ID}', '${OWNER}', 'apoyo', '2026-11-02');
    insert into public.user_settings (user_id, settings) values ('${OWNER}', '{}');
  `);
});

describe('row level security', () => {
  it('lets an allowed user read and write their own data', async () => {
    await asUser(OWNER, async () => {
      for (const table of TABLES) expect(await rowCount(table)).toBe(1);
      await insertDay();
      await db.query(`update public.day_logs set day_type = 'half' where date = '2026-11-03'`);
      await db.query(`delete from public.day_logs where date = '2026-11-03'`);
      await db.query(`delete from public.pending_items where id = $1`, [PENDING_ID]);
      await db.query(`update public.user_settings set settings = '{"a": 1}'`);
    });
  });

  it.each(TABLES)('gives anonymous visitors no access to %s', async (table) => {
    await expect(as('anon', '', () => rowCount(table))).rejects.toThrow('permission denied');
  });

  it('gives anonymous visitors no access to the allow list', async () => {
    await expect(as('anon', '', () => rowCount('allowed_users'))).rejects.toThrow(
      'permission denied',
    );
  });

  it.each(TABLES)('hides %s from a signed-in stranger', async (table) => {
    expect(await asUser(STRANGER, () => rowCount(table))).toBe(0);
  });

  it('does not let a stranger write, even under their own id', async () => {
    await expect(asUser(STRANGER, () => insertDay())).rejects.toThrow('row-level security');
    await expect(asUser(STRANGER, () => insertDay('2026-11-03', OWNER))).rejects.toThrow(
      'row-level security',
    );
  });

  it('keeps allowed users apart from each other', async () => {
    await asUser(SECOND_OWNER, async () => {
      for (const table of TABLES) expect(await rowCount(table)).toBe(0);
      await expect(insertDay('2026-11-03', OWNER)).rejects.toThrow('row-level security');
      const updated = await db.query(`update public.day_logs set day_type = 'off'`);
      expect(updated.affectedRows).toBe(0);
    });
  });

  it('does not let anyone grant themselves access', async () => {
    await expect(
      asUser(STRANGER, () =>
        db.query(`insert into public.allowed_users (user_id) values ($1)`, [STRANGER]),
      ),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(OWNER, () =>
        db.query(`insert into public.allowed_users (user_id) values ($1)`, [STRANGER]),
      ),
    ).rejects.toThrow('permission denied');
  });

  it('lets users learn only their own access status', async () => {
    expect(await asUser(OWNER, () => rowCount('allowed_users'))).toBe(1);
    expect(await asUser(STRANGER, () => rowCount('allowed_users'))).toBe(0);
  });
});

describe('constraints', () => {
  it('rejects malformed days', async () => {
    await expect(db.query(`update public.day_logs set day_type = 'other'`)).rejects.toThrow(
      'check',
    );
    await expect(db.query(`update public.day_logs set entries = '{}'`)).rejects.toThrow('check');
    await expect(db.query(`update public.day_logs set start_minutes = 1500`)).rejects.toThrow(
      'check',
    );
  });

  it('limits entries per day and the size of pending notes', async () => {
    const tooMany = JSON.stringify(Array(41).fill({}));
    await expect(
      db.query(`update public.day_logs set entries = $1::jsonb`, [tooMany]),
    ).rejects.toThrow('check');
    await expect(
      db.query(`update public.pending_items set text = $1`, ['x'.repeat(1001)]),
    ).rejects.toThrow('check');
  });

  it('refreshes updated_at on every change', async () => {
    await db.exec(`update public.day_logs set updated_at = '2020-01-01'`);
    await db.exec(`update public.day_logs set day_type = 'half'`);
    const { rows } = await db.query<{ updated_at: Date }>(`select updated_at from public.day_logs`);
    expect(rows[0]?.updated_at.getFullYear()).toBeGreaterThan(2020);
  });

  it('removes all data when the account is deleted', async () => {
    await db.query(`delete from auth.users where id = $1`, [OWNER]);
    for (const table of TABLES) expect(await rowCount(table)).toBe(0);
  });
});
