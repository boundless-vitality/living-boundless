import {
  COMPONENT_TYPES, DEFAULT_UNIT, DETAILS, UNITS, WEEKDAYS_SHORT, copyMealTo, describeSchedule, duplicateDayPlan, duplicateMeal,
  newMeal, parseTime, takeId, toHHMM,
} from '@lb/shared';
import type {
  ComponentDetail, ComponentType, DayPlan, Meal, MealComponent, MealItem, MealTag, Plan, Schedule, Unit, WeekSpec, WeekdayMap,
} from '@lb/shared';
import { useState } from 'react';

export type Update = (fn: (p: Plan) => Plan) => void;

const MEAL_NAMES = ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner', 'Snack 3', 'Pre-Workout', 'Post-Workout'];

function mapDay(p: Plan, id: number, fn: (d: DayPlan) => DayPlan): Plan {
  return { ...p, dayPlans: p.dayPlans.map((d) => (d.id === id ? fn(d) : d)) };
}
function mapMeal(p: Plan, dayId: number, mealId: number, fn: (m: Meal) => Meal): Plan {
  return mapDay(p, dayId, (d) => ({ ...d, meals: d.meals.map((m) => (m.id === mealId ? fn(m) : m)) }));
}
const numOrUndef = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

/* ---------------- plan basics ---------------- */

