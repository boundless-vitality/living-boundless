import { describe, expect, it } from 'vitest';
import { addDays } from '../src/dates';
import { carbCyclingPlan } from '../src/fixtures';
import type { PlanRecord } from '../src/importing';
import { buildReport } from '../src/report';
import { currentStreak, dayLevels, loggedDays, waterToGo, waterTotal, weekSummary, weekMessage, type DayEntry, type MealLogData } from '../src/tracking';

const today = '2026-11-12'; // Thursday

describe('streak and weekly view', () => {
  it('counts consecutive logged days ending today or yesterday', () => {
    const days = new Set([today, addDays(today, -1), addDays(today, -2), addDays(today, -4)]);
    expect(currentStreak(days, today)).toBe(3);
    // Today not logged yet: the streak from yesterday still stands.
    expect(currentStreak(new Set([addDays(today, -1), addDays(today, -2)]), today)).toBe(2);
    expect(currentStreak(new Set([addDays(today, -3)]), today)).toBe(0);
  });

  it('counts days logged this week out of days so far', () => {
    const days = new Set(['2026-11-09', '2026-11-11', '2026-11-12']);
    expect(weekSummary(days, today)).toMatchObject({ logged: 3, elapsed: 4, monday: '2026-11-09' });
    expect(weekSummary(days, today, '2026-11-11')).toMatchObject({ logged: 2, elapsed: 2 });
  });

  it('only uses encouraging wording', () => {
    expect(weekMessage(5, 7)).toBe('5 of 7 days logged this week. Nice work showing up.');
    expect(weekMessage(0, 3)).not.toMatch(/miss|fail|behind/i);
  });

  it('a check-in alone counts as showing up', () => {
    const entries: DayEntry[] = [{ date: today, checkIn: { mood: 4, tags: [] } }, { date: addDays(today, -1), checkIn: { tags: [] } }];
    expect([...loggedDays([], entries)]).toEqual([today]);
  });
});

describe('water', () => {
  it('keeps earlier amounts when the unit changes mid-day', () => {
    // Two 8 oz glasses, then switch to a 16 oz bottle: 8 + 8 + 16, not 16 + 16 + 16.
    const e: DayEntry = { date: today, waterOz: [8, 8, 16] };
    expect(waterTotal(e)).toBe(32);
  });

  it('says how many of the current unit are left, with or without a goal', () => {
    expect(waterToGo(32, 64, { label: 'Bottle', oz: 16 })).toBe('About 2 more bottles (16 oz) to reach 64 oz');
    expect(waterToGo(60, 64, { label: 'Glass', oz: 8 })).toBe('About 1 more glass (8 oz) to reach 64 oz');
    expect(waterToGo(70, 64, { label: 'Glass', oz: 8 })).toBeUndefined();
    expect(waterToGo(10, undefined, { label: 'Glass', oz: 8 })).toBeUndefined();
  });
});

describe('report', () => {
  const records: PlanRecord[] = [{ plan: carbCyclingPlan, activatedOn: '2026-11-03', activatedAt: '2026-11-03T10:00:00Z' }];
  const log = (date: string, mealId: number, status: MealLogData['status'], extra: Partial<MealLogData> = {}): MealLogData => ({
    date, planId: carbCyclingPlan.id, mealId, planVersion: 2, mealLabel: 'x', status, whenKind: 'time', eatenAt: '08:10', loggedAt: date, ...extra,
  });

  const report = buildReport({
    records,
    logs: [
      log('2026-11-09', 3, 'followed'),
      log('2026-11-09', 4, 'substituted', { note: '4 turkey roll-ups' }),
      log('2026-11-09', 6, 'followed', { choices: { 0: 1 } }),
      log('2026-11-11', 8, 'skipped'),
    ],
    entries: [{ date: '2026-11-11', waterOz: [8, 8, 16.9], alcohol: { drank: true, drinks: { wine: 2 } }, checkIn: { energy: 3, mood: 4, tags: ['bloated'], note: 'Long day' } }],
    from: '2026-11-08',
    to: '2026-11-11',
    patientName: 'Alex',
    planCodeOf: () => 'BV-TEST',
  });

  it('shows every day in the range, saying plainly when nothing was logged', () => {
    expect(report.days.map((d) => d.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
    expect(report.days[0].empty).toBe(true);
    expect(report.days[2].empty).toBe(true);
    expect(report.summary).toMatchObject({ days: 4, daysLogged: 2, followed: 2, substituted: 1, skipped: 1 });
  });

  it('includes statuses, times, substitution notes and pick-one choices', () => {
    const mon = report.days[1];
    expect(mon.dayPlanName).toBe('Low-Carb Day');
    expect(mon.meals[0]).toEqual({ label: 'Breakfast', status: 'Followed', detail: '8:10 am' });
    expect(mon.meals[1].detail).toContain('4 turkey roll-ups');
    expect(mon.meals[3]).toMatchObject({ label: 'Snack 2', status: 'Followed', detail: '8:10 am · had protein bar' });
    expect(mon.meals[2].status).toBe('Not logged');
  });

  it('totals water, alcohol and check-ins across the range', () => {
    expect(report.extras).toEqual([
      { label: 'Water', value: 'logged 1 day · average 32.9 oz on those days' },
      { label: 'Alcohol', value: '1 day with drinks (2 total) · 0 days with none' },
      { label: 'Check-ins', value: '1 day · average energy 3/5 · average mood 4/5' },
    ]);
  });

  it('includes water, alcohol and the check-in', () => {
    const wed = report.days[3];
    expect(wed.lines).toEqual([
      { label: 'Water', value: '32.9 oz' },
      { label: 'Alcohol', value: '2 wine' },
      { label: 'Check-in', value: 'energy 3/5 · mood 4/5 · bloated' },
      { label: 'Note', value: '“Long day”' },
    ]);
  });
});

describe('water wording', () => {
  it('pluralizes glass correctly', () => {
    expect(waterToGo(0, 64, { label: 'Glass', oz: 8 })).toBe('About 8 more glasses (8 oz) to reach 64 oz');
  });
});

describe('dayLevels (week dots)', () => {
  it('is full when every meal is logged and partial otherwise', () => {
    const records: PlanRecord[] = [{ plan: carbCyclingPlan, activatedOn: '2026-11-03', activatedAt: '2026-11-03T10:00:00Z' }];
    const id = carbCyclingPlan.id;
    const mon = [3, 4, 5, 6, 7].map((mealId) => ({ date: '2026-11-09', planId: id, mealId }));
    const tue = [{ date: '2026-11-10', planId: id, mealId: 3 }];
    const levels = dayLevels(records, [...mon, ...tue], [{ date: '2026-11-11', waterOz: [8] }]);
    expect(levels.get('2026-11-09')).toBe('full');
    expect(levels.get('2026-11-10')).toBe('partial');
    expect(levels.get('2026-11-11')).toBe('partial');
    expect(levels.get('2026-11-12')).toBeUndefined();
  });
});
