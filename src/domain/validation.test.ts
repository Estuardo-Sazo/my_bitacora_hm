import { describe, expect, it } from 'vitest';
import { testDay, testEntry, testSettings } from './testFixtures';
import type { DayLog } from './types';
import { hasBlockingIssues, validateDay } from './validation';

const codes = (day: DayLog): string[] => validateDay(day, testSettings).map((issue) => issue.code);

describe('validateDay', () => {
  it('accepts a normal day', () => {
    expect(validateDay(testDay([1, 2, 1, 2, 2]), testSettings)).toEqual([]);
  });

  it('warns when hours do not add up, without blocking', () => {
    const issues = validateDay(testDay([1, 2, 1, 1, 2]), testSettings);
    expect(issues.map((issue) => issue.code)).toEqual(['hoursMismatch']);
    expect(issues[0]?.message).toBe('Llevas 7h de 8h esperadas.');
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it('warns about days past the end of the workday', () => {
    expect(codes(testDay([4, 4, 1]))).toContain('pastWorkday');
  });

  it('blocks missing required fields', () => {
    const day = testDay([], {
      entries: [
        testEntry({
          activity: '',
          module: '',
          category: '',
          requestedBy: ' ',
          durationMinutes: 0,
        }),
      ],
    });
    expect(codes(day)).toEqual(
      expect.arrayContaining([
        'missingActivity',
        'missingDuration',
        'missingCategory',
        'missingRequester',
        'missingModule',
      ]),
    );
    expect(hasBlockingIssues(validateDay(day, testSettings))).toBe(true);
  });

  it('does not require a module for meetings', () => {
    const day = testDay([], {
      entries: [testEntry({ kind: 'meeting', module: '', durationMinutes: 480 })],
    });
    expect(codes(day)).toEqual([]);
  });

  it('blocks overlapping blocks but not the Daily overlap', () => {
    const day = testDay([], {
      entries: [
        testEntry({ activity: '1', durationMinutes: 240 }),
        testEntry({ activity: '2', durationMinutes: 240, fixedStartMinutes: 600 }),
      ],
    });
    expect(codes(day)).toContain('overlap');
    expect(codes(testDay([4, 4]))).not.toContain('overlap');
  });

  it('warns about modules outside the catalog and repeated tickets', () => {
    const day = testDay([], {
      entries: [
        testEntry({ module: 'Inventado', durationMinutes: 240 }),
        testEntry({ durationMinutes: 240 }),
      ],
    });
    expect(codes(day)).toEqual(expect.arrayContaining(['unknownModule', 'repeatedTicket']));
  });

  it('warns on weekends and expects half on half days', () => {
    expect(codes(testDay([8], { date: '2026-11-07' }))).toEqual(['weekend']);
    expect(codes(testDay([4], { dayType: 'half' }))).toEqual([]);
  });

  it('ignores days off', () => {
    expect(codes(testDay([1], { dayType: 'off' }))).toEqual([]);
  });
});
