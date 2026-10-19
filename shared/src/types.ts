// The plan as the provider prescribes it. Patients can't edit any of this.
// The patient's name is intentionally NOT part of a plan: it never travels in a link.

/** Calendar date, local, 'YYYY-MM-DD'. */
export type DateStr = string;

/** Minutes after midnight, 0–1439. */
export type Minutes = number;

export type ComponentType = 'protein' | 'carb' | 'fat' | 'veggies';
export type ProteinDetail = 'lean' | 'fatty';
export type CarbDetail = 'lowGlycemic' | 'highGlycemic' | 'fruit';
export type ComponentDetail = ProteinDetail | CarbDetail;
export type Unit = 'oz' | 'cup' | 'tbsp' | 'tsp' | 'count' | 'serving';
export type MealTag = 'preWorkout' | 'postWorkout';

export interface MealComponent {
  type: ComponentType;
  /** protein: lean | fatty. carb: lowGlycemic | highGlycemic | fruit. */
  detail?: ComponentDetail;
  /** Typed number. Optional for veggies (free food). */
  amount?: number;
  unit?: Unit;
  /** Example foods, free text ("chicken, turkey, white fish"). */
  examples?: string;
}

export interface ItemOption {
  name: string;
  /** Free text amount ("1", "1 bottle", "4"). */
  amount?: string;
}

/** A specific food (one option) or a short list to pick one from (2+ options). */
export interface MealItem {
  options: ItemOption[];
}

export interface Meal {
  /** Stable within a plan across versions, so logs keep matching after edits. */
  id: number;
  label: string;
  start: Minutes;
  end: Minutes;
  tag?: MealTag;
  components: MealComponent[];
  items: MealItem[];
  note?: string;
}

export interface DayPlan {
  id: number;
  name: string;
  meals: Meal[];
}

export interface Supplement {
  name: string;
  dose?: string;
  timing?: string;
}

export interface PostWorkoutCarbs {
  grams: number;
  /** "4 dates or 1 orange" */
  foods: string;
  note?: string;
}

/** Monday-first: index 0 = Mon … 6 = Sun. Each entry is a dayPlan id. */
export type WeekdayMap = [number, number, number, number, number, number, number];

export type WeekSpec =
  | { kind: 'daily'; dayPlanId: number }
  | { kind: 'weekday'; map: WeekdayMap };

export type Schedule =
  | { kind: 'daily'; dayPlanId: number }
  | { kind: 'weekday'; map: WeekdayMap }
  | { kind: 'weeks'; weeks: WeekSpec[] };

export interface Features {
  water: boolean;
  /** Optional daily goal in fluid ounces. Patients log in whatever unit they like. */
  waterGoal?: number;
  alcohol: boolean;
  checkIn: boolean;
}

export interface Plan {
  /** uuid */
  id: string;
  /** 1 for a new plan; +1 each time an edited plan is issued. */
  version: number;
  issuedAt: DateStr;
  title: string;
  startDate: DateStr;
  dayPlans: DayPlan[];
  schedule: Schedule;
  supplements: Supplement[];
  postWorkoutCarbs?: PostWorkoutCarbs;
  notes?: string;
  features: Features;
  /** Next id to hand out for day plans/meals. Keeps ids unique across versions. */
  nextId: number;
}

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
