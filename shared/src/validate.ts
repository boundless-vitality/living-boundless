// Checks a plan before it's issued (coach) and after it's decoded (app).
// Messages are written for the provider, since she's the one who can fix them.
import { isDateStr } from './dates';
import { DETAILS } from './describe';
import { usedDayPlanIds } from './schedule';
import type { Plan } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNITS = new Set(['oz', 'cup', 'tbsp', 'tsp', 'count', 'serving']);
const isInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

export function validatePlan(p: Plan): string[] {
  const errs: string[] = [];
  if (!UUID_RE.test(p.id)) errs.push('Plan id is missing or malformed.');
  if (!isInt(p.version) || p.version < 1) errs.push('Version must be 1 or more.');
  if (!isDateStr(p.issuedAt)) errs.push('Issue date is missing.');
  if (!isDateStr(p.startDate)) errs.push('Pick a start date.');
  if (!p.title?.trim()) errs.push('Give the plan a title.');
  if (!p.dayPlans.length) errs.push('Add at least one day plan.');

  const dayIds = new Set<number>();
  const mealIds = new Set<number>();
  let maxId = 0;
  for (const d of p.dayPlans) {
    const where = d.name?.trim() || 'Unnamed day plan';
    if (!isInt(d.id) || dayIds.has(d.id)) errs.push(`${where}: duplicate id.`);
    dayIds.add(d.id);
    maxId = Math.max(maxId, d.id);
    if (!d.name?.trim()) errs.push('Every day plan needs a name.');
    if (!d.meals.length) errs.push(`${where}: add at least one meal.`);
    for (const m of d.meals) {
      const at = `${where} → ${m.label?.trim() || 'Unnamed meal'}`;
      if (!isInt(m.id) || mealIds.has(m.id)) errs.push(`${at}: duplicate meal id.`);
      mealIds.add(m.id);
      maxId = Math.max(maxId, m.id);
      if (!m.label?.trim()) errs.push(`${where}: every meal needs a name.`);
      if (!isInt(m.start) || !isInt(m.end) || m.start < 0 || m.end > 1439) errs.push(`${at}: set a time window.`);
      else if (m.end <= m.start) errs.push(`${at}: the end time should be after the start time.`);
      if (!m.components.length && !m.items.length) errs.push(`${at}: add at least one component or item.`);
      for (const c of m.components) {
        if (c.detail && !DETAILS[c.type]?.some((x) => x.value === c.detail)) errs.push(`${at}: "${c.detail}" doesn't fit ${c.type}.`);
        if (c.amount != null) {
          if (!Number.isFinite(c.amount) || c.amount <= 0 || c.amount > 1000) errs.push(`${at}: amounts must be a positive number.`);
          if (!c.unit || !UNITS.has(c.unit)) errs.push(`${at}: pick a unit for the ${c.type} amount.`);
        } else if (c.type !== 'veggies') {
          errs.push(`${at}: type an amount for the ${c.type}.`);
        }
      }
      for (const it of m.items) {
        if (!it.options.length || it.options.some((o) => !o.name?.trim())) errs.push(`${at}: every item needs a food name.`);
      }
    }
  }

  const s = p.schedule;
  if (s.kind === 'weeks' && (!s.weeks.length || s.weeks.length > 52)) errs.push('Week-by-week schedules need 1–52 weeks.');
  for (const id of usedDayPlanIds(s)) {
    if (!dayIds.has(id)) errs.push('The schedule points to a day plan that no longer exists. Re-pick it in Schedule.');
  }

  for (const sup of p.supplements) if (!sup.name?.trim()) errs.push('Every supplement needs a name.');
  if (p.postWorkoutCarbs) {
    const w = p.postWorkoutCarbs;
    if (!Number.isFinite(w.grams) || w.grams <= 0) errs.push('Post-workout carbs: type the grams.');
    if (!w.foods?.trim()) errs.push('Post-workout carbs: add foods to hit it.');
  }
  if (p.features.water && p.features.waterGoal != null && (!isInt(p.features.waterGoal) || p.features.waterGoal < 8 || p.features.waterGoal > 400)) {
    errs.push('Water goal should be 8–400 oz (or leave it blank).');
  }
  if (!isInt(p.nextId) || p.nextId <= maxId) errs.push('Internal id counter is out of date.');
  return [...new Set(errs)];
}
