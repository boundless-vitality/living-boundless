// Compact wire format: the readable Plan maps to short arrays/keys and small
// integers before compression. Changing this layout means bumping FORMAT in codec.ts.
import { defaultPlanTitle } from './describe';
import type {
  ComponentDetail, ComponentType, DayPlan, Meal, MealComponent, MealItem, MealTag, Plan, Schedule, Unit, WeekSpec, WeekdayMap,
} from './types';

const TYPES: ComponentType[] = ['protein', 'carb', 'fat', 'veggies'];
const DETAILS: (ComponentDetail | null)[] = [null, 'lean', 'fatty', 'lowGlycemic', 'highGlycemic', 'fruit'];
const UNITS: (Unit | null)[] = [null, 'oz', 'cup', 'tbsp', 'tsp', 'count', 'serving'];
const TAGS: (MealTag | null)[] = [null, 'preWorkout', 'postWorkout'];

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = any;

function trimTail(a: unknown[]): unknown[] {
  let n = a.length;
  while (n > 0 && (a[n - 1] == null || a[n - 1] === '')) n--;
  return a.slice(0, n);
}

const packDate = (d: string) => d.replace(/-/g, '');
const unpackDate = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
const packId = (id: string) => id.replace(/-/g, '').toLowerCase();
const unpackId = (h: string) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

function packComponent(c: MealComponent): W {
  return trimTail([
    TYPES.indexOf(c.type),
    c.detail ? DETAILS.indexOf(c.detail) : 0,
    c.amount ?? null,
    c.unit ? UNITS.indexOf(c.unit) : 0,
    c.examples ?? null,
  ]);
}

function unpackComponent(w: W): MealComponent {
  const c: MealComponent = { type: TYPES[w[0]] };
  if (!c.type) throw new Error('component type');
  if (w[1]) c.detail = DETAILS[w[1]] ?? undefined;
  if (w[2] != null) c.amount = Number(w[2]);
  if (w[3]) c.unit = UNITS[w[3]] ?? undefined;
  if (w[4]) c.examples = String(w[4]);
  return c;
}

function packItem(i: MealItem): W {
  return i.options.map((o) => trimTail([o.name, o.amount ?? null]));
}

function unpackItem(w: W): MealItem {
  return { options: (w as W[]).map((o) => (o[1] != null ? { name: String(o[0]), amount: String(o[1]) } : { name: String(o[0]) })) };
}

function packMeal(m: Meal): W {
  const o: W = { i: m.id, l: m.label, s: m.start, e: m.end };
  if (m.tag) o.g = TAGS.indexOf(m.tag);
  if (m.components.length) o.c = m.components.map(packComponent);
  if (m.items.length) o.m = m.items.map(packItem);
  if (m.note) o.n = m.note;
  return o;
}

function unpackMeal(w: W): Meal {
  const m: Meal = {
    id: Number(w.i),
    label: String(w.l ?? ''),
    start: Number(w.s),
    end: Number(w.e),
    components: ((w.c ?? []) as W[]).map(unpackComponent),
    items: ((w.m ?? []) as W[]).map(unpackItem),
  };
  if (w.g) m.tag = TAGS[w.g] ?? undefined;
  if (w.n) m.note = String(w.n);
  return m;
}

function packDayPlan(d: DayPlan): W {
  return [d.id, d.name, d.meals.map(packMeal)];
}

function unpackDayPlan(w: W): DayPlan {
  return { id: Number(w[0]), name: String(w[1]), meals: (w[2] as W[]).map(unpackMeal) };
}

function packSpec(s: WeekSpec | Schedule): W {
  if (s.kind === 'daily') return [0, s.dayPlanId];
  if (s.kind === 'weekday') return [1, s.map];
  return [2, s.weeks.map(packSpec)];
}

function unpackSpec(w: W, allowWeeks: boolean): Schedule {
  if (w[0] === 0) return { kind: 'daily', dayPlanId: Number(w[1]) };
  if (w[0] === 1) {
    if (!Array.isArray(w[1]) || w[1].length !== 7) throw new Error('weekday map');
    return { kind: 'weekday', map: w[1].map(Number) as WeekdayMap };
  }
  if (w[0] === 2 && allowWeeks) return { kind: 'weeks', weeks: (w[1] as W[]).map((x) => unpackSpec(x, false) as WeekSpec) };
  throw new Error('schedule');
}

export function toWire(p: Plan): W {
  const o: W = {
    i: packId(p.id),
    v: p.version,
    d: packDate(p.issuedAt),
    s: packDate(p.startDate),
    p: p.dayPlans.map(packDayPlan),
    c: packSpec(p.schedule),
    x: p.nextId,
  };
  // The default "<Month Year> plan" title is rebuilt from the issue date, so it costs nothing.
  if (p.title !== defaultPlanTitle(p.issuedAt)) o.t = p.title;
  if (p.supplements.length) o.u = p.supplements.map((s) => trimTail([s.name, s.dose ?? null, s.timing ?? null]));
  if (p.postWorkoutCarbs) {
    const w = p.postWorkoutCarbs;
    o.w = trimTail([w.grams, w.foods, w.note ?? null]);
  }
  if (p.notes) o.n = p.notes;
  const f = p.features;
  const bits = (f.water ? 1 : 0) | (f.alcohol ? 2 : 0) | (f.checkIn ? 4 : 0);
  if (bits) o.f = f.water && f.waterGoal ? [bits, f.waterGoal] : [bits];
  return o;
}

export function fromWire(w: W): Plan {
  if (!w || typeof w !== 'object' || typeof w.i !== 'string' || w.i.length !== 32) throw new Error('shape');
  const issuedAt = unpackDate(String(w.d));
  const bits = Array.isArray(w.f) ? Number(w.f[0]) : 0;
  const plan: Plan = {
    id: unpackId(w.i),
    version: Number(w.v),
    issuedAt,
    title: w.t != null ? String(w.t) : defaultPlanTitle(issuedAt),
    startDate: unpackDate(String(w.s)),
    dayPlans: (w.p as W[]).map(unpackDayPlan),
    schedule: unpackSpec(w.c, true),
    supplements: ((w.u ?? []) as W[]).map((s) => {
      const out: Plan['supplements'][number] = { name: String(s[0]) };
      if (s[1] != null) out.dose = String(s[1]);
      if (s[2] != null) out.timing = String(s[2]);
      return out;
    }),
    features: {
      water: !!(bits & 1),
      alcohol: !!(bits & 2),
      checkIn: !!(bits & 4),
    },
    nextId: Number(w.x),
  };
  if (bits & 1 && Array.isArray(w.f) && w.f[1] != null) plan.features.waterGoal = Number(w.f[1]);
  if (w.w) {
    plan.postWorkoutCarbs = { grams: Number(w.w[0]), foods: String(w.w[1] ?? '') };
    if (w.w[2] != null) plan.postWorkoutCarbs.note = String(w.w[2]);
  }
  if (w.n) plan.notes = String(w.n);
  return plan;
}
