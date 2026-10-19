// App state: plans on this phone, meal logs, and the patient's (optional) first name.
import { WATER_PRESETS, dayLevels, decideImport, decodePlanLink, importMessage, loggedDays, todayLocal, type DateStr, type DayEntry, type DayLevel, type ImportDecision, type WaterUnit } from '@lb/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  activatePlan, allEntries, deleteLog, getEntry, getSetting, loadPlans, logsForDate, mealLogDates, mealLogKeys, saveEntry, saveLog, setSetting, type MealLog, type StoredPlan,
} from './db';
import { clearAll, loadDemo } from './demo';
import { DEFAULT_REMINDERS, rescheduleReminders, type ReminderSettings } from './reminders';
import { AppState } from 'react-native';

export type ImportResult =
  | { ok: false; title: string; body: string }
  | { ok: true; changed: boolean; decision: ImportDecision; title: string; body: string };

/** Something that just changed and can be undone from the Today screen. */
export interface UndoableChange {
  message: string;
  date: DateStr;
  planId: string;
  mealId: number;
  previous?: MealLog;
}

interface Store {
  ready: boolean;
  plans: StoredPlan[];
  active?: StoredPlan;
  name?: string;
  setName: (n: string) => Promise<void>;
  importFromText: (text: string) => Promise<ImportResult>;
  logs: Record<DateStr, MealLog[]>;
  loadLogs: (date: DateStr) => Promise<void>;
  saveMealLog: (log: MealLog, message: string) => Promise<void>;
  removeMealLog: (date: DateStr, planId: string, mealId: number, message: string) => Promise<void>;
  lastChange?: UndoableChange;
  undo: () => Promise<void>;
  dismissUndo: () => void;
  flash?: { title: string; body: string };
  setFlash: (f?: { title: string; body: string }) => void;
  entries: Record<DateStr, DayEntry | undefined>;
  loadEntry: (date: DateStr) => Promise<void>;
  updateEntry: (date: DateStr, fn: (e: DayEntry) => DayEntry) => Promise<void>;
  /** Dates with anything logged (for the streak and weekly view). */
  logged: Set<DateStr>;
  /** full = every meal logged that day; partial = some. */
  levels: Map<DateStr, DayLevel>;
  disclaimerAck: boolean;
  ackDisclaimer: () => Promise<void>;
  waterUnit: WaterUnit;
  customWaterUnits: WaterUnit[];
  setWaterUnit: (u: WaterUnit) => Promise<void>;
  addCustomWaterUnit: (u: WaterUnit) => Promise<void>;
  reminders: ReminderSettings;
  setReminders: (r: ReminderSettings) => Promise<void>;
  /** Testing builds only. */
  loadDemoData: () => Promise<void>;
  eraseEverything: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [name, setNameState] = useState<string>();
  const [logs, setLogs] = useState<Record<DateStr, MealLog[]>>({});
  const [lastChange, setLastChange] = useState<UndoableChange>();
  const [flash, setFlash] = useState<{ title: string; body: string }>();
  const [entries, setEntries] = useState<Record<DateStr, DayEntry | undefined>>({});
  const [logged, setLogged] = useState<Set<DateStr>>(new Set());
  const [levels, setLevels] = useState<Map<DateStr, DayLevel>>(new Map());
  const [disclaimerAck, setDisclaimerAck] = useState(false);
  const [waterUnit, setWaterUnitState] = useState<WaterUnit>(WATER_PRESETS[0]);
  const [customWaterUnits, setCustomWaterUnits] = useState<WaterUnit[]>([]);
  const [reminders, setRemindersState] = useState<ReminderSettings>(DEFAULT_REMINDERS);

  const refreshLogged = useCallback(async () => {
    const entries = await allEntries(db);
    setLogged(loggedDays(await mealLogDates(db), entries));
    setLevels(dayLevels(await loadPlans(db), await mealLogKeys(db), entries));
  }, [db]);

  useEffect(() => {
    (async () => {
      setPlans(await loadPlans(db));
      setNameState(await getSetting(db, 'firstName'));
      setDisclaimerAck((await getSetting(db, 'disclaimerAck')) === '1');
      const r = await getSetting(db, 'reminders');
      if (r) setRemindersState(JSON.parse(r));
      const wu = await getSetting(db, 'waterUnit');
      if (wu) setWaterUnitState(JSON.parse(wu));
      const wc = await getSetting(db, 'waterCustom');
      if (wc) setCustomWaterUnits(JSON.parse(wc));
      await refreshLogged();
      setReady(true);
    })();
  }, [db, refreshLogged]);

