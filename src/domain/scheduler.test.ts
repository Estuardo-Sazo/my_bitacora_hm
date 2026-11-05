import { describe, expect, it } from 'vitest';
import { expectedMinutes, scheduleDay, workedMinutes } from './scheduler';
import { testDay, testEntry, testSettings } from './testFixtures';
import { formatClock } from './time';

const blocks = (hours: number[]): string[] =>
  scheduleDay(testDay(hours, { includeDaily: false }), testSettings).map(
    (row) => `${formatClock(row.startMinutes)}-${formatClock(row.endMinutes)}`,
  );

describe('scheduleDay', () => {
  it('takes lunch at noon when a block ends there', () => {
    expect(blocks([1, 2, 1, 2, 2])).toEqual([
      '08:00-09:00',
      '09:00-11:00',
      '11:00-12:00',
      '13:00-15:00',
      '15:00-17:00',
    ]);
  });

  it('moves lunch later instead of splitting a block that crosses noon', () => {
    expect(blocks([2, 1, 2, 3])).toEqual([
      '08:00-10:00',
      '10:00-11:00',
      '11:00-13:00',
      '14:00-17:00',
    ]);
  });

  it('handles half hours', () => {
    expect(blocks([1.5, 1.5, 1, 3, 1])).toEqual([
      '08:00-09:30',
      '09:30-11:00',
      '11:00-12:00',
      '13:00-16:00',
      '16:00-17:00',
    ]);
  });

  it('puts the Daily first even though it overlaps the first block', () => {
    const [daily, first] = scheduleDay(testDay([2]), testSettings);
    expect(daily).toMatchObject({
      startMinutes: 510,
      endMinutes: 540,
      module: '',
      category: 'Daily Scrum',
      activity: 'Daily Scrum',
      requestedBy: 'ACME',
      entryId: null,
    });
    expect(first?.startMinutes).toBe(480);
  });

  it('honors a day that starts later', () => {
    const rows = scheduleDay(
      testDay([3], { startMinutes: 540, includeDaily: false }),
      testSettings,
    );
    expect(rows[0]?.startMinutes).toBe(540);
  });

  it('skips lunch on a day that starts in the afternoon', () => {
    const rows = scheduleDay(
      testDay([2], { startMinutes: 780, includeDaily: false }),
      testSettings,
    );
    expect(rows[0]?.startMinutes).toBe(780);
  });

  it('pins blocks to a fixed time and continues from them', () => {
    const day = testDay([], {
      includeDaily: false,
      entries: [
        testEntry({ durationMinutes: 180 }),
        testEntry({ fixedStartMinutes: 780, durationMinutes: 60 }),
        testEntry({ durationMinutes: 60 }),
      ],
    });
    expect(scheduleDay(day, testSettings).map((row) => row.startMinutes)).toEqual([480, 780, 840]);
  });

  it('produces nothing for a day off', () => {
    expect(scheduleDay(testDay([8], { dayType: 'off' }), testSettings)).toEqual([]);
  });
});

describe('day totals', () => {
  it('sums worked time without the Daily', () => {
    expect(workedMinutes(testDay([2, 3]))).toBe(300);
    expect(workedMinutes(testDay([2], { dayType: 'off' }))).toBe(0);
  });

  it('expects less on half days and nothing on days off', () => {
    expect(expectedMinutes(testDay([]), testSettings)).toBe(480);
    expect(expectedMinutes(testDay([], { dayType: 'half' }), testSettings)).toBe(240);
    expect(expectedMinutes(testDay([], { dayType: 'off' }), testSettings)).toBe(0);
  });
});
