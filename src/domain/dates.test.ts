import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfMonth,
  formatCsvDate,
  formatLongDate,
  formatMonth,
  isValidIsoDate,
  isWeekday,
  monthGrid,
  parseCsvDate,
  shiftMonth,
  startOfWeek,
  today,
} from './dates';

describe('dates', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('starts the week on Monday, also from a Sunday', () => {
    expect(startOfWeek('2026-11-04')).toBe('2026-11-02');
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02');
  });

  it('builds a month grid starting on Monday', () => {
    const grid = monthGrid('2026-11-18');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid).toContain('2026-11-30');
  });

  it('moves between months from any day, including the 31st', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('tells weekdays from weekends', () => {
    expect(isWeekday('2026-11-06')).toBe(true);
    expect(isWeekday('2026-11-07')).toBe(false);
  });

  it('uses the local date, not UTC', () => {
    expect(today(new Date(2026, 10, 3, 23, 30))).toBe('2026-11-03');
  });

  it('always writes two digits in CSV dates', () => {
    expect(formatCsvDate('2026-11-02')).toBe('02/11/2026');
    expect(formatCsvDate('2026-01-05')).toBe('05/01/2026');
  });

  it('reads CSV dates and rejects impossible ones', () => {
    expect(parseCsvDate('2/11/2026')).toBe('2026-11-02');
    expect(parseCsvDate('31/02/2026')).toBeNull();
    expect(parseCsvDate('46049')).toBeNull();
    expect(isValidIsoDate('2026-13-01')).toBe(false);
  });

  it('formats labels in Spanish', () => {
    expect(formatLongDate('2026-11-03')).toContain('noviembre');
    expect(formatMonth('2026-11-03')).toContain('noviembre');
    expect(dayOfMonth('2026-11-03')).toBe(3);
  });

  it('fails loudly on malformed input', () => {
    expect(() => addDays('nope', 1)).toThrow('Fecha inválida');
  });
});
