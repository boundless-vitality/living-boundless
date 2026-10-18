// What happens when a patient adds a plan, and which plan applied on a past date.
import { formatMedium, formatRange } from './dates';
import type { DateStr, Plan } from './types';

export type ImportDecision =
  /** No plan yet: becomes active. */
  | { kind: 'first' }
  /** Same plan, newer version: replaces active; old version moves to Previous plans. */
  | { kind: 'update' }
  /** A different plan: replaces active; old one moves to Previous plans. */
  | { kind: 'newPlan' }
  /** Exactly the plan already active. Nothing to do. */
  | { kind: 'same' }
  /** An older version of the active plan. Not imported. */
  | { kind: 'older'; activeVersion: number };

export function decideImport(active: Pick<Plan, 'id' | 'version'> | null | undefined, incoming: Pick<Plan, 'id' | 'version'>): ImportDecision {
  if (!active) return { kind: 'first' };
  if (active.id !== incoming.id) return { kind: 'newPlan' };
  if (incoming.version > active.version) return { kind: 'update' };
  if (incoming.version === active.version) return { kind: 'same' };
  return { kind: 'older', activeVersion: active.version };
}

/** Friendly copy for each outcome, shown right after scanning/pasting. */
export function importMessage(d: ImportDecision): { title: string; body: string } {
  switch (d.kind) {
    case 'first':
      return { title: 'your plan is ready', body: "You're all set. Here's today." };
    case 'update':
      return { title: 'plan updated', body: 'Your plan has been updated. Your earlier version is saved under Previous plans.' };
    case 'newPlan':
      return { title: 'new plan added', body: 'Your new plan is active. Your last plan is saved under Previous plans.' };
    case 'same':
      return { title: 'already up to date', body: 'You already have this plan. Nothing changed.' };
    case 'older':
      return {
        title: 'you have a newer version',
        body: "This link is for an earlier version of your plan, so we kept the one you have. If that seems off, check in with your provider.",
      };
  }
}

/** One stored plan version on the phone, with the dates it was active. */
export interface PlanRecord {
  plan: Plan;
  /** Local date the patient added it. */
  activatedOn: DateStr;
  /** Local date it was replaced. Undefined = the active plan. */
  replacedOn?: DateStr;
  /** Sort key (ISO timestamp) so two imports on the same day keep their order. */
  activatedAt: string;
}

/**
 * The plan that applied on a date: the last one added on or before that date.
 * Dates before the first import fall to the first plan (so patients can log
 * days between the plan's start date and the day they added it).
 */
export function planForDate(records: PlanRecord[], date: DateStr): PlanRecord | undefined {
  if (!records.length) return undefined;
  const sorted = [...records].sort((a, b) => a.activatedAt.localeCompare(b.activatedAt));
  let found = sorted[0];
  for (const r of sorted) if (r.activatedOn <= date) found = r;
  return found;
}

/** Earliest date a patient can go back to. */
export function earliestDate(records: PlanRecord[]): DateStr | undefined {
  if (!records.length) return undefined;
  const sorted = [...records].sort((a, b) => a.activatedAt.localeCompare(b.activatedAt));
  const first = sorted[0];
  return first.plan.startDate < first.activatedOn ? first.plan.startDate : first.activatedOn;
}

/** "Active Oct 3 – Nov 2, 2026" */
export function activeRangeText(r: PlanRecord): string {
  if (!r.replacedOn) return `Active since ${formatMedium(r.activatedOn)}`;
  if (r.replacedOn === r.activatedOn) return `Active ${formatMedium(r.activatedOn)}`;
  return `Active ${formatRange(r.activatedOn, r.replacedOn)}, ${r.replacedOn.slice(0, 4)}`;
}
