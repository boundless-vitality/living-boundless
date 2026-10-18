import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatWindow, weekdayIndex } from '../src/dates';
import { carbCyclingPlan, fourWeekPlan, simplePlan } from '../src/fixtures';
import { describeSchedule, hasSchedule, resolveDay, weekdayRanges } from '../src/schedule';
import type { Plan } from '../src/types';

function active(plan: Plan, date: string) {
  const r = resolveDay(plan, date);
  if (r.status !== 'active') throw new Error(`expected active on ${date}`);
  return r;
}

describe('dates', () => {
  it('knows Monday-first weekdays', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0); // Monday
    expect(weekdayIndex('2026-11-08')).toBe(6); // Sunday
  });

  it('is not shifted by daylight saving (US clocks change Nov 1 2026)', () => {
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('crosses month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('formats time windows', () => {
    expect(formatWindow(450, 540)).toBe('7:30–9 am');
    expect(formatWindow(690, 780)).toBe('11:30 am–1 pm');
    expect(formatWindow(720, 810)).toBe('12–1:30 pm');
  });
});

describe('every day the same', () => {
  it('returns the single day plan on any date from the start', () => {
    expect(active(simplePlan, '2026-11-03').dayPlan.name).toBe('Daily Plan');
    expect(active(simplePlan, '2027-06-01').dayPlan.name).toBe('Daily Plan');
  });

  it('shows no schedule complexity', () => {
    expect(hasSchedule(simplePlan)).toBe(false);
  });

  it('says when the plan starts if opened early', () => {
    const r = resolveDay(simplePlan, '2026-11-01');
    expect(r).toMatchObject({ status: 'beforeStart', startsOn: '2026-11-03' });
    if (r.status === 'beforeStart') expect(r.firstDay?.name).toBe('Daily Plan');
  });
});

describe('by weekday', () => {
  it('maps Mon/Tue to low-carb and Wed–Sun to high-carb', () => {
    const names = Array.from({ length: 7 }, (_, i) => active(carbCyclingPlan, addDays('2026-11-09', i)).dayPlan.name);
    expect(names).toEqual(['Low-Carb Day', 'Low-Carb Day', 'High-Carb Day', 'High-Carb Day', 'High-Carb Day', 'High-Carb Day', 'High-Carb Day']);
  });

  it('describes itself in plain words', () => {
    expect(describeSchedule(carbCyclingPlan)).toEqual(['Low-Carb Day: Mon, Tue · High-Carb Day: Wed–Sun']);
    expect(hasSchedule(carbCyclingPlan)).toBe(true);
  });
});

describe('by week', () => {
  // fourWeekPlan starts Monday 2026-11-02.
  it('starts week 1 on the start date', () => {
    const r = active(fourWeekPlan, '2026-11-02');
    expect(r.week).toBe(0);
    expect(r.dayPlan.name).toBe('Week 1 Training Day');
    expect(active(fourWeekPlan, '2026-11-04').dayPlan.name).toBe('Week 1 Rest Day');
  });

  it('rolls over to week 2 exactly 7 days later', () => {
    expect(active(fourWeekPlan, '2026-11-08').week).toBe(0); // day 6
    const r = active(fourWeekPlan, '2026-11-09'); // day 7
    expect(r.week).toBe(1);
    expect(r.dayPlan.name).toBe('Week 2 Training Day');
  });

  it('advances weeks even when the start date is mid-week', () => {
    const p: Plan = { ...fourWeekPlan, startDate: '2026-11-05' }; // Thursday
    expect(active(p, '2026-11-11').week).toBe(0); // Wed, day 6
    expect(active(p, '2026-11-12').week).toBe(1); // Thu, day 7
    // weekday mapping still follows the calendar weekday
    expect(active(p, '2026-11-14').dayPlan.name).toBe('Week 2 Rest Day'); // Saturday
  });

  it('stays on the last week after the plan runs out, with a check-in flag', () => {
    const lastDay = active(fourWeekPlan, '2026-11-29'); // day 27
    expect(lastDay.week).toBe(3);
    expect(lastDay.pastLastWeek).toBe(false);
    const after = active(fourWeekPlan, '2026-11-30'); // day 28
    expect(after.week).toBe(3);
    expect(after.pastLastWeek).toBe(true);
    expect(after.dayPlan.name).toBe('Week 4 Training Day');
    expect(active(fourWeekPlan, '2027-03-01').pastLastWeek).toBe(true);
  });

  it('supports a week that is one day plan every day', () => {
    const p: Plan = {
      ...fourWeekPlan,
      schedule: { kind: 'weeks', weeks: [{ kind: 'daily', dayPlanId: 1 }, { kind: 'daily', dayPlanId: 2 }] },
    };
    expect(active(p, '2026-11-05').dayPlan.id).toBe(1);
    expect(active(p, '2026-11-12').dayPlan.id).toBe(2);
    expect(active(p, '2026-12-25')).toMatchObject({ pastLastWeek: true });
  });

  it('describes each week with its dates', () => {
    const lines = describeSchedule(fourWeekPlan);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('Week 1 (Nov 2–8): Week 1 Training Day: Mon, Tue, Thu, Fri · Week 1 Rest Day: Wed, Sat, Sun');
    expect(lines[3]).toContain('Week 4 (Nov 23–29, then ongoing)');
  });
});

describe('weekdayRanges', () => {
  it('collapses runs of 3+ days', () => {
    expect(weekdayRanges([0, 1, 2, 3])).toBe('Mon–Thu');
    expect(weekdayRanges([0, 2])).toBe('Mon, Wed');
    expect(weekdayRanges([5, 6])).toBe('Sat, Sun');
    expect(weekdayRanges([0, 1, 2, 3, 4, 5, 6])).toBe('every day');
  });
});
