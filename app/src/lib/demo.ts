// Demo mode (testing builds only): a plan that "started" two weeks ago with a
// realistic, imperfect logging history, so the app can be shown as if in real use.
import { addDays, carbCyclingPlan, isPickOne, resolveDay, sortMeals, toHHMM, todayLocal, type Plan } from '@lb/shared';
import type { SQLiteDatabase } from 'expo-sqlite';
import { CHECKIN_GROUPS, type DayEntry } from '@lb/shared';
import { clearAll, insertPlanRecord, saveEntry, saveLog, setSetting, type MealLog, type MealStatus } from './db';

const DEMO_ID = 'de30de30-0000-4000-8000-00000000d3e0';
const SUBS = ['4 turkey roll-ups', 'Grilled chicken salad at lunch out', 'Protein bar instead', 'Leftover salmon and rice', 'Eggs and toast'];

/** Small deterministic random so the demo looks the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export async function loadDemo(db: SQLiteDatabase): Promise<void> {
  const today = todayLocal();
  const start = addDays(today, -13);
  const earlier = addDays(today, -20);
  const at = (d: string) => `${d}T15:00:00.000Z`;

  const v1: Plan = { ...carbCyclingPlan, id: DEMO_ID, version: 1, title: 'Demo plan', issuedAt: earlier, startDate: earlier, notes: 'Your first plan. Replaced after your follow-up visit.' };
  const v2: Plan = { ...carbCyclingPlan, id: DEMO_ID, version: 2, title: 'Demo plan', issuedAt: start, startDate: earlier };

  await clearAll(db);
  await insertPlanRecord(db, v1, earlier, at(earlier), start);
  await insertPlanRecord(db, v2, start, at(start));
  await setSetting(db, 'firstName', 'Alex');

  const rand = rng(7);
  for (let back = 20; back >= 0; back--) {
    const date = addDays(today, -back);
    const plan = date < start ? v1 : v2;
    // Two days with nothing logged at all, to show how gaps look.
    if (back === 9 || back === 4) continue;
    const day = resolveDay(plan, date);
    if (day.status !== 'active') continue;
    const meals = sortMeals(day.dayPlan.meals);
    for (const m of meals) {
      // Today: only the meals whose window has already started.
      if (back === 0 && m.start > new Date().getHours() * 60 + new Date().getMinutes()) continue;
      const r = rand();
      if (r < 0.1) continue; // forgot to log this one
      const status: MealStatus = r < 0.72 ? 'followed' : r < 0.9 ? 'substituted' : 'skipped';
      const offset = Math.round((rand() - 0.3) * 90); // sometimes a little early or late
      const eaten = Math.min(23 * 60 + 55, Math.max(0, m.start + offset));
      const pick = m.items.findIndex(isPickOne);
      const log: MealLog = {
        date,
        planId: plan.id,
        mealId: m.id,
        planVersion: plan.version,
        mealLabel: m.label,
        status,
        note: status === 'substituted' ? SUBS[Math.floor(rand() * SUBS.length)] : undefined,
        choices: status === 'followed' && pick >= 0 ? { [pick]: Math.floor(rand() * m.items[pick].options.length) } : undefined,
        whenKind: status === 'skipped' ? 'planned' : 'time',
        eatenAt: status === 'skipped' ? undefined : toHHMM(eaten),
        loggedAt: at(date),
      };
      await saveLog(db, log);
    }
    // Everything else for the day, also imperfect on purpose.
    const tags = CHECKIN_GROUPS.flatMap((g) => g.tags).filter((t) => t !== 'dizzy' && t !== 'nauseous');
    const entry: DayEntry = {
      date,
      supplements: plan.supplements.filter(() => rand() < 0.8).map((s) => s.name),
      trained: rand() < 0.45,
      waterOz: plan.features.water ? Array.from({ length: 2 + Math.floor(rand() * 4) }, () => (rand() < 0.5 ? 8 : 16.9)) : undefined,
      alcohol: plan.features.alcohol ? (rand() < 0.2 ? { drank: true, drinks: { wine: 1 + Math.floor(rand() * 2) } } : rand() < 0.8 ? { drank: false } : undefined) : undefined,
      checkIn:
        plan.features.checkIn && rand() < 0.7
          ? { energy: 2 + Math.floor(rand() * 4), mood: 2 + Math.floor(rand() * 4), tags: rand() < 0.4 ? [tags[Math.floor(rand() * tags.length)]] : [], note: rand() < 0.15 ? 'Busy day at work' : undefined }
          : undefined,
    };
    await saveEntry(db, entry);
  }
}

export { clearAll };
