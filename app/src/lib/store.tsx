// App state: plans on this phone, meal logs, and the patient's (optional) first name.
import { decideImport, decodePlanLink, importMessage, todayLocal, type DateStr, type ImportDecision } from '@lb/shared';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { activatePlan, deleteLog, getSetting, loadPlans, logsForDate, saveLog, setSetting, type MealLog, type StoredPlan } from './db';
import { clearAll, loadDemo } from './demo';

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

  useEffect(() => {
    (async () => {
      setPlans(await loadPlans(db));
      setNameState(await getSetting(db, 'firstName'));
      setReady(true);
    })();
  }, [db]);

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
      }
      return { ok: true, changed, decision, ...msg };
    },
    [db, active],
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
    setLastChange(undefined);
  }, [db, lastChange, loadLogs]);

  const reloadAll = async () => {
    setPlans(await loadPlans(db));
    setNameState(await getSetting(db, 'firstName'));
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
