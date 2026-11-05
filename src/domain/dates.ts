import type { IsoDate } from './types';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toLocalDate(date: IsoDate): Date {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Fecha inválida: ${date}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIso(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function today(now: Date = new Date()): IsoDate {
  return toIso(now);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const result = toLocalDate(date);
  result.setDate(result.getDate() + days);
  return toIso(result);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  const mondayBasedIndex = (toLocalDate(date).getDay() + 6) % 7;
  return addDays(date, -mondayBasedIndex);
}

/** Six full weeks covering the month of `date`, so the calendar never changes height. */
export function monthGrid(date: IsoDate): IsoDate[] {
  const firstMonday = startOfWeek(`${date.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, index) => addDays(firstMonday, index));
}

/** First day of the month `months` away from `date`. */
export function shiftMonth(date: IsoDate, months: number): IsoDate {
  const result = toLocalDate(`${date.slice(0, 7)}-01`);
  result.setMonth(result.getMonth() + months);
  return toIso(result);
}

export function isWeekday(date: IsoDate): boolean {
  const day = toLocalDate(date).getDay();
  return day !== 0 && day !== 6;
}

export function isValidIsoDate(date: string): boolean {
  return ISO_DATE.test(date) && toIso(toLocalDate(date)) === date;
}

/** `2026-01-05` → `05/01/2026`: the target system expects two digits in days and months. */
export function formatCsvDate(date: IsoDate): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/** Reads `d/m/yyyy` (padded or not) into an ISO date; null when it is not a real date. */
export function parseCsvDate(value: string): IsoDate | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[2]?.padStart(2, '0')}-${match[1]?.padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function formatLongDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(toLocalDate(date));
}

export function formatMonth(date: IsoDate): string {
  return new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(
    toLocalDate(date),
  );
}

export function dayOfMonth(date: IsoDate): number {
  return toLocalDate(date).getDate();
}