export function BasicsEditor({ plan, update, patientName, setPatientName }: {
  plan: Plan; update: Update; patientName: string; setPatientName: (s: string) => void;
}) {
  return (
    <section className="card">
      <h2>plan basics</h2>
      <div className="grid3">
        <label className="field">
          Plan title
          <input value={plan.title} onChange={(e) => update((p) => ({ ...p, title: e.target.value }))} />
        </label>
        <label className="field">
          Start date
          <input type="date" value={plan.startDate} onChange={(e) => e.target.value && update((p) => ({ ...p, startDate: e.target.value }))} />
        </label>
        <label className="field">
          Patient first name (PDF only)
          <input value={patientName} placeholder="Not saved anywhere" onChange={(e) => setPatientName(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        The first name only appears on the chart PDF. It's never put in the link or saved in this browser.
      </p>
      <label className="field" style={{ marginTop: 14 }}>
        General notes for the patient
        <textarea value={plan.notes ?? ''} onChange={(e) => update((p) => ({ ...p, notes: e.target.value || undefined }))} />
      </label>
    </section>
  );
}

/* ---------------- day plans & meals ---------------- */

export function DayPlansEditor({ plan, update }: { plan: Plan; update: Update }) {
  const [activeId, setActiveId] = useState<number | undefined>(plan.dayPlans[0]?.id);
  const active = plan.dayPlans.find((d) => d.id === activeId) ?? plan.dayPlans[0];

  // New day plans take the next id, so the tab can switch to it right away.
  const addDayPlan = () => {
    update((p) => {
      const [dayId, p1] = takeId(p);
      const [mealId, p2] = takeId(p1);
      return { ...p2, dayPlans: [...p2.dayPlans, { id: dayId, name: `Day Plan ${p2.dayPlans.length + 1}`, meals: [newMeal(mealId)] }] };
    });
    setActiveId(plan.nextId);
  };

  const removeDayPlan = (id: number) => {
    if (plan.dayPlans.length <= 1) return;
    const d = plan.dayPlans.find((x) => x.id === id);
    if (!confirm(`Delete "${d?.name}"? Any schedule days using it will switch to another day plan.`)) return;
    update((p) => {
      const rest = p.dayPlans.filter((x) => x.id !== id);
      return { ...p, dayPlans: rest, schedule: replaceInSchedule(p.schedule, id, rest[0].id) };
    });
    setActiveId(plan.dayPlans.find((x) => x.id !== id)?.id);
  };

  const duplicate = (id: number) => {
    update((p) => duplicateDayPlan(p, id));
    setActiveId(plan.nextId);
  };

  return (
    <section className="card">
      <div className="section-head">
        <h2>day plans</h2>
        <button onClick={addDayPlan}>+ Add day plan</button>
      </div>
      <div className="tabs">
        {plan.dayPlans.map((d) => (
          <button key={d.id} className={`tab ${d.id === active?.id ? 'active' : ''}`} onClick={() => setActiveId(d.id)}>
            {d.name || 'Unnamed'}
          </button>
        ))}
      </div>
      {active && (
        <div>
          <div className="row" style={{ marginBottom: 14 }}>
            <label className="field" style={{ flex: '1 1 220px' }}>
              Day plan name
              <input value={active.name} placeholder="e.g. Training Day" onChange={(e) => update((p) => mapDay(p, active.id, (d) => ({ ...d, name: e.target.value })))} />
            </label>
            <button onClick={() => duplicate(active.id)}>Duplicate day plan</button>
            <button className="danger" disabled={plan.dayPlans.length <= 1} onClick={() => removeDayPlan(active.id)}>Delete</button>
          </div>
          {active.meals.map((m) => (
            <MealEditor key={m.id} plan={plan} day={active} meal={m} update={update} />
          ))}
          <button style={{ marginTop: 12 }} onClick={() => update((p) => addMeal(p, active.id))}>+ Add meal</button>
        </div>
      )}
    </section>
  );
}

function addMeal(p: Plan, dayId: number): Plan {
  const [id, p1] = takeId(p);
  const day = p1.dayPlans.find((d) => d.id === dayId)!;
  const last = day.meals[day.meals.length - 1];
  const start = last ? Math.min(last.end + 60, 22 * 60) : 7 * 60;
  const label = MEAL_NAMES.find((n) => !day.meals.some((m) => m.label === n)) ?? 'Snack';
  return mapDay(p1, dayId, (d) => ({ ...d, meals: [...d.meals, newMeal(id, label, start, Math.min(start + 60, 23 * 60 + 59))] }));
}

function replaceInSchedule(s: Schedule, from: number, to: number): Schedule {
  const fix = <T extends WeekSpec | Schedule>(w: T): T => {
    if (w.kind === 'daily') return { ...w, dayPlanId: w.dayPlanId === from ? to : w.dayPlanId };
    if (w.kind === 'weekday') return { ...w, map: w.map.map((id) => (id === from ? to : id)) as WeekdayMap };
    return w;
  };
  if (s.kind === 'weeks') return { ...s, weeks: s.weeks.map(fix) };
  return fix(s);
}

function MealEditor({ plan, day, meal, update }: { plan: Plan; day: DayPlan; meal: Meal; update: Update }) {
  const set = (fn: (m: Meal) => Meal) => update((p) => mapMeal(p, day.id, meal.id, fn));
  const others = plan.dayPlans.filter((d) => d.id !== day.id);

  const addComponent = (type: ComponentType) =>
    set((m) => ({
      ...m,
      components: [...m.components, { type, unit: type === 'veggies' ? undefined : DEFAULT_UNIT[type], detail: DETAILS[type][0]?.value }],
    }));

  return (
    <div className="meal">
      <div className="meal-head">
        <label className="field grow">
          Meal
          <input list="meal-names" value={meal.label} onChange={(e) => set((m) => ({ ...m, label: e.target.value }))} />
        </label>
        <label className="field">
          From
          <input type="time" value={toHHMM(meal.start)} onChange={(e) => { const v = parseTime(e.target.value); if (v != null) set((m) => ({ ...m, start: v })); }} />
        </label>
        <label className="field">
          To
          <input type="time" value={toHHMM(meal.end)} onChange={(e) => { const v = parseTime(e.target.value); if (v != null) set((m) => ({ ...m, end: v })); }} />
        </label>
        <label className="field">
          Tag
          <select value={meal.tag ?? ''} onChange={(e) => set((m) => ({ ...m, tag: (e.target.value || undefined) as MealTag | undefined }))}>
            <option value="">None</option>
            <option value="preWorkout">Pre-workout</option>
            <option value="postWorkout">Post-workout</option>
          </select>
        </label>
        <div className="meal-actions">
          <button className="ghost icon" title="Duplicate this meal" onClick={() => update((p) => duplicateMeal(p, day.id, meal.id))}>Duplicate</button>
          {others.length > 0 && (
            <select
              value=""
              title="Copy this meal to another day plan"
              onChange={(e) => {
                const to = Number(e.target.value);
                if (to) update((p) => copyMealTo(p, day.id, meal.id, to));
              }}
            >
              <option value="">Copy to…</option>
              {others.map((d) => <option key={d.id} value={d.id}>{d.name || 'Unnamed'}</option>)}
            </select>
          )}
          <button
            className="ghost icon danger"
            title="Delete this meal"
            onClick={() => confirm(`Delete ${meal.label || 'this meal'}?`) && update((p) => mapDay(p, day.id, (d) => ({ ...d, meals: d.meals.filter((m) => m.id !== meal.id) })))}
          >
            Delete
          </button>
        </div>
      </div>

      {meal.components.map((c, i) => (
        <ComponentRow
          key={i}
          c={c}
          onChange={(nc) => set((m) => ({ ...m, components: m.components.map((x, j) => (j === i ? nc : x)) }))}
          onRemove={() => set((m) => ({ ...m, components: m.components.filter((_, j) => j !== i) }))}
        />
      ))}
      {meal.items.map((it, i) => (
        <ItemRow
          key={`i${i}`}
          item={it}
          onChange={(ni) => set((m) => ({ ...m, items: m.items.map((x, j) => (j === i ? ni : x)) }))}
          onRemove={() => set((m) => ({ ...m, items: m.items.filter((_, j) => j !== i) }))}
        />
      ))}

      <div className="chip-row">
        <span className="small muted">Add:</span>
        {COMPONENT_TYPES.map((t) => (
          <button key={t.value} className="chip" onClick={() => addComponent(t.value)}>+ {t.label}</button>
        ))}
        <button className="chip" onClick={() => set((m) => ({ ...m, items: [...m.items, { options: [{ name: '' }] }] }))}>+ Specific food</button>
        <button className="chip" onClick={() => set((m) => ({ ...m, items: [...m.items, { options: [{ name: '' }, { name: '' }] }] }))}>+ Pick one of…</button>
        {meal.note == null && <button className="chip" onClick={() => set((m) => ({ ...m, note: '' }))}>+ Note</button>}
      </div>
      {meal.note != null && (
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            Note
            <input value={meal.note} onChange={(e) => set((m) => ({ ...m, note: e.target.value }))} placeholder="e.g. Finish eating 2–3 hours before bed" />
          </label>
          <button className="ghost icon" onClick={() => set((m) => { const { note: _n, ...rest } = m; return rest; })}>Remove</button>
        </div>
      )}
    </div>
  );
}

function ComponentRow({ c, onChange, onRemove }: { c: MealComponent; onChange: (c: MealComponent) => void; onRemove: () => void }) {
  const details = DETAILS[c.type];
  return (
    <div className="comp">
      <select
        value={c.type}
        onChange={(e) => {
          const type = e.target.value as ComponentType;
          onChange({ ...c, type, detail: DETAILS[type][0]?.value, unit: type === 'veggies' && c.amount == null ? undefined : (c.unit ?? DEFAULT_UNIT[type]) });
        }}
      >
        {COMPONENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      {details.length > 0 && (
        <select value={c.detail ?? ''} onChange={(e) => onChange({ ...c, detail: e.target.value as ComponentDetail })}>
          {details.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      )}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        placeholder={c.type === 'veggies' ? 'free' : 'amount'}
        aria-label="Amount"
        value={c.amount ?? ''}
        onChange={(e) => {
          const amount = numOrUndef(e.target.value);
          onChange({ ...c, amount, unit: amount != null ? (c.unit ?? DEFAULT_UNIT[c.type]) : c.type === 'veggies' ? undefined : c.unit });
        }}
      />
      <select value={c.unit ?? ''} aria-label="Unit" onChange={(e) => onChange({ ...c, unit: (e.target.value || undefined) as Unit | undefined })}>
        {c.type === 'veggies' && <option value="">—</option>}
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <input className="examples" placeholder="Example foods (optional)" value={c.examples ?? ''} onChange={(e) => onChange({ ...c, examples: e.target.value || undefined })} />
      <button className="ghost icon danger" title="Remove" onClick={onRemove}>✕</button>
    </div>
  );
}

function ItemRow({ item, onChange, onRemove }: { item: MealItem; onChange: (i: MealItem) => void; onRemove: () => void }) {
  const setOpt = (i: number, patch: Partial<MealItem['options'][number]>) =>
    onChange({ options: item.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const pickOne = item.options.length > 1;
  return (
    <div className="item">
      <span className="label">{pickOne ? 'Pick one of' : 'Specific food'}</span>
      {item.options.map((o, i) => (
        <div key={i}>
          {i > 0 && <div className="or">or</div>}
          <div className="option">
            <input style={{ flex: 2 }} placeholder="Food (e.g. Chobani protein drink)" value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} />
            <input style={{ flex: 1, minWidth: 80 }} placeholder="Amount (e.g. 1)" value={o.amount ?? ''} onChange={(e) => setOpt(i, { amount: e.target.value || undefined })} />
            {pickOne && (
              <button className="ghost icon" title="Remove option" onClick={() => onChange({ options: item.options.filter((_, j) => j !== i) })}>✕</button>
            )}
          </div>
        </div>
      ))}
      <div className="row">
        <button className="ghost icon" onClick={() => onChange({ options: [...item.options, { name: '' }] })}>+ Add option</button>
        <button className="ghost icon danger" onClick={onRemove}>Remove food</button>
      </div>
    </div>
  );
}

export function MealNamesDatalist() {
  return (
    <datalist id="meal-names">
      {MEAL_NAMES.map((n) => <option key={n} value={n} />)}
    </datalist>
  );
}

/* ---------------- schedule ---------------- */

function DaySelect({ plan, value, onChange }: { plan: Plan; value: number; onChange: (id: number) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {plan.dayPlans.map((d) => <option key={d.id} value={d.id}>{d.name || 'Unnamed'}</option>)}
    </select>
  );
}

function WeekdayGrid({ plan, map, onChange }: { plan: Plan; map: WeekdayMap; onChange: (m: WeekdayMap) => void }) {
  return (
    <div className="row">
      {WEEKDAYS_SHORT.map((wd, i) => (
        <label key={wd} className="field">
          {wd}
          <DaySelect plan={plan} value={map[i]} onChange={(id) => onChange(map.map((x, j) => (j === i ? id : x)) as WeekdayMap)} />
        </label>
      ))}
    </div>
  );
}

function SpecEditor({ plan, spec, onChange }: { plan: Plan; spec: WeekSpec; onChange: (s: WeekSpec) => void }) {
  const first = plan.dayPlans[0].id;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row">
        <label className="check">
          <input type="radio" checked={spec.kind === 'daily'} onChange={() => onChange({ kind: 'daily', dayPlanId: spec.kind === 'weekday' ? spec.map[0] : first })} />
          Same every day
        </label>
        <label className="check">
          <input
            type="radio"
            checked={spec.kind === 'weekday'}
            onChange={() => onChange({ kind: 'weekday', map: Array(7).fill(spec.kind === 'daily' ? spec.dayPlanId : first) as WeekdayMap })}
          />
          By weekday
        </label>
      </div>
      {spec.kind === 'daily' ? (
        <DaySelect plan={plan} value={spec.dayPlanId} onChange={(id) => onChange({ kind: 'daily', dayPlanId: id })} />
      ) : (
        <WeekdayGrid plan={plan} map={spec.map} onChange={(map) => onChange({ kind: 'weekday', map })} />
      )}
    </div>
  );
}

export function ScheduleEditor({ plan, update }: { plan: Plan; update: Update }) {
  const s = plan.schedule;
  const setSchedule = (schedule: Schedule) => update((p) => ({ ...p, schedule }));
  const asSpec = (x: Schedule): WeekSpec => (x.kind === 'weeks' ? x.weeks[0] : x);
  const switchTo = (kind: 'single' | 'weeks') => {
    if (kind === 'weeks' && s.kind !== 'weeks') setSchedule({ kind: 'weeks', weeks: [asSpec(s)] });
    if (kind === 'single' && s.kind === 'weeks') setSchedule(s.weeks[0]);
  };
  let preview: string[] = [];
  try {
    preview = describeSchedule(plan);
  } catch {
    preview = [];
  }

  return (
    <section className="card">
      <h2>schedule</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="check">
          <input type="radio" checked={s.kind !== 'weeks'} onChange={() => switchTo('single')} />
          Same pattern every week
        </label>
        <label className="check">
          <input type="radio" checked={s.kind === 'weeks'} onChange={() => switchTo('weeks')} />
          Week by week (Week 1, Week 2…)
        </label>
      </div>

      {s.kind !== 'weeks' ? (
        <SpecEditor plan={plan} spec={s} onChange={setSchedule} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {s.weeks.map((w, i) => (
            <div key={i} className="meal" style={{ borderLeftColor: 'var(--sand)' }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <h3>week {i + 1}</h3>
                <button
                  className="ghost icon danger"
                  disabled={s.weeks.length <= 1}
                  onClick={() => setSchedule({ kind: 'weeks', weeks: s.weeks.filter((_, j) => j !== i) })}
                >
                  Remove week
                </button>
              </div>
              <SpecEditor plan={plan} spec={w} onChange={(nw) => setSchedule({ kind: 'weeks', weeks: s.weeks.map((x, j) => (j === i ? nw : x)) })} />
            </div>
          ))}
          <div>
            <button onClick={() => setSchedule({ kind: 'weeks', weeks: [...s.weeks, structuredClone(s.weeks[s.weeks.length - 1])] })}>+ Add week</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Week 1 starts on the start date and moves forward every 7 days. After the last week, the patient stays on it and sees a gentle note to check in.
          </p>
        </div>
      )}
      {preview.length > 0 && (
        <div className="preview-line" style={{ marginTop: 14 }}>
          {preview.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </section>
  );
}

/* ---------------- supplements, post-workout carbs, features ---------------- */

export function SupplementsEditor({ plan, update }: { plan: Plan; update: Update }) {
  const set = (i: number, patch: Partial<Plan['supplements'][number]>) =>
    update((p) => ({ ...p, supplements: p.supplements.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  return (
    <section className="card">
      <div className="section-head">
        <h2>supplements</h2>
        <button onClick={() => update((p) => ({ ...p, supplements: [...p.supplements, { name: '' }] }))}>+ Add supplement</button>
      </div>
      {plan.supplements.length === 0 && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
      {plan.supplements.map((s, i) => (
        <div key={i} className="comp">
          <input style={{ flex: 2 }} placeholder="Name (e.g. Vitamin D3)" value={s.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input style={{ flex: 1 }} placeholder="Dose (e.g. 5,000 IU)" value={s.dose ?? ''} onChange={(e) => set(i, { dose: e.target.value || undefined })} />
          <input style={{ flex: 1 }} placeholder="When (e.g. with breakfast)" value={s.timing ?? ''} onChange={(e) => set(i, { timing: e.target.value || undefined })} />
          <button className="ghost icon danger" onClick={() => update((p) => ({ ...p, supplements: p.supplements.filter((_, j) => j !== i) }))}>✕</button>
        </div>
      ))}
    </section>
  );
}

export function PostWorkoutEditor({ plan, update }: { plan: Plan; update: Update }) {
  const w = plan.postWorkoutCarbs;
  const set = (patch: Partial<NonNullable<Plan['postWorkoutCarbs']>>) =>
    update((p) => ({ ...p, postWorkoutCarbs: { grams: 30, foods: '', ...p.postWorkoutCarbs, ...patch } }));
  return (
    <section className="card">
      <div className="section-head">
        <h2>post-workout carbs</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={!!w}
            onChange={(e) =>
              update((p) => {
                if (e.target.checked) return { ...p, postWorkoutCarbs: { grams: 30, foods: '', note: 'Within minutes after strength training.' } };
                const { postWorkoutCarbs: _w, ...rest } = p;
                return rest as Plan;
              })
            }
          />
          Include
        </label>
      </div>
      {w ? (
        <div className="row">
          <label className="field">
            Grams
            <input type="number" inputMode="decimal" min="0" step="any" value={Number.isFinite(w.grams) ? w.grams : ''} onChange={(e) => set({ grams: numOrUndef(e.target.value) ?? NaN })} />
          </label>
          <label className="field" style={{ flex: '2 1 200px' }}>
            Foods to hit it
            <input placeholder="e.g. 4 dates or 1 orange" value={w.foods} onChange={(e) => set({ foods: e.target.value })} />
          </label>
          <label className="field" style={{ flex: '2 1 200px' }}>
            Note
            <input value={w.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} />
          </label>
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>Separate from meals. Patients see grams here (the only place they see grams).</p>
      )}
    </section>
  );
}

export function FeaturesEditor({ plan, update }: { plan: Plan; update: Update }) {
  const f = plan.features;
  const set = (patch: Partial<Plan['features']>) => update((p) => ({ ...p, features: { ...p.features, ...patch } }));
  return (
    <section className="card">
      <h2>tracking extras</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="check">
            <input type="checkbox" checked={f.water} onChange={(e) => set({ water: e.target.checked, waterGoal: e.target.checked ? f.waterGoal : undefined })} />
            Water tracking
          </label>
          {f.water && (
            <label className="check">
              Daily goal (optional)
              <input type="number" min="8" max="400" step="1" placeholder="e.g. 64" value={f.waterGoal ?? ''} onChange={(e) => set({ waterGoal: numOrUndef(e.target.value) })} />
              oz
            </label>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={f.alcohol} onChange={(e) => set({ alcohol: e.target.checked })} />
          Alcohol tracking
        </label>
        <label className="check">
          <input type="checkbox" checked={f.checkIn} onChange={(e) => set({ checkIn: e.target.checked })} />
          Daily check-in (energy, mood, how you feel)
        </label>
        <p className="small muted" style={{ margin: 0 }}>These turn on in the app in the next phase. Choosing them now means the link already carries them.</p>
      </div>
    </section>
  );
}
