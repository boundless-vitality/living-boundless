// Human wording for plan pieces, shared by the coach page, PDF and app.
// Portions only: no calories or macros anywhere.
import type { ComponentDetail, ComponentType, ItemOption, MealComponent, MealItem, MealTag, Plan, Unit } from './types';
import { formatMedium, formatMonthYear } from './dates';

export const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: 'protein', label: 'Protein' },
  { value: 'carb', label: 'Carb' },
  { value: 'fat', label: 'Fat' },
  { value: 'veggies', label: 'Veggies' },
];

export const DETAILS: Record<ComponentType, { value: ComponentDetail; label: string }[]> = {
  protein: [
    { value: 'lean', label: 'Lean' },
    { value: 'fatty', label: 'Fatty' },
  ],
  carb: [
    { value: 'lowGlycemic', label: 'Low glycemic' },
    { value: 'highGlycemic', label: 'High glycemic (fast-absorbing)' },
    { value: 'fruit', label: 'Fruit' },
  ],
  fat: [],
  veggies: [],
};

export const UNITS: Unit[] = ['oz', 'cup', 'tbsp', 'tsp', 'count', 'serving'];

/** Default unit when the provider picks a component type (her conventions). */
export const DEFAULT_UNIT: Record<ComponentType, Unit> = {
  protein: 'oz',
  carb: 'cup',
  fat: 'tbsp',
  veggies: 'cup',
};

export const TAG_LABEL: Record<MealTag, string> = {
  preWorkout: 'pre-workout',
  postWorkout: 'post-workout',
};

export function componentLabel(c: Pick<MealComponent, 'type' | 'detail'>): string {
  switch (c.type) {
    case 'protein':
      return c.detail === 'fatty' ? 'fatty protein' : c.detail === 'lean' ? 'lean protein' : 'protein';
    case 'carb':
      if (c.detail === 'fruit') return 'fruit';
      if (c.detail === 'highGlycemic') return 'high glycemic carb';
      if (c.detail === 'lowGlycemic') return 'low glycemic carb';
      return 'carb';
    case 'fat':
      return 'healthy fat';
    case 'veggies':
      return 'veggies';
  }
}

const FRACTIONS: [number, string][] = [
  [0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔'],
];

/** 0.5 → "½", 1.5 → "1½", 6 → "6", 2.2 → "2.2" */
export function formatAmount(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.001) return String(whole);
  for (const [v, s] of FRACTIONS) {
    if (Math.abs(frac - v) < 0.01) return whole === 0 ? s : `${whole}${s}`;
  }
  return String(Math.round(n * 100) / 100);
}

function unitText(unit: Unit, amount: number): string {
  if (unit === 'cup') return amount > 1 ? 'cups' : 'cup';
  if (unit === 'serving') return amount > 1 ? 'servings' : 'serving';
  return unit;
}

export interface ComponentText {
  /** "6 oz lean protein", "10 almonds", "veggies" */
  main: string;
  /** "as much as you like", "fat", "e.g. chicken, turkey" */
  sub?: string;
}

export function describeComponent(c: MealComponent): ComponentText {
  const label = componentLabel(c);
  const examples = c.examples?.trim();
  if (c.amount == null || !c.unit) {
    if (c.type === 'veggies') return { main: 'veggies', sub: examples ? `as much as you like · e.g. ${examples}` : 'as much as you like' };
    return { main: label, sub: examples ? `e.g. ${examples}` : undefined };
  }
  const amt = formatAmount(c.amount);
  if (c.unit === 'count') {
    if (examples) return { main: `${amt} ${examples}`, sub: label };
    return { main: `${amt} ${label}` };
  }
  return { main: `${amt} ${unitText(c.unit, c.amount)} ${label}`, sub: examples ? `e.g. ${examples}` : undefined };
}

export function describeOption(o: ItemOption): string {
  const amt = o.amount?.trim();
  return amt ? `${o.name.trim()}, ${amt}` : o.name.trim();
}

/** "Chobani protein drink, 1" or "Pick one: 4 dates · 1 orange" */
export function describeItem(item: MealItem): string {
  if (item.options.length === 1) return describeOption(item.options[0]);
  return `Pick one: ${item.options.map(describeOption).join(' · ')}`;
}

export function isPickOne(item: MealItem): boolean {
  return item.options.length > 1;
}

/** "November 2026 plan" */
export function defaultPlanTitle(issuedOrStart: string): string {
  return `${formatMonthYear(issuedOrStart)} plan`;
}

/** For patients: "updated Nov 12, 2026" on v2+, otherwise "prescribed Nov 3, 2026". */
export function planIssuedLine(plan: Pick<Plan, 'version' | 'issuedAt'>): string {
  return plan.version > 1 ? `updated ${formatMedium(plan.issuedAt)}` : `prescribed ${formatMedium(plan.issuedAt)}`;
}

/** Short code shown on the PDF and in the app so staff can match a phone to a chart: "BV-7K2Q". */
export function planCode(id: string): string {
  // FNV-1a over the uuid, rendered in an unambiguous alphabet (no 0/O/1/I).
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[h & 31];
    h >>>= 5;
  }
  return `BV-${out}`;
}
