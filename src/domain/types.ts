/** Calendar date as `yyyy-mm-dd`, always interpreted in local time. */
export type IsoDate = string;

export type EntryKind = 'ticket' | 'noPlan' | 'meeting';

/** One block of work. Clock times are derived by the scheduler unless `fixedStartMinutes` is set. */
export interface WorkEntry {
  id: string;
  kind: EntryKind;
  /** Exported as `Actividad`: a ticket number, the No Plan label or a meeting name. */
  activity: string;
  module: string;
  category: string;
  requestedBy: string;
  durationMinutes: number;
  /** Pins this block to a clock time, for days that do not follow the usual rule. */
  fixedStartMinutes: number | null;
  /** Private context. Never exported to the CSV. */
  note: string;
}

export type DayType = 'full' | 'half' | 'off';

export interface DayLog {
  date: IsoDate;
  dayType: DayType;
  includeDaily: boolean;
  /** Overrides the usual start of the workday. */
  startMinutes: number | null;
  entries: WorkEntry[];
  exportedAt: string | null;
  /** Fingerprint of the exported rows, used to detect edits made after exporting. */
  exportedFingerprint: string | null;
}

/** Support work noted without hours; it waits here until it gets hours or a ticket. */
export interface PendingItem {
  id: string;
  text: string;
  date: IsoDate;
  createdAt: string;
}

export interface DailySettings {
  enabled: boolean;
  startMinutes: number;
  durationMinutes: number;
  label: string;
  requestedBy: string;
}

export interface Settings {
  workdayStartMinutes: number;
  workdayEndMinutes: number;
  lunchStartMinutes: number;
  lunchDurationMinutes: number;
  expectedDayMinutes: number;
  daily: DailySettings;
  defaultCategory: string;
  defaultRequestedBy: string;
  noPlanLabel: string;
  modules: string[];
  exportFilePrefix: string;
}

/** A finished bitácora line: one row of the CSV. */
export interface ScheduledRow {
  date: IsoDate;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  module: string;
  category: string;
  activity: string;
  requestedBy: string;
  /** Set for work blocks; null for the automatic Daily row. */
  entryId: string | null;
}

export type DayStatus = 'empty' | 'off' | 'draft' | 'exported' | 'modified';
