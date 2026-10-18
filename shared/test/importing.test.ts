import { describe, expect, it } from 'vitest';
import { contentKey, copyMealTo, duplicateDayPlan, duplicateMeal, fromTemplate, newPlan, stampForIssue, toTemplate } from '../src/builders';
import { carbCyclingPlan, simplePlan } from '../src/fixtures';
import { activeRangeText, decideImport, earliestDate, planForDate, type PlanRecord } from '../src/importing';
import { validatePlan } from '../src/validate';

describe('decideImport (version handling)', () => {
  const active = { id: 'a', version: 3 };
  it('first plan becomes active', () => expect(decideImport(null, active).kind).toBe('first'));
  it('higher version of the same plan replaces it', () => expect(decideImport(active, { id: 'a', version: 4 }).kind).toBe('update'));
  it('same version is a no-op', () => expect(decideImport(active, { id: 'a', version: 3 }).kind).toBe('same'));
  it('older version is refused', () => expect(decideImport(active, { id: 'a', version: 2 })).toEqual({ kind: 'older', activeVersion: 3 }));
  it('a different plan id replaces it regardless of version', () => {
    expect(decideImport(active, { id: 'b', version: 1 }).kind).toBe('newPlan');
  });
});

describe('planForDate', () => {
  const rec = (activatedOn: string, replacedOn?: string, startDate = '2026-11-03'): PlanRecord => ({
    plan: { ...simplePlan, startDate },
    activatedOn,
    replacedOn,
    activatedAt: `${activatedOn}T10:00:00.000Z`,
  });
  const v1 = rec('2026-11-05', '2026-11-20');
  const v2 = rec('2026-11-20');

  it('uses the plan active on that date', () => {
    expect(planForDate([v1, v2], '2026-11-10')).toBe(v1);
    expect(planForDate([v1, v2], '2026-11-20')).toBe(v2);
    expect(planForDate([v2, v1], '2026-12-01')).toBe(v2);
  });

  it('lets patients log days between the start date and the day they added it', () => {
    expect(planForDate([v1, v2], '2026-11-03')).toBe(v1);
    expect(earliestDate([v1, v2])).toBe('2026-11-03');
  });

  it('describes when a previous plan was active', () => {
    expect(activeRangeText(v1)).toBe('Active Nov 5–20, 2026');
    expect(activeRangeText(v2)).toBe('Active since Nov 20, 2026');
  });
});

describe('coach editing helpers', () => {
  it('duplicates a day plan with fresh meal ids', () => {
    const p = duplicateDayPlan(carbCyclingPlan, 1);
    expect(p.dayPlans).toHaveLength(3);
    expect(p.dayPlans[1].name).toBe('Low-Carb Day (copy)');
    expect(validatePlan(p)).toEqual([]);
  });

  it('duplicates a meal and copies a meal to another day plan', () => {
    let p = duplicateMeal(carbCyclingPlan, 1, 3);
    expect(p.dayPlans[0].meals).toHaveLength(6);
    p = copyMealTo(p, 1, 4, 2);
    expect(p.dayPlans[1].meals).toHaveLength(6);
    expect(validatePlan(p)).toEqual([]);
  });

  it('new plans start at v1 with a month title', () => {
    const p = newPlan('11111111-2222-4333-8444-555555555555', '2026-11-03');
    expect(p.version).toBe(1);
    expect(p.title).toBe('November 2026 plan');
  });
});

describe('stampForIssue (versions only go up when the plan changed)', () => {
  const today = '2026-11-15';
  it('keeps v1 for a brand-new plan', () => {
    const { plan } = stampForIssue(simplePlan, undefined, today);
    expect(plan.version).toBe(1);
  });

  it('does not bump when nothing changed', () => {
    const first = stampForIssue(simplePlan, undefined, today);
    const again = stampForIssue(first.plan, first.stamp, today);
    expect(again.plan.version).toBe(1);
  });

  it('bumps to v2 after an edit, keeping the same plan id', () => {
    const first = stampForIssue(simplePlan, undefined, '2026-11-02');
    const edited = { ...first.plan, notes: 'Updated notes' };
    const next = stampForIssue(edited, first.stamp, today);
    expect(next.plan.version).toBe(2);
    expect(next.plan.id).toBe(simplePlan.id);
    expect(next.plan.issuedAt).toBe(today);
  });

  it('a reopened v2 link becomes v3 when edited', () => {
    const reopened = { ...carbCyclingPlan };
    const stamp = { id: reopened.id, version: 2, key: contentKey(reopened) };
    const next = stampForIssue({ ...reopened, title: 'Carb cycling, round 2' }, stamp, today);
    expect(next.plan.version).toBe(3);
  });
});

describe('templates', () => {
  it('strips plan id, version and dates', () => {
    const t = toTemplate(carbCyclingPlan);
    expect(t).not.toHaveProperty('id');
    expect(t).not.toHaveProperty('version');
    expect(t).not.toHaveProperty('startDate');
    const p = fromTemplate(t, '99999999-2222-4333-8444-555555555555', '2026-12-01');
    expect(p.version).toBe(1);
    expect(p.title).toBe('December 2026 plan');
    expect(validatePlan(p)).toEqual([]);
  });
});
