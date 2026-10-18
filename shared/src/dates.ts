// Calendar-date math on 'YYYY-MM-DD' strings. All arithmetic runs in UTC on
// purpose: a calendar date has no time zone, so daylight saving can't shift it.
import type { DateStr, Minutes } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function toUtc(s: DateStr): Date {
  const m = DATE_RE.exec(s);
  if (!m) throw new Error(`Bad date: ${s}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function fromUtc(d: Date): DateStr {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Today's date on this device, in its local time zone. */
export function todayLocal(now: Date = new Date()): DateStr {
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function addDays(s: DateStr, n: number): DateStr {
  return fromUtc(new Date(toUtc(s).getTime() + n * DAY_MS));
}

/** b − a in whole days. */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}

/** Monday-first weekday index: Mon = 0 … Sun = 6. */
export function weekdayIndex(s: DateStr): number {
  return (toUtc(s).getUTCDay() + 6) % 7;
}

/** "Mon, Nov 3" */
export function formatShort(s: DateStr): string {
  const d = toUtc(s);
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Monday, November 3" */
export function formatLong(s: DateStr): string {
  const d = toUtc(s);
  return `${DAYS_LONG[d.getUTCDay()]}, ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Nov 3, 2026" */
export function formatMedium(s: DateStr): string {
  const d = toUtc(s);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Nov 3" */
export function formatMonthDay(s: DateStr): string {
  const d = toUtc(s);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "November 2026" */
export function formatMonthYear(s: DateStr): string {
  const d = toUtc(s);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Nov 3–9", "Oct 27–Nov 2" */
export function formatRange(a: DateStr, b: DateStr): string {
  const da = toUtc(a);
  const db = toUtc(b);
  if (da.getUTCMonth() === db.getUTCMonth()) {
    return `${MONTHS[da.getUTCMonth()]} ${da.getUTCDate()}–${db.getUTCDate()}`;
  }
  return `${formatMonthDay(a)}–${formatMonthDay(b)}`;
}

/** 450 → "7:30 am", 720 → "12 pm" */
export function formatTime(m: Minutes): string {
  const h24 = Math.floor(m / 60) % 24;
  const min = m % 60;
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return min === 0 ? `${h} ${ampm}` : `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

/** "7:30–9 am", "11:30 am–1 pm" */
export function formatWindow(start: Minutes, end: Minutes): string {
  const a = formatTime(start);
  const b = formatTime(end);
  const sameHalf = start < 720 === end < 720;
  if (sameHalf) return `${a.replace(/ (am|pm)$/, '')}–${b}`;
  return `${a}–${b}`;
}

/** "07:30" → 450. Returns undefined for bad input. */
export function parseTime(hhmm: string): Minutes | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return undefined;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return undefined;
  return h * 60 + min;
}

/** 450 → "07:30" (for <input type="time">) */
export function toHHMM(m: Minutes): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
