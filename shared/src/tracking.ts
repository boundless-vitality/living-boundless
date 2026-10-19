// What a patient can track. Lives only on their phone; shared here so the
// report and streak logic can be tested.
import { addDays, daysBetween, weekdayIndex } from './dates';
import type { DateStr } from './types';

export type MealStatus = 'followed' | 'substituted' | 'skipped';
export type WhenKind = 'now' | 'earlier' | 'time' | 'planned';

export interface MealLogData {
  date: DateStr;
  planId: string;
  mealId: number;
  planVersion: number;
  mealLabel: string;
  status: MealStatus;
  note?: string;
  /** pick-one item index → option index chosen */
  choices?: Record<number, number>;
  whenKind: WhenKind;
  /** 'HH:MM' local, when known */
  eatenAt?: string;
  loggedAt: string;
}

export type AlcoholType = 'wine' | 'beer' | 'cocktail' | 'shot';

export const ALCOHOL_TYPES: { value: AlcoholType; label: string }[] = [
  { value: 'wine', label: 'Wine' },
  { value: 'beer', label: 'Beer' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'shot', label: 'Shot / spirit' },
];

export interface CheckIn {
  /** 1–5 */
  energy?: number;
  /** 1–5 */
  mood?: number;
  tags: string[];
  note?: string;
}

/** Everything other than meals, for one day. */
export interface DayEntry {
  date: DateStr;
  checkIn?: CheckIn;
  /** Names of supplements taken. */
  supplements?: string[];
  postWorkoutCarbs?: boolean;
  trained?: boolean;
  water?: number;
  /** undefined = not answered; drank false = "no". */
  alcohol?: { drank: boolean; drinks?: Partial<Record<AlcoholType, number>> };
}

export const CHECKIN_GROUPS: { key: string; label: string; tags: string[] }[] = [
  { key: 'appetite', label: 'Appetite', tags: ['starving', 'hungrier than usual', 'satisfied', 'too full'] },
  { key: 'energy', label: 'Energy', tags: ['low energy', 'wiped out'] },
  { key: 'mood', label: 'Mood', tags: ['irritable', 'frustrated', 'stressed'] },
  { key: 'digestion', label: 'Digestion', tags: ['bloated', 'gassy', 'constipated', 'nauseous'] },
  { key: 'workout', label: 'Workout', tags: ['starving after workout', 'felt strong'] },
  { key: 'other', label: 'Other', tags: ['dizzy', 'headache', 'slept poorly'] },
];

/** Taps that should bring the "reach out / call 911" note back on screen. */
export const SAFETY_TAGS = ['dizzy', 'nauseous'];

export const DISCLAIMER =
  "This is just for you. What you log here isn't sent to Cristie or the Boundless Vitality team. We only see it if you share your report. If something is bothering you, reach out to your provider. If you feel seriously unwell, call 911 or go to the nearest emergency room.";

export const DISCLAIMER_SHORT = "Just for you. Not sent to the team unless you share your report. Feeling seriously unwell? Call 911.";

export function hasAnything(e: DayEntry | undefined): boolean {
  if (!e) return false;
  return !!(
    (e.checkIn && (e.checkIn.energy || e.checkIn.mood || e.checkIn.tags.length || e.checkIn.note)) ||
    e.supplements?.length ||
    e.postWorkoutCarbs ||
    e.trained ||
    e.water ||
    e.alcohol
  );
}

/** A day "counts" for showing up if anything at all was logged. */
export function loggedDays(mealLogDates: DateStr[], entries: DayEntry[]): Set<DateStr> {
  const out = new Set(mealLogDates);
  for (const e of entries) if (hasAnything(e)) out.add(e.date);
  return out;
}

/** Consecutive days with something logged, ending today (or yesterday, if today isn't logged yet). */
export function currentStreak(days: Set<DateStr>, today: DateStr): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Monday–Sunday week containing `today`: how many days logged so far, out of days elapsed (max 7). */
export function weekSummary(days: Set<DateStr>, today: DateStr, notBefore?: DateStr): { logged: number; elapsed: number; monday: DateStr } {
  const monday = addDays(today, -weekdayIndex(today));
  let logged = 0;
  let elapsed = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    if (d > today) break;
    if (notBefore && d < notBefore) continue;
    elapsed++;
    if (days.has(d)) logged++;
  }
  return { logged, elapsed, monday };
}

/** Encouraging line for the week. Never judgy. */
export function weekMessage(logged: number, elapsed: number): string {
  if (elapsed === 0) return '';
  if (logged === 0) return 'A fresh week. Log anything today to get started.';
  if (logged === elapsed) return `${logged} of ${elapsed} days logged this week. You're showing up.`;
  return `${logged} of ${elapsed} days logged this week. Nice work showing up.`;
}

export function datesInRange(from: DateStr, to: DateStr): DateStr[] {
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}
