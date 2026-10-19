// "Share my report": every day in a range, in plain words. The app turns this into a PDF.
import { formatLong, formatMedium, formatTime, parseTime } from './dates';
import { planForDate, type PlanRecord } from './importing';
import { hasSchedule, resolveDay } from './schedule';
import { sortMeals } from './builders';
import { ALCOHOL_TYPES, datesInRange, formatOz, hasAnything, waterTotal, type DayEntry, type MealLogData } from './tracking';
import type { DateStr } from './types';

export interface ReportMeal {
  label: string;
  /** "Followed", "Substituted", "Skipped", or "Not logged" */
  status: string;
  detail?: string;
}

export interface ReportDay {
  date: DateStr;
  dateLabel: string;
  dayPlanName?: string;
  /** Nothing at all logged for this day. */
  empty: boolean;
  /** Before the plan started on that date. */
  beforePlan: boolean;
  meals: ReportMeal[];
  lines: { label: string; value: string }[];
}

export interface ReportModel {
  title: string;
  patientName?: string;
  rangeLabel: string;
  planLine: string;
  summary: { daysLogged: number; days: number; followed: number; substituted: number; skipped: number };
  /** Totals beyond meals: water, alcohol, supplements, workouts, check-ins. */
  extras: { label: string; value: string }[];
  days: ReportDay[];
}

const STATUS = { followed: 'Followed', substituted: 'Substituted', skipped: 'Skipped' } as const;

function timeText(log: MealLogData): string | undefined {
  if (log.status === 'skipped') return undefined;
  if (log.eatenAt) {
    const m = parseTime(log.eatenAt);
    if (m != null) return formatTime(m);
  }
  return log.whenKind === 'earlier' ? 'earlier in the day' : undefined;
}

