// Local meal reminders at the start of each meal window. No push server: the phone
// schedules them itself. iOS allows 64 pending reminders, so we schedule the next
// days' worth and refresh whenever the app opens or settings change.
import { addDays, formatWindow, planForDate, resolveDay, sortMeals, todayLocal, type PlanRecord } from '@lb/shared';
import * as Notifications from 'expo-notifications';

export interface ReminderSettings {
  enabled: boolean;
  /** Meal labels the patient turned off ("Snack 2"). */
  off: string[];
}

export const DEFAULT_REMINDERS: ReminderSettings = { enabled: false, off: [] };
const MAX = 60;
const DAYS_AHEAD = 10;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function askPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Every meal label used in the plan, in time order (for the per-meal switches). */
export function mealLabels(records: PlanRecord[]): string[] {
  const active = records.find((r) => !r.replacedOn);
  if (!active) return [];
  const seen = new Map<string, number>();
  for (const d of active.plan.dayPlans) for (const m of d.meals) if (!seen.has(m.label)) seen.set(m.label, m.start);
  return [...seen.entries()].sort((a, b) => a[1] - b[1]).map(([l]) => l);
}

export async function rescheduleReminders(records: PlanRecord[], settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled || !records.length) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  const now = Date.now();
  const today = todayLocal();
  let count = 0;
  for (let i = 0; i < DAYS_AHEAD && count < MAX; i++) {
    const date = addDays(today, i);
    const rec = planForDate(records, date);
    if (!rec) continue;
    const day = resolveDay(rec.plan, date);
    if (day.status !== 'active') continue;
    const [y, mo, d] = date.split('-').map(Number);
    for (const m of sortMeals(day.dayPlan.meals)) {
      if (settings.off.includes(m.label)) continue;
      const when = new Date(y, mo - 1, d, Math.floor(m.start / 60), m.start % 60, 0, 0);
      if (when.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: `${m.label} time`, body: `Your ${m.label.toLowerCase()} window is ${formatWindow(m.start, m.end)}.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
      if (++count >= MAX) break;
    }
  }
}