  // Keep scheduled reminders in step with the plan, the settings, and the calendar.
  useEffect(() => {
    if (!ready) return;
    rescheduleReminders(plans, reminders).catch(() => {});
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') rescheduleReminders(plans, reminders).catch(() => {});
    });
    return () => sub.remove();
  }, [ready, plans, reminders]);

  const setWaterUnit = async (u: WaterUnit) => {
    await setSetting(db, 'waterUnit', JSON.stringify(u));
    setWaterUnitState(u);
  };

  const addCustomWaterUnit = async (u: WaterUnit) => {
    const next = [...customWaterUnits.filter((x) => x.oz !== u.oz), u];
    await setSetting(db, 'waterCustom', JSON.stringify(next));
    setCustomWaterUnits(next);
    await setWaterUnit(u);
  };

  const setReminders = useCallback(
    async (r: ReminderSettings) => {
      await setSetting(db, 'reminders', JSON.stringify(r));
      setRemindersState(r);
    },
    [db],
  );

  const active = useMemo(() => plans.find((p) => !p.replacedOn), [plans]);

  const setName = useCallback(
    async (n: string) => {
      const v = n.trim() || undefined;
      await setSetting(db, 'firstName', v);
      setNameState(v);
    },
    [db],
  );

  const importFromText = useCallback(
    async (text: string): Promise<ImportResult> => {
      const decoded = decodePlanLink(text);
      if (!decoded.ok) return { ok: false, title: "that didn't work", body: decoded.message };
      const decision = decideImport(active?.plan, decoded.plan);
      const msg = importMessage(decision);
      const changed = decision.kind === 'first' || decision.kind === 'update' || decision.kind === 'newPlan';
      if (changed) {
        await activatePlan(db, decoded.plan, todayLocal());
        setPlans(await loadPlans(db));
        await refreshLogged();
      }
      return { ok: true, changed, decision, ...msg };
    },
    [db, active, refreshLogged],
  );

  const loadLogs = useCallback(
    async (date: DateStr) => {
      const list = await logsForDate(db, date);
      setLogs((l) => ({ ...l, [date]: list }));
    },
    [db],
  );

  const findLog = (date: DateStr, planId: string, mealId: number) =>
    logs[date]?.find((l) => l.planId === planId && l.mealId === mealId);

  const saveMealLog = useCallback(
    async (log: MealLog, message: string) => {
      const previous = findLog(log.date, log.planId, log.mealId);
      await saveLog(db, log);
      await loadLogs(log.date);
      await refreshLogged();
      setLastChange({ message, date: log.date, planId: log.planId, mealId: log.mealId, previous });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, loadLogs, logs],
  );

  const removeMealLog = useCallback(
    async (date: DateStr, planId: string, mealId: number, message: string) => {
      const previous = findLog(date, planId, mealId);
      await deleteLog(db, date, planId, mealId);
      await loadLogs(date);
      await refreshLogged();
      setLastChange({ message, date, planId, mealId, previous });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, loadLogs, logs],
  );

  const undo = useCallback(async () => {
    const c = lastChange;
    if (!c) return;
    if (c.previous) await saveLog(db, c.previous);
    else await deleteLog(db, c.date, c.planId, c.mealId);
    await loadLogs(c.date);
    await refreshLogged();
    setLastChange(undefined);
  }, [db, lastChange, loadLogs]);

  const loadEntry = useCallback(
    async (date: DateStr) => {
      const e = await getEntry(db, date);
      setEntries((m) => ({ ...m, [date]: e }));
    },
    [db],
  );

  const updateEntry = useCallback(
    async (date: DateStr, fn: (e: DayEntry) => DayEntry) => {
      const current = (await getEntry(db, date)) ?? { date };
      const next = fn(current);
      await saveEntry(db, next);
      setEntries((m) => ({ ...m, [date]: next }));
      await refreshLogged();
    },
    [db, refreshLogged],
  );

  const ackDisclaimer = async () => {
    await setSetting(db, 'disclaimerAck', '1');
    setDisclaimerAck(true);
  };

  const reloadAll = async () => {
    setPlans(await loadPlans(db));
    setNameState(await getSetting(db, 'firstName'));
    setDisclaimerAck((await getSetting(db, 'disclaimerAck')) === '1');
    const r = await getSetting(db, 'reminders');
    setRemindersState(r ? JSON.parse(r) : DEFAULT_REMINDERS);
    setEntries({});
    await refreshLogged();
    setLogs({});
    setLastChange(undefined);
  };

  const loadDemoData = async () => {
    await loadDemo(db);
    await reloadAll();
  };

  const eraseEverything = async () => {
    await clearAll(db);
    await reloadAll();
  };

  const value: Store = {
    ready,
    plans,
    active,
    name,
    setName,
    importFromText,
    logs,
    loadLogs,
    saveMealLog,
    removeMealLog,
    lastChange,
    undo,
    dismissUndo: () => setLastChange(undefined),
    flash,
    setFlash,
    entries,
    loadEntry,
    updateEntry,
    logged,
    levels,
    disclaimerAck,
    ackDisclaimer,
    waterUnit,
    customWaterUnits,
    setWaterUnit,
    addCustomWaterUnit,
    reminders,
    setReminders,
    loadDemoData,
    eraseEverything,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
