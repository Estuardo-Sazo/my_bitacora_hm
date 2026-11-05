import type { DayLog, ScheduledRow, Settings } from './types';

/**
 * Assigns clock times to a day. This is the rule measured in the real logbook: start at the usual
 * hour, never split a block, and take lunch at the first boundary at or after lunch time. A block
 * running past noon therefore moves lunch later instead of being cut.
 */
export function scheduleDay(day: DayLog, settings: Settings): ScheduledRow[] {
  if (day.dayType === 'off') return [];

  const rows: ScheduledRow[] = [];
  if (day.includeDaily) {
    const { startMinutes, durationMinutes, label, requestedBy } = settings.daily;
    rows.push({
      date: day.date,
      startMinutes,
      endMinutes: startMinutes + durationMinutes,
      durationMinutes,
      module: '',
      category: label,
      activity: label,
      requestedBy,
      entryId: null,
    });
  }

  let clock = day.startMinutes ?? settings.workdayStartMinutes;
  let lunchTaken = clock >= settings.lunchStartMinutes;

  for (const entry of day.entries) {
    if (entry.fixedStartMinutes !== null) {
      clock = entry.fixedStartMinutes;
      if (clock >= settings.lunchStartMinutes) lunchTaken = true;
    } else if (!lunchTaken && clock >= settings.lunchStartMinutes) {
      clock += settings.lunchDurationMinutes;
      lunchTaken = true;
    }

    rows.push({
      date: day.date,
      startMinutes: clock,
      endMinutes: clock + entry.durationMinutes,
      durationMinutes: entry.durationMinutes,
      module: entry.module,
      category: entry.category,
      activity: entry.activity,
      requestedBy: entry.requestedBy,
      entryId: entry.id,
    });
    clock += entry.durationMinutes;
  }
  return rows;
}

/** Hours worked on tickets and other blocks; the Daily is counted apart, as it overlaps them. */
export function workedMinutes(day: DayLog): number {
  if (day.dayType === 'off') return 0;
  return day.entries.reduce((total, entry) => total + entry.durationMinutes, 0);
}

export function expectedMinutes(day: DayLog, settings: Settings): number {
  if (day.dayType === 'off') return 0;
  return day.dayType === 'half' ? settings.expectedDayMinutes / 2 : settings.expectedDayMinutes;
}
