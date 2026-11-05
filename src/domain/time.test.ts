import { describe, expect, it } from 'vitest';
import { countDays, formatClock, formatHours, parseClock, parseDuration } from './time';

describe('parseDuration', () => {
  it.each([
    ['2h', 120],
    ['2', 120],
    ['1.5', 90],
    ['1,5h', 90],
    ['1h30', 90],
    ['1h30m', 90],
    ['1:30', 90],
    ['45m', 45],
    ['45min', 45],
    ['2hrs', 120],
    ['2horas', 120],
  ])('reads %s as %i minutes', (input, minutes) => {
    expect(parseDuration(input)).toBe(minutes);
  });

  it.each(['', 'planilla', '4to', '0', '0h', '25h', '1h75', '1:75'])('rejects %s', (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});

describe('clock helpers', () => {
  it('formats minutes as HH:MM', () => {
    expect(formatClock(510)).toBe('08:30');
  });

  it('reads the formats Excel writes', () => {
    expect(parseClock('8:30')).toBe(510);
    expect(parseClock('08:30:00')).toBe(510);
    expect(parseClock('25:00')).toBeNull();
    expect(parseClock(' ')).toBeNull();
  });

  it('formats hours as they are written in notes', () => {
    expect(formatHours(90)).toBe('1.5h');
    expect(formatHours(480)).toBe('8h');
  });

  it('counts days in singular and plural', () => {
    expect(countDays(1)).toBe('1 día');
    expect(countDays(2)).toBe('2 días');
  });
});
