import type { DayLog } from './types';

/** Maps each ticket to its most recent module, so repeat tickets fill themselves in. */
export function buildTicketModules(days: readonly DayLog[]): Map<string, string> {
  const ticketModules = new Map<string, string>();
  const chronological = [...days].sort((a, b) => a.date.localeCompare(b.date));

  for (const day of chronological) {
    for (const entry of day.entries) {
      if (entry.kind === 'ticket' && entry.module) {
        ticketModules.set(entry.activity, entry.module);
      }
    }
  }
  return ticketModules;
}
