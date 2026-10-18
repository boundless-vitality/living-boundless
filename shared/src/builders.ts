// Plan editing helpers for the coach page. Pure functions: each returns a new plan.
import { defaultPlanTitle } from './describe';
import type { DateStr, DayPlan, Meal, Plan } from './types';

export function newMeal(id: number, label = 'Breakfast', start = 7 * 60, end = 9 * 60): Meal {
  return { id, label, start, end, components: [], items: [] };
}

export function newPlan(id: string, today: DateStr): Plan {
  return {
    id,
    version: 1,
    issuedAt: today,
    title: defaultPlanTitle(today),
    startDate: today,
    dayPlans: [{ id: 1, name: 'Daily Plan', meals: [newMeal(2)] }],
    schedule: { kind: 'daily', dayPlanId: 1 },
    supplements: [],
    features: { water: false, alcohol: false, checkIn: false },
    nextId: 3,
  };
}

/** Hands out the next id and returns the updated plan with it. */
export function takeId(plan: Plan): [number, Plan] {
  return [plan.nextId, { ...plan, nextId: plan.nextId + 1 }];
}

function cloneMeal(m: Meal, id: number): Meal {
  return structuredCloneSafe({ ...m, id });
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function duplicateDayPlan(plan: Plan, dayPlanId: number): Plan {
  const src = plan.dayPlans.find((d) => d.id === dayPlanId);
  if (!src) return plan;
  let next = plan.nextId;
  const copy: DayPlan = {
    id: next++,
    name: `${src.name} (copy)`,
    meals: src.meals.map((m) => cloneMeal(m, next++)),
  };
  const idx = plan.dayPlans.indexOf(src);
  const dayPlans = [...plan.dayPlans];
  dayPlans.splice(idx + 1, 0, copy);
  return { ...plan, dayPlans, nextId: next };
}

export function duplicateMeal(plan: Plan, dayPlanId: number, mealId: number): Plan {
  const [id, p] = takeId(plan);
  return {
    ...p,
    dayPlans: p.dayPlans.map((d) => {
      if (d.id !== dayPlanId) return d;
      const i = d.meals.findIndex((m) => m.id === mealId);
      if (i < 0) return d;
      const meals = [...d.meals];
      meals.splice(i + 1, 0, cloneMeal(d.meals[i], id));
      return { ...d, meals };
    }),
  };
}

export function copyMealTo(plan: Plan, fromDayPlanId: number, mealId: number, toDayPlanId: number): Plan {
  const meal = plan.dayPlans.find((d) => d.id === fromDayPlanId)?.meals.find((m) => m.id === mealId);
  if (!meal) return plan;
  const [id, p] = takeId(plan);
  return {
    ...p,
    dayPlans: p.dayPlans.map((d) => (d.id === toDayPlanId ? { ...d, meals: sortMeals([...d.meals, cloneMeal(meal, id)]) } : d)),
  };
}

export function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort((a, b) => a.start - b.start);
}

/** Everything that matters to the patient, minus version/issue date. Used to see if anything changed. */
export function contentKey(plan: Plan): string {
  const { version: _v, issuedAt: _d, ...rest } = plan;
  return JSON.stringify(rest);
}

export interface IssuedStamp {
  id: string;
  version: number;
  key: string;
}

/**
 * Stamp a plan for issuing. Unchanged since the last issue → same version.
 * Edited → version + 1 with today's date. Never issued → stays as is (v1).
 */
export function stampForIssue(plan: Plan, last: IssuedStamp | undefined, today: DateStr): { plan: Plan; stamp: IssuedStamp } {
  const key = contentKey(plan);
  if (last && last.id === plan.id) {
    if (last.key === key) {
      const same = { ...plan, version: last.version };
      return { plan: same, stamp: last };
    }
    const bumped = { ...plan, version: last.version + 1, issuedAt: today };
    return { plan: bumped, stamp: { id: plan.id, version: bumped.version, key } };
  }
  const first = { ...plan, issuedAt: plan.version === 1 ? today : plan.issuedAt };
  return { plan: first, stamp: { id: plan.id, version: first.version, key: contentKey(first) } };
}

/** A reusable template: no id/version/dates. The patient name is never part of a plan to begin with. */
export type TemplatePlan = Omit<Plan, 'id' | 'version' | 'issuedAt' | 'startDate'>;

export function toTemplate(plan: Plan): TemplatePlan {
  const { id: _i, version: _v, issuedAt: _d, startDate: _s, ...rest } = structuredCloneSafe(plan);
  return rest;
}

export function fromTemplate(t: TemplatePlan, id: string, today: DateStr): Plan {
  return { ...structuredCloneSafe(t), id, version: 1, issuedAt: today, startDate: today, title: defaultPlanTitle(today) };
}
