// "Share my report": every day in a range, in plain words, plus summaries that make
// patterns easy to spot (per-supplement consistency, a day-by-day grid). The app
// turns this into a PDF.
import { sortMeals } from './builders';
import { formatLong, formatMedium, formatTime, parseTime, weekdayIndex } from './dates';
import { planForDate, type PlanRecord } from './importing';
import { hasSchedule, resolveDay } from './schedule';
import { ALCOHOL_TYPES, datesInRange, formatOz, hasAnything, waterTotal, type DayEntry, type MealLogData } from './tracking';
import type { DateStr, Plan } from './types';

export interface ReportMeal {
  label: string;
  /** "Followed", "Substituted", "Skipped", or "Not logged" */
  status: string;
  /** "8:10 am" when known */
  time?: string;
  /** pick-one choice and/or substitution note */
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
  /** Supplements in the plan that day: taken or not. Empty if nothing was logged that day. */
  supplements: { name: string; taken: boolean }[];
  /** Check-in scores, 1–5, if given. */
  energy?: number;
  mood?: number;
  /** Check-in taps and note, kept separate so they can stand out. */
  checkIn?: { tags: string[]; note?: string };
  /** Quick keys for the day card. */
  badges: { allFollowed: boolean; trained: boolean; drank: boolean };
  lines: { label: string; value: string }[];
}

export interface SupplementStat {
  name: string;
  detail?: string;
  taken: number;
  /** Days the supplement was in the plan and the patient logged something that day. */
  of: number;
  /** Days in the plan, logged or not. */
  planDays: number;
  /** e.g. "often missed on Sundays" */
  pattern?: string;
}

/** One cell in the day-by-day grid. */
export type GridCell = 'full' | 'partial' | 'yes' | 'no' | 'drank' | 'dry' | 'none' | 'na';

export interface ReportGrid {
  columns: { date: DateStr; day: string; weekday: string }[];
  rows: { label: string; cells: GridCell[] }[];
}

export interface ReportModel {
  title: string;
  patientName?: string;
  rangeLabel: string;
  planLine: string;
  summary: { daysLogged: number; days: number; followed: number; substituted: number; skipped: number };
  /** Totals beyond meals: water, alcohol, workouts, check-ins. */
  extras: { label: string; value: string }[];
  supplements: SupplementStat[];
  /** Only for ranges up to 31 days (wider would not fit on the page). */
  grid?: ReportGrid;
  days: ReportDay[];
}

