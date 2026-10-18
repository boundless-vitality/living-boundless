// "Which day plan applies on date X?"
import { addDays, daysBetween, formatRange, weekdayIndex } from './dates';
import type { DateStr, DayPlan, Plan, Schedule, WeekSpec, WeekdayMap } from './types';
import { WEEKDAYS_SHORT } from './types';

export type ResolvedDay =
  | { status: 'beforeStart'; startsOn: DateStr; firstDay: DayPlan | undefined }
  | {
      status: 'active';
      dayPlan: DayPlan;
      /** 0-based week index, only for week-by-week schedules. */
      week?: number;
      weekCount?: number;
      /** True once a week-by-week plan has run past its last week. */
      pastLastWeek: boolean;
    };

function pick(spec: WeekSpec | Schedule, date: DateStr): number {
  if (spec.kind === 'daily') return spec.dayPlanId;
  if (spec.kind === 'weekday') return spec.map[weekdayIndex(date)];
  throw new Error('nested weeks');
}

export function findDayPlan(plan: Plan, id: number): DayPlan | undefined {
  return plan.dayPlans.find((d) => d.id === id);
}

export function resolveDay(plan: Plan, date: DateStr): ResolvedDay {
  const offset = daysBetween(plan.startDate, date);
  const s = plan.schedule;
  if (offset < 0) {
    return { status: 'beforeStart', startsOn: plan.startDate, firstDay: dayPlanForOffset(plan, plan.startDate).dayPlan };
  }
  if (s.kind !== 'weeks') {
    return { status: 'active', dayPlan: mustFind(plan, pick(s, date)), pastLastWeek: false };
  }
  const r = dayPlanForOffset(plan, date);
  return { status: 'active', dayPlan: mustFind(plan, r.id), week: r.week, weekCount: s.weeks.length, pastLastWeek: r.past };
}

function dayPlanForOffset(plan: Plan, date: DateStr): { id: number; dayPlan: DayPlan | undefined; week?: number; past: boolean } {
  const s = plan.schedule;
  if (s.kind !== 'weeks') {
    const id = pick(s, date);
    return { id, dayPlan: findDayPlan(plan, id), past: false };
  }
  const offset = Math.max(0, daysBetween(plan.startDate, date));
  const raw = Math.floor(offset / 7);
  const week = Math.min(raw, s.weeks.length - 1);
  const id = pick(s.weeks[week], date);
  return { id, dayPlan: findDayPlan(plan, id), week, past: raw >= s.weeks.length };
}

function mustFind(plan: Plan, id: number): DayPlan {
  const d = findDayPlan(plan, id);
  // Validation guarantees schedule ids exist; fall back to the first day plan just in case.
  return d ?? plan.dayPlans[0];
}

/** True if the patient should ever see schedule complexity (more than one day plan in use). */
export function hasSchedule(plan: Plan): boolean {
  return usedDayPlanIds(plan.schedule).size > 1 || plan.schedule.kind === 'weeks';
}

export function usedDayPlanIds(s: Schedule): Set<number> {
  const out = new Set<number>();
  const add = (w: WeekSpec | Schedule) => {
    if (w.kind === 'daily') out.add(w.dayPlanId);
    else if (w.kind === 'weekday') w.map.forEach((id) => out.add(id));
  };
  if (s.kind === 'weeks') s.weeks.forEach(add);
  else add(s);
  return out;
}

/** Mon, Tue, Wed, Thu → "Mon–Thu"; Mon, Wed → "Mon, Wed"; all 7 → "every day". */
export function weekdayRanges(indices: number[]): string {
  const set = [...new Set(indices)].sort((a, b) => a - b);
  if (set.length === 7) return 'every day';
  const parts: string[] = [];
  let i = 0;
  while (i < set.length) {
    let j = i;
    while (j + 1 < set.length && set[j + 1] === set[j] + 1) j++;
    const len = j - i + 1;
    if (len >= 3) parts.push(`${WEEKDAYS_SHORT[set[i]]}–${WEEKDAYS_SHORT[set[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(WEEKDAYS_SHORT[set[k]]);
    i = j + 1;
  }
  return parts.join(', ');
}

function describeMap(plan: Plan, map: WeekdayMap): string {
  const byId = new Map<number, number[]>();
  map.forEach((id, wd) => byId.set(id, [...(byId.get(id) ?? []), wd]));
  return [...byId.entries()]
    .map(([id, days]) => `${findDayPlan(plan, id)?.name ?? 'Day plan'}: ${weekdayRanges(days)}`)
    .join(' · ');
}

function describeSpec(plan: Plan, spec: WeekSpec | Schedule): string {
  if (spec.kind === 'daily') return `${findDayPlan(plan, spec.dayPlanId)?.name ?? 'Day plan'}: every day`;
  if (spec.kind === 'weekday') return describeMap(plan, spec.map);
  return '';
}

/**
 * The schedule in plain words, one line per row.
 * "Low-Carb Day: Mon, Tue · High-Carb Day: Wed–Sun"
 * "Week 1 (Nov 3–9): Training Day: every day"
 */
export function describeSchedule(plan: Plan): string[] {
  const s = plan.schedule;
  if (s.kind !== 'weeks') return [describeSpec(plan, s)];
  return s.weeks.map((w, i) => {
    const from = addDays(plan.startDate, i * 7);
    const to = addDays(from, 6);
    const label = `Week ${i + 1} (${formatRange(from, to)}${i === s.weeks.length - 1 ? ', then ongoing' : ''})`;
    return `${label}: ${describeSpec(plan, w)}`;
  });
}
