const pad = (value: number): string => String(value).padStart(2, '0');

/** `510` → `08:30`. Also used for durations, which share the CSV's HH:MM format. */
export function formatClock(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Reads `8:30`, `08:30` or `08:30:00`; null when it is not a valid time of day. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const MAX_DURATION_MINUTES = 24 * 60;

/**
 * Reads the ways durations get typed in quick notes: `2h`, `2`, `1.5`, `1,5h`, `1h30`, `1:30`,
 * `45m` and `45min`. Bare numbers mean hours. Returns null for anything else.
 */
export function parseDuration(value: string): number | null {
  const text = value.trim().toLowerCase().replace(',', '.');
  let minutes: number | null = null;

  const hoursAndMinutes = /^(\d{1,2})h(\d{1,2})m?$/.exec(text) ?? /^(\d{1,2}):(\d{2})$/.exec(text);
  const hoursOnly = /^(\d{1,2}(?:\.\d{1,2})?)(?:h|hr|hrs|hora|horas)?$/.exec(text);
  const minutesOnly = /^(\d{1,3})(?:m|min|mins|minutos)$/.exec(text);

  if (hoursAndMinutes) {
    const extra = Number(hoursAndMinutes[2]);
    if (extra < 60) minutes = Number(hoursAndMinutes[1]) * 60 + extra;
  } else if (hoursOnly) {
    minutes = Math.round(Number(hoursOnly[1]) * 60);
  } else if (minutesOnly) {
    minutes = Number(minutesOnly[1]);
  }

  if (minutes === null || minutes <= 0 || minutes > MAX_DURATION_MINUTES) return null;
  return minutes;
}

/** `90` → `1.5h`, in the same style the notes are written. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : Number(hours.toFixed(2))}h`;
}

/** `1 día`, `2 días`. */
export function countDays(count: number): string {
  return `${count} ${count === 1 ? 'día' : 'días'}`;
}
