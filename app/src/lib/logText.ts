import { formatTime, parseTime } from '@lb/shared';
import type { MealLog, MealStatus } from './db';

export const STATUS_LABEL: Record<MealStatus, string> = {
  followed: 'Followed',
  substituted: 'Substituted',
  skipped: 'Skipped',
};

/** "8:10 am", "earlier today", or undefined. Just the time — no judgment about the window. */
export function whenText(log: MealLog): string | undefined {
  if (log.status === 'skipped') return undefined;
  if (log.eatenAt) {
    const m = parseTime(log.eatenAt);
    return m != null ? formatTime(m) : undefined;
  }
  if (log.whenKind === 'earlier') return 'earlier today';
  return undefined;
}

export function nowHHMM(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
