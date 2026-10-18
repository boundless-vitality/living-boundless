// Synthetic sample plans. Made up for testing — never real patient data.
import type { DayPlan, Meal, MealComponent, MealItem, Plan, WeekdayMap } from './types';

const t = (h: number, m = 0) => h * 60 + m;

const P = (amount: number, examples?: string, detail: 'lean' | 'fatty' = 'lean'): MealComponent => ({ type: 'protein', detail, amount, unit: 'oz', examples });
const C = (amount: number, detail: 'lowGlycemic' | 'highGlycemic' | 'fruit', examples?: string, unit: MealComponent['unit'] = 'cup'): MealComponent => ({ type: 'carb', detail, amount, unit, examples });
const F = (amount: number, unit: MealComponent['unit'], examples?: string): MealComponent => ({ type: 'fat', amount, unit, examples });
const V = (examples?: string): MealComponent => ({ type: 'veggies', examples });
const one = (name: string, amount?: string): MealItem => ({ options: [{ name, amount }] });
const pick = (...opts: [string, string?][]): MealItem => ({ options: opts.map(([name, amount]) => ({ name, amount })) });

function meal(id: number, label: string, start: number, end: number, components: MealComponent[], extra: Partial<Meal> = {}): Meal {
  return { id, label, start, end, components, items: [], ...extra };
}

/** 1. A simple everyday plan: one day plan, no schedule complexity. */
export const simplePlan: Plan = {
  id: '3f1c2a9e-6b7d-4e21-9c55-1a2b3c4d5e6f',
  version: 1,
  issuedAt: '2026-11-02',
  title: 'November 2026 plan',
  startDate: '2026-11-03',
  dayPlans: [
    {
      id: 1,
      name: 'Daily Plan',
      meals: [
        meal(2, 'Breakfast', t(7), t(9), [P(4, 'egg whites, Greek yogurt'), C(0.5, 'fruit', 'berries'), F(1, 'tbsp', 'almond butter')]),
        meal(3, 'Snack 1', t(10, 30), t(11, 30), [], { items: [one('Chobani protein drink', '1')] }),
        meal(4, 'Lunch', t(12, 30), t(14), [P(6, 'chicken breast, white fish'), C(0.75, 'lowGlycemic', 'quinoa, brown rice'), V('mixed greens, cucumber')]),
        meal(5, 'Snack 2', t(15, 30), t(16, 30), [F(10, 'count', 'almonds')], { items: [pick(['apple', '1 small'], ['pear', '1 small'])] }),
        meal(6, 'Dinner', t(18, 30), t(20), [P(6, 'salmon, lean beef'), V('broccoli, asparagus'), F(1, 'tbsp', 'olive oil')], {
          note: 'Finish eating 2–3 hours before bed when you can.',
        }),
      ],
    },
  ],
  schedule: { kind: 'daily', dayPlanId: 1 },
  supplements: [{ name: 'Vitamin D3', dose: '5,000 IU', timing: 'with breakfast' }],
  notes: 'Drink water through the day. Season freely with herbs and spices.',
  features: { water: true, waterGoal: 8, alcohol: false, checkIn: false },
  nextId: 7,
};

const low: DayPlan = {
  id: 1,
  name: 'Low-Carb Day',
  meals: [
    meal(3, 'Breakfast', t(7), t(9), [P(5, 'whole eggs, egg whites'), F(0.5, 'count', 'avocado'), V('spinach, peppers')]),
    meal(4, 'Snack 1', t(10, 30), t(11, 30), [P(4, 'turkey roll-ups'), F(1, 'tbsp', 'cheese')]),
    meal(5, 'Lunch', t(12, 30), t(14), [P(6, 'chicken thighs, shrimp'), V('salad'), F(1, 'tbsp', 'olive oil')]),
    meal(6, 'Snack 2', t(15, 30), t(16, 30), [], { items: [pick(['protein shake', '1 scoop'], ['protein bar', '1'])] }),
    meal(7, 'Dinner', t(18, 30), t(20), [P(6, 'salmon, steak', 'fatty'), V('zucchini, cauliflower')]),
  ],
};
const high: DayPlan = {
  id: 2,
  name: 'High-Carb Day',
  meals: [
    meal(8, 'Breakfast', t(7), t(9), [P(4, 'egg whites'), C(0.75, 'lowGlycemic', 'oatmeal'), C(0.5, 'fruit', 'blueberries')]),
    meal(9, 'Snack 1', t(10, 30), t(11, 30), [P(4, 'Greek yogurt'), C(1, 'fruit', 'banana', 'count')]),
    meal(10, 'Lunch', t(12, 30), t(14), [P(6, 'chicken breast'), C(1, 'lowGlycemic', 'jasmine rice, sweet potato'), V()]),
    meal(11, 'Snack 2', t(15, 30), t(16, 30), [C(2, 'lowGlycemic', 'rice cakes', 'count'), F(1, 'tbsp', 'peanut butter')]),
    meal(12, 'Dinner', t(18, 30), t(20), [P(6, 'white fish, lean beef'), C(0.75, 'lowGlycemic', 'quinoa'), V('green beans')]),
  ],
};