export function buildReport(input: {
  records: PlanRecord[];
  logs: MealLogData[];
  entries: DayEntry[];
  from: DateStr;
  to: DateStr;
  patientName?: string;
  planCodeOf: (id: string) => string;
}): ReportModel {
  const { records, logs, entries, from, to } = input;
  const byDate = new Map<DateStr, MealLogData[]>();
  for (const l of logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
  const entryByDate = new Map(entries.map((e) => [e.date, e]));
  const summary = { daysLogged: 0, days: 0, followed: 0, substituted: 0, skipped: 0 };

  const days: ReportDay[] = datesInRange(from, to).map((date) => {
    summary.days++;
    const rec = planForDate(records, date);
    const dayLogs = byDate.get(date) ?? [];
    const entry = entryByDate.get(date);
    const meals: ReportMeal[] = [];
    let dayPlanName: string | undefined;
    let beforePlan = false;

    const used = new Set<MealLogData>();
    if (rec) {
      const r = resolveDay(rec.plan, date);
      if (r.status === 'active') {
        if (hasSchedule(rec.plan)) dayPlanName = r.dayPlan.name;
        for (const m of sortMeals(r.dayPlan.meals)) {
          const log = dayLogs.find((l) => l.planId === rec.plan.id && l.mealId === m.id);
          if (!log) {
            meals.push({ label: m.label, status: 'Not logged' });
            continue;
          }
          used.add(log);
          const bits: string[] = [];
          const t = timeText(log);
          if (t) bits.push(t);
          for (const [itemIdx, optIdx] of Object.entries(log.choices ?? {})) {
            const opt = m.items[Number(itemIdx)]?.options[optIdx];
            if (opt) bits.push(`had ${opt.name}`);
          }
          if (log.note) bits.push(`“${log.note}”`);
          meals.push({ label: m.label, status: STATUS[log.status], detail: bits.join(' · ') || undefined });
        }
      } else {
        beforePlan = true;
      }
    }
    // Logs that don't match today's meals (e.g. logged under a plan that was later replaced).
    for (const l of dayLogs) {
      if (used.has(l)) continue;
      used.add(l);
      meals.push({ label: l.mealLabel, status: STATUS[l.status], detail: [timeText(l), l.note && `“${l.note}”`].filter(Boolean).join(' · ') || undefined });
    }
    for (const l of used) summary[l.status]++;

    const lines: { label: string; value: string }[] = [];
    if (entry) {
      if (entry.supplements?.length) {
        const total = rec?.plan.supplements.length;
        lines.push({ label: 'Supplements', value: `${total ? `${entry.supplements.length} of ${total}: ` : ''}${entry.supplements.join(', ')}` });
      }
      if (entry.postWorkoutCarbs) lines.push({ label: 'Post-workout carbs', value: 'Taken' });
      if (entry.trained) lines.push({ label: 'Workout', value: 'Trained today' });
      if (entry.waterOz?.length) lines.push({ label: 'Water', value: formatOz(waterTotal(entry)) });
      if (entry.alcohol) {
        if (!entry.alcohol.drank) lines.push({ label: 'Alcohol', value: 'None' });
        else {
          const parts = ALCOHOL_TYPES.filter((a) => entry.alcohol!.drinks?.[a.value]).map((a) => `${entry.alcohol!.drinks![a.value]} ${a.label.toLowerCase()}`);
          lines.push({ label: 'Alcohol', value: parts.length ? parts.join(', ') : 'Yes' });
        }
      }
      const c = entry.checkIn;
      if (c) {
        const bits: string[] = [];
        if (c.energy) bits.push(`energy ${c.energy}/5`);
        if (c.mood) bits.push(`mood ${c.mood}/5`);
        if (c.tags.length) bits.push(c.tags.join(', '));
        if (bits.length) lines.push({ label: 'Check-in', value: bits.join(' · ') });
        if (c.note) lines.push({ label: 'Note', value: `“${c.note}”` });
      }
    }

    const empty = dayLogs.length === 0 && !hasAnything(entry);
    if (!empty) summary.daysLogged++;
    return { date, dateLabel: formatLong(date), dayPlanName, empty, beforePlan, meals, lines };
  });

  // Totals across the range.
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  const waterDays = inRange.filter((e) => e.waterOz?.length);
  const drinkDays = inRange.filter((e) => e.alcohol?.drank);
  const drinks = drinkDays.reduce((n, e) => n + Object.values(e.alcohol?.drinks ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0);
  const noDrinkDays = inRange.filter((e) => e.alcohol && !e.alcohol.drank).length;
  const suppDays = inRange.filter((e) => e.supplements?.length).length;
  const trainedDays = inRange.filter((e) => e.trained).length;
  const pwcDays = inRange.filter((e) => e.postWorkoutCarbs).length;
  const checkIns = inRange.filter((e) => e.checkIn && (e.checkIn.energy || e.checkIn.mood || e.checkIn.tags.length || e.checkIn.note));
  const days_ = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined);
  const energy = avg(checkIns.map((e) => e.checkIn!.energy).filter((x): x is number => !!x));
  const mood = avg(checkIns.map((e) => e.checkIn!.mood).filter((x): x is number => !!x));
  const extras: { label: string; value: string }[] = [];
  if (waterDays.length) extras.push({ label: 'Water', value: `logged ${days_(waterDays.length)} · average ${formatOz(avg(waterDays.map(waterTotal))!)} on those days` });
  if (drinkDays.length || noDrinkDays) extras.push({ label: 'Alcohol', value: `${days_(drinkDays.length)} with drinks (${drinks} total) · ${days_(noDrinkDays)} with none` });
  if (suppDays) extras.push({ label: 'Supplements', value: `taken on ${days_(suppDays)}` });
  if (trainedDays) extras.push({ label: 'Workouts', value: `${days_(trainedDays)}${pwcDays ? ` · post-workout carbs on ${days_(pwcDays)}` : ''}` });
  if (checkIns.length)
    extras.push({ label: 'Check-ins', value: [days_(checkIns.length), energy && `average energy ${energy}/5`, mood && `average mood ${mood}/5`].filter(Boolean).join(' · ') });

  const latest = planForDate(records, to);
  return {
    extras,
    title: 'my nutrition report',
    patientName: input.patientName,
    rangeLabel: `${formatMedium(from)} – ${formatMedium(to)}`,
    planLine: latest ? `${latest.plan.title} · v${latest.plan.version} · ${input.planCodeOf(latest.plan.id)}` : '',
    summary,
    days,
  };
}
