import { describe, expect, it } from 'vitest';
import { addDays } from '../src/dates';
import { carbCyclingPlan } from '../src/fixtures';
import type { PlanRecord } from '../src/importing';
import { buildReport } from '../src/report';
import { currentStreak, loggedDays, weekSummary, weekMessage, type DayEntry, type MealLogData } from '../src/tracking';

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
    entries: [{ date: '2026-11-11', water: 6, alcohol: { drank: true, drinks: { wine: 2 } }, checkIn: { energy: 3, mood: 4, tags: ['bloated'], note: 'Long day' } }],
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

  it('includes water, alcohol and the check-in', () => {
    const wed = report.days[3];
    expect(wed.lines).toEqual([
      { label: 'Water', value: '6 glasses' },
      { label: 'Alcohol', value: '2 wine' },
      { label: 'Check-in', value: 'energy 3/5 · mood 4/5 · bloated' },
      { label: 'Note', value: '“Long day”' },
    ]);
  });
});
