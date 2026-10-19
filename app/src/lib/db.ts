// On-device storage (SQLite). Nothing here ever leaves the phone.
import type { DateStr, Plan, PlanRecord } from '@lb/shared';
import type { SQLiteDatabase } from 'expo-sqlite';

export const DB_NAME = 'living-boundless.db';

export type MealStatus = 'followed' | 'substituted' | 'skipped';
/** now = "just now", earlier = "earlier today" (no exact time), time = picked, planned = around the planned time. */
export type WhenKind = 'now' | 'earlier' | 'time' | 'planned';

export interface MealLog {
  date: DateStr;
  planId: string;
  mealId: number;
  planVersion: number;
  mealLabel: string;
  status: MealStatus;
  note?: string;
  /** pick-one item index → option index chosen */
  choices?: Record<number, number>;
  whenKind: WhenKind;
  /** 'HH:MM' local, when known */
  eatenAt?: string;
  loggedAt: string;
}

export interface StoredPlan extends PlanRecord {
  rowId: number;
}

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  if (v < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS plans (
        row_id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        json TEXT NOT NULL,
        activated_on TEXT NOT NULL,
        activated_at TEXT NOT NULL,
        replaced_on TEXT
      );
      CREATE TABLE IF NOT EXISTS meal_logs (
        date TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        meal_id INTEGER NOT NULL,
        plan_version INTEGER NOT NULL,
        meal_label TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        choices TEXT,
        when_kind TEXT NOT NULL,
        eaten_at TEXT,
        logged_at TEXT NOT NULL,
        PRIMARY KEY (date, plan_id, meal_id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);
      PRAGMA user_version = 1;
    `);
    v = 1;
  }
}

interface PlanRow {
  row_id: number;
  json: string;
  activated_on: string;
  activated_at: string;
  replaced_on: string | null;
}

export async function loadPlans(db: SQLiteDatabase): Promise<StoredPlan[]> {
  const rows = await db.getAllAsync<PlanRow>('SELECT row_id, json, activated_on, activated_at, replaced_on FROM plans ORDER BY activated_at');
  return rows.map((r) => ({
    rowId: r.row_id,
    plan: JSON.parse(r.json) as Plan,
    activatedOn: r.activated_on,
    activatedAt: r.activated_at,
    replacedOn: r.replaced_on ?? undefined,
  }));
}

/** Makes `plan` active. The current active plan (if any) moves to Previous plans. Never deletes. */
export async function activatePlan(db: SQLiteDatabase, plan: Plan, today: DateStr): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE plans SET replaced_on = ? WHERE replaced_on IS NULL', today);
    await db.runAsync(
      'INSERT INTO plans (plan_id, version, json, activated_on, activated_at) VALUES (?, ?, ?, ?, ?)',
      plan.id,
      plan.version,
      JSON.stringify(plan),
      today,
      new Date().toISOString(),
    );
  });
}

interface LogRow {
  date: string;
  plan_id: string;
  meal_id: number;
  plan_version: number;
  meal_label: string;
  status: MealStatus;
  note: string | null;
  choices: string | null;
  when_kind: WhenKind;
  eaten_at: string | null;
  logged_at: string;
}

const fromRow = (r: LogRow): MealLog => ({
  date: r.date,
  planId: r.plan_id,
  mealId: r.meal_id,
  planVersion: r.plan_version,
  mealLabel: r.meal_label,
  status: r.status,
  note: r.note ?? undefined,
  choices: r.choices ? JSON.parse(r.choices) : undefined,
  whenKind: r.when_kind,
  eatenAt: r.eaten_at ?? undefined,
  loggedAt: r.logged_at,
});

export async function logsForDate(db: SQLiteDatabase, date: DateStr): Promise<MealLog[]> {
  const rows = await db.getAllAsync<LogRow>('SELECT * FROM meal_logs WHERE date = ?', date);
  return rows.map(fromRow);
}

export async function saveLog(db: SQLiteDatabase, log: MealLog): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO meal_logs
      (date, plan_id, meal_id, plan_version, meal_label, status, note, choices, when_kind, eaten_at, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    log.date,
    log.planId,
    log.mealId,
    log.planVersion,
    log.mealLabel,
    log.status,
    log.note ?? null,
    log.choices ? JSON.stringify(log.choices) : null,
    log.whenKind,
    log.eatenAt ?? null,
    log.loggedAt,
  );
}

export async function deleteLog(db: SQLiteDatabase, date: DateStr, planId: string, mealId: number): Promise<void> {
  await db.runAsync('DELETE FROM meal_logs WHERE date = ? AND plan_id = ? AND meal_id = ?', date, planId, mealId);
}

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | undefined> {
  const r = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? undefined;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string | undefined): Promise<void> {
  if (value == null || value === '') await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  else await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

/** Inserts a plan with explicit dates (used by demo mode). */
export async function insertPlanRecord(db: SQLiteDatabase, plan: Plan, activatedOn: DateStr, activatedAt: string, replacedOn?: DateStr): Promise<void> {
  await db.runAsync(
    'INSERT INTO plans (plan_id, version, json, activated_on, activated_at, replaced_on) VALUES (?, ?, ?, ?, ?, ?)',
    plan.id,
    plan.version,
    JSON.stringify(plan),
    activatedOn,
    activatedAt,
    replacedOn ?? null,
  );
}

/** Erases every plan, log and setting on this phone. Testing builds only. */
export async function clearAll(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DELETE FROM meal_logs; DELETE FROM plans; DELETE FROM settings;');
}