const STATUS = { followed: 'Followed', substituted: 'Substituted', skipped: 'Skipped' } as const;
const WEEKDAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function timeText(log: MealLogData): string | undefined {
  if (log.status === 'skipped') return undefined;
  if (log.eatenAt) {
    const m = parseTime(log.eatenAt);
    if (m != null) return formatTime(m);
  }
  return log.whenKind === 'earlier' ? 'earlier in the day' : undefined;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

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

  // Per-supplement tallies, keyed by name.
  const supp = new Map<string, SupplementStat & { missedByWeekday: number[] }>();
  // Per-day facts for the grid.
  const gridFacts: { date: DateStr; level: 'full' | 'partial' | 'none' | 'na'; plan?: Plan; entry?: DayEntry; active: boolean }[] = [];

  const days: ReportDay[] = datesInRange(from, to).map((date) => {
    summary.days++;
    const rec = planForDate(records, date);
    const dayLogs = byDate.get(date) ?? [];
    const entry = entryByDate.get(date);
    const meals: ReportMeal[] = [];
    let dayPlanName: string | undefined;
    let beforePlan = false;
    let active = false;
    let allMealsLogged = false;

    const used = new Set<MealLogData>();
    if (rec) {
      const r = resolveDay(rec.plan, date);
      if (r.status === 'active') {
        active = true;
        if (hasSchedule(rec.plan)) dayPlanName = r.dayPlan.name;
        allMealsLogged = r.dayPlan.meals.length > 0;
        for (const m of sortMeals(r.dayPlan.meals)) {
          const log = dayLogs.find((l) => l.planId === rec.plan.id && l.mealId === m.id);
          if (!log) {
            allMealsLogged = false;
            meals.push({ label: m.label, status: 'Not logged' });
            continue;
          }
          used.add(log);
          const bits: string[] = [];
          for (const [itemIdx, optIdx] of Object.entries(log.choices ?? {})) {
            const opt = m.items[Number(itemIdx)]?.options[optIdx];
            if (opt) bits.push(`had ${opt.name}`);
          }
          if (log.note) bits.push(`“${log.note}”`);
          meals.push({ label: m.label, status: STATUS[log.status], time: timeText(log), detail: bits.join(' · ') || undefined });
        }
      } else {
        beforePlan = true;
      }
    }
    // Logs that don't match today's meals (e.g. logged under a plan that was later replaced).
    for (const l of dayLogs) {
      if (used.has(l)) continue;
      used.add(l);
      meals.push({ label: l.mealLabel, status: STATUS[l.status], time: timeText(l), detail: l.note ? `“${l.note}”` : undefined });
    }
    for (const l of used) summary[l.status]++;

    const empty = dayLogs.length === 0 && !hasAnything(entry);
    if (!empty) summary.daysLogged++;

    // Supplements: counted only on days the plan includes them. A day where nothing
    // at all was logged isn't counted as "missed" (we just don't know).
    const takenSet = new Set(entry?.supplements ?? []);
    const supplements: ReportDay['supplements'] = [];
    if (active && rec) {
      for (const s of rec.plan.supplements) {
        const stat =
          supp.get(s.name) ??
          { name: s.name, detail: [s.dose, s.timing].filter(Boolean).join(', ') || undefined, taken: 0, of: 0, planDays: 0, missedByWeekday: [0, 0, 0, 0, 0, 0, 0] };
        stat.planDays++;
        if (!empty) {
          stat.of++;
          const took = takenSet.has(s.name);
          if (took) stat.taken++;
          else stat.missedByWeekday[weekdayIndex(date)]++;
          supplements.push({ name: s.name, taken: took });
        }
        supp.set(s.name, stat);
      }
    }

    const lines: { label: string; value: string }[] = [];
    if (entry) {
      if (entry.trained) lines.push({ label: 'Workout', value: entry.postWorkoutCarbs ? 'Trained · had post-workout carbs' : 'Trained' });
      else if (entry.postWorkoutCarbs) lines.push({ label: 'Post-workout carbs', value: 'Taken' });
      if (entry.waterOz?.length) lines.push({ label: 'Water', value: formatOz(waterTotal(entry)) });
      if (entry.alcohol) {
        if (!entry.alcohol.drank) lines.push({ label: 'Alcohol', value: 'None' });
        else {
          const parts = ALCOHOL_TYPES.filter((a) => entry.alcohol!.drinks?.[a.value]).map((a) => `${entry.alcohol!.drinks![a.value]} ${a.label.toLowerCase()}`);
          lines.push({ label: 'Alcohol', value: parts.length ? parts.join(', ') : 'Yes' });
        }
      }
    }

    gridFacts.push({ date, level: !active ? 'na' : empty ? 'none' : allMealsLogged ? 'full' : 'partial', plan: rec?.plan, entry, active });
    const c = entry?.checkIn;
    const checkIn = c && (c.tags.length || c.note) ? { tags: c.tags, note: c.note } : undefined;
    const badges = {
      allFollowed: active && allMealsLogged && meals.every((m) => m.status === 'Followed'),
      trained: !!entry?.trained,
      drank: !!entry?.alcohol?.drank,
    };
    return { date, dateLabel: formatLong(date), dayPlanName, empty, beforePlan, meals, supplements, energy: c?.energy, mood: c?.mood, checkIn, badges, lines };
  });

  // Supplement consistency, with a gentle pattern note when misses cluster on one weekday.
  const supplements: SupplementStat[] = [...supp.values()].map(({ missedByWeekday, ...s }) => {
    const missed = s.of - s.taken;
    const top = Math.max(...missedByWeekday);
    const wd = missedByWeekday.indexOf(top);
    const pattern = missed >= 2 && top >= 2 && top / missed >= 0.5 ? `often missed on ${WEEKDAY_NAMES[wd]}` : undefined;
    return { ...s, pattern };
  });

  // Totals across the range.
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  const waterDays = inRange.filter((e) => e.waterOz?.length);
  const drinkDays = inRange.filter((e) => e.alcohol?.drank);
  const drinks = drinkDays.reduce((n, e) => n + Object.values(e.alcohol?.drinks ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0);
  const noDrinkDays = inRange.filter((e) => e.alcohol && !e.alcohol.drank).length;
  const trainedDays = inRange.filter((e) => e.trained).length;
  const pwcDays = inRange.filter((e) => e.postWorkoutCarbs).length;
  const checkIns = inRange.filter((e) => e.checkIn && (e.checkIn.energy || e.checkIn.mood || e.checkIn.tags.length || e.checkIn.note));
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : undefined);
  const energy = avg(checkIns.map((e) => e.checkIn!.energy).filter((x): x is number => !!x));
  const mood = avg(checkIns.map((e) => e.checkIn!.mood).filter((x): x is number => !!x));
  const extras: { label: string; value: string }[] = [];
  if (waterDays.length) extras.push({ label: 'Water', value: `logged ${plural(waterDays.length, 'day')} · average ${formatOz(avg(waterDays.map(waterTotal))!)} on those days` });
  if (drinkDays.length || noDrinkDays) extras.push({ label: 'Alcohol', value: `${plural(drinkDays.length, 'day')} with drinks (${drinks} total) · ${plural(noDrinkDays, 'day')} with none` });
  if (trainedDays) extras.push({ label: 'Workouts', value: `${plural(trainedDays, 'day')}${pwcDays ? ` · post-workout carbs on ${plural(pwcDays, 'day')}` : ''}` });
  if (checkIns.length)
    extras.push({ label: 'Check-ins', value: [plural(checkIns.length, 'day'), energy && `average energy ${energy}/5`, mood && `average mood ${mood}/5`].filter(Boolean).join(' · ') });

  // Day-by-day grid (only rows that have something to show).
  let grid: ReportGrid | undefined;
  if (gridFacts.length <= 31) {
    const columns = gridFacts.map((g) => ({ date: g.date, day: String(Number(g.date.slice(8))), weekday: WEEKDAY_LETTERS[weekdayIndex(g.date)] }));
    const rows: ReportGrid['rows'] = [{ label: 'Meals', cells: gridFacts.map((g) => g.level) }];
    for (const s of supplements) {
      rows.push({
        label: s.name,
        cells: gridFacts.map((g) => {
          if (!g.active || !g.plan?.supplements.some((x) => x.name === s.name)) return 'na';
          if (g.level === 'none') return 'none';
          return g.entry?.supplements?.includes(s.name) ? 'yes' : 'no';
        }),
      });
    }
    if (waterDays.length) rows.push({ label: 'Water', cells: gridFacts.map((g) => (g.entry?.waterOz?.length ? 'yes' : g.level === 'none' || g.level === 'na' ? 'none' : 'no')) });
    if (trainedDays) rows.push({ label: 'Trained', cells: gridFacts.map((g) => (g.entry?.trained ? 'yes' : 'none')) });
    if (drinkDays.length || noDrinkDays)
      rows.push({ label: 'Alcohol', cells: gridFacts.map((g) => (g.entry?.alcohol?.drank ? 'drank' : g.entry?.alcohol ? 'dry' : 'none')) });
    if (checkIns.length) rows.push({ label: 'Check-in', cells: gridFacts.map((g) => (checkIns.includes(g.entry!) ? 'yes' : 'none')) });
    grid = { columns, rows };
  }

  const latest = planForDate(records, to);
  return {
    title: 'my nutrition report',
    patientName: input.patientName,
    rangeLabel: `${formatMedium(from)} – ${formatMedium(to)}`,
    planLine: latest ? `${latest.plan.title} · v${latest.plan.version} · ${input.planCodeOf(latest.plan.id)}` : '',
    summary,
    extras,
    supplements,
    grid,
    days,
  };
}