/** 2. Weekday carb cycling: Mon/Tue low-carb, Wed–Sun high-carb. */
export const carbCyclingPlan: Plan = {
  id: '8a7b6c5d-4e3f-4a1b-8c9d-0e1f2a3b4c5d',
  version: 2,
  issuedAt: '2026-11-10',
  title: 'Carb cycling',
  startDate: '2026-11-03',
  dayPlans: [low, high],
  schedule: { kind: 'weekday', map: [1, 1, 2, 2, 2, 2, 2] },
  supplements: [
    { name: 'Magnesium glycinate', dose: '400 mg', timing: 'before bed' },
    { name: 'Omega-3', dose: '2 capsules', timing: 'with lunch' },
  ],
  notes: 'Low-carb days are your lighter days. Keep veggies generous.',
  features: { water: true, waterGoal: 10, alcohol: true, checkIn: true },
  nextId: 13,
};

function trainingDay(id: number, week: number, firstMealId: number): DayPlan {
  const extra = week * 0.25; // portions step up a little each week
  let m = firstMealId;
  return {
    id,
    name: `Week ${week + 1} Training Day`,
    meals: [
      meal(m++, 'Breakfast', t(6, 30), t(8), [P(5, 'egg whites, whole eggs'), C(0.75 + extra, 'lowGlycemic', 'oats, ezekiel bread'), C(0.5, 'fruit', 'berries')]),
      meal(m++, 'Snack 1', t(9, 30), t(10, 30), [P(4, 'Greek yogurt, cottage cheese'), F(1, 'tbsp', 'chia seeds')]),
      meal(m++, 'Pre-Workout', t(11, 30), t(12, 30), [P(4, 'chicken breast'), C(0.5 + extra, 'highGlycemic', 'white rice, rice cakes')], { tag: 'preWorkout' }),
      meal(m++, 'Post-Workout', t(14), t(15), [P(6, 'lean beef, chicken breast'), C(1 + extra, 'lowGlycemic', 'sweet potato, jasmine rice'), V('spinach, peppers')], {
        tag: 'postWorkout',
      }),
      meal(m++, 'Snack 2', t(16, 30), t(17, 30), [], { items: [pick(['protein shake', '1 scoop'], ['Chobani protein drink', '1'])] }),
      meal(m++, 'Dinner', t(19), t(20, 30), [P(6, 'salmon, cod'), C(0.5, 'lowGlycemic', 'quinoa'), V('broccoli, asparagus'), F(1, 'tbsp', 'olive oil')], {
        note: 'Bigger plate of veggies is always welcome.',
      }),
    ],
  };
}

function restDay(id: number, week: number, firstMealId: number): DayPlan {
  let m = firstMealId;
  return {
    id,
    name: `Week ${week + 1} Rest Day`,
    meals: [
      meal(m++, 'Breakfast', t(7), t(9), [P(5, 'whole eggs'), F(0.5, 'count', 'avocado'), V('spinach')]),
      meal(m++, 'Snack 1', t(10), t(11), [P(4, 'turkey roll-ups'), F(15, 'count', 'almonds')]),
      meal(m++, 'Lunch', t(12, 30), t(14), [P(6, 'shrimp, chicken thighs'), C(0.5, 'lowGlycemic', 'lentils, beans'), V('mixed greens')]),
      meal(m++, 'Snack 2', t(15, 30), t(16, 30), [C(1, 'fruit', 'apple', 'count'), F(1, 'tbsp', 'almond butter')]),
      meal(m++, 'Snack 3', t(17, 30), t(18), [], { items: [one('protein shake', '1 scoop')] }),
      meal(m++, 'Dinner', t(19), t(20, 30), [P(6, 'steak, salmon', 'fatty'), V('zucchini, green beans'), F(1, 'tbsp', 'butter, ghee')]),
    ],
  };
}

function buildFourWeek(): Plan {
  const dayPlans: DayPlan[] = [];
  const weeks: { kind: 'weekday'; map: WeekdayMap }[] = [];
  let id = 1;
  for (let w = 0; w < 4; w++) {
    const tr = trainingDay(id, w, id + 2);
    const rs = restDay(id + 1, w, id + 8);
    id += 14;
    dayPlans.push(tr, rs);
    // Mon/Tue/Thu/Fri training, Wed/Sat/Sun rest
    weeks.push({ kind: 'weekday', map: [tr.id, tr.id, rs.id, tr.id, tr.id, rs.id, rs.id] });
  }
  return {
    id: 'c0ffee00-1234-4abc-9def-56789abcdef0',
    version: 1,
    issuedAt: '2026-11-02',
    title: '4-week strength block',
    startDate: '2026-11-02',
    dayPlans,
    schedule: { kind: 'weeks', weeks },
    supplements: [
      { name: 'Creatine', dose: '5 g', timing: 'morning' },
      { name: 'Vitamin D3', dose: '5,000 IU', timing: 'with breakfast' },
      { name: 'Omega-3', dose: '2 capsules', timing: 'with lunch' },
      { name: 'Magnesium glycinate', dose: '400 mg', timing: 'before bed' },
      { name: 'Probiotic', dose: '1 capsule', timing: 'on an empty stomach' },
    ],
    postWorkoutCarbs: { grams: 30, foods: '4 dates or 1 orange', note: 'Within 30 minutes after strength training.' },
    notes: 'Training days are Mon, Tue, Thu, Fri. If your training days move, swap the day plans to match and tell Cristie at your next visit.',
    features: { water: true, waterGoal: 10, alcohol: true, checkIn: true },
    nextId: id,
  };
}

/** 3. A 4-week plan with weekday mappings, 6 meals/day, post-workout carbs and 5 supplements. */
export const fourWeekPlan: Plan = buildFourWeek();

export const SAMPLE_PLANS = { simplePlan, carbCyclingPlan, fourWeekPlan };
