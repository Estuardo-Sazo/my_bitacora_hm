import { describe, expect, it } from 'vitest';
import { testDay } from '@/domain/testFixtures';
import { dayToRow, pendingToRow, rowToDay, rowToPending } from './supabaseRemote';

describe('row mapping', () => {
  it('round-trips a day', () => {
    const day = testDay([2], {
      dayType: 'half',
      startMinutes: 540,
      exportedAt: '2026-11-04T00:00:00Z',
      exportedFingerprint: 'abc',
    });
    const row = dayToRow(day, 'user');
    expect(row).toMatchObject({ user_id: 'user', day_type: 'half', start_minutes: 540 });
    expect(rowToDay(row)).toEqual(day);
  });

  it('round-trips a pending item', () => {
    const item = { id: 'p', text: 'apoyo', date: '2026-11-03', createdAt: '2026-11-03T10:00:00Z' };
    expect(rowToPending(pendingToRow(item, 'user'))).toEqual(item);
  });
});
