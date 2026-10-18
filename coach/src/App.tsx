import {
  APP_NAME, SAMPLE_PLANS, contentKey, decodePlanLink, formatMedium, fromTemplate, newPlan, planLink, stampForIssue, toTemplate, todayLocal,
  validatePlan,
} from '@lb/shared';
import type { IssuedStamp, Plan } from '@lb/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BasicsEditor, DayPlansEditor, FeaturesEditor, MealNamesDatalist, PostWorkoutEditor, ScheduleEditor, SupplementsEditor, type Update,
} from './editor';
import { OutputsPanel, type Output } from './outputs';
import {
  clearDraft, exportTemplatesFile, importTemplatesFile, loadDraft, loadTemplates, saveDraft, saveTemplates, type Template,
} from './storage';

const uuid = () => crypto.randomUUID();
const stampOf = (p: Plan): IssuedStamp => ({ id: p.id, version: p.version, key: contentKey(p) });

interface Init {
  plan: Plan;
  issued?: IssuedStamp;
  openedFromLink?: boolean;
}

function initialState(): Init {
  // A plan link opened directly in the coach page → load it for editing, then
  // strip it from the address bar so it doesn't linger in browser history.
  if (location.hash.includes('p1.') || /#p\d+\./.test(location.hash)) {
    const r = decodePlanLink(location.href);
    history.replaceState(null, '', location.pathname + location.search);
    if (r.ok) return { plan: r.plan, issued: stampOf(r.plan), openedFromLink: true };
  }
  const draft = loadDraft();
  if (draft?.plan) return draft;
  return { plan: newPlan(uuid(), todayLocal()) };
}

export default function App() {
  const init = useMemo(initialState, []);
  const [plan, setPlan] = useState<Plan>(init.plan);
  const [issued, setIssued] = useState<IssuedStamp | undefined>(init.issued);
  const [output, setOutput] = useState<Output | undefined>();
  const [patientName, setPatientName] = useState('');
  const [modal, setModal] = useState<'open' | 'templates' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const toastTimer = useRef<number>(undefined);

  const toast = (s: string) => {
    setToastMsg(s);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2600);
  };

  useEffect(() => {
    if (init.openedFromLink) toast(`Opened ${init.plan.title} (v${init.plan.version}). Edits will save as v${init.plan.version + 1}.`);
  }, [init]);

  // Autosave the draft (never the patient name).
  useEffect(() => saveDraft({ plan, issued }), [plan, issued]);

  const update: Update = (fn) => setPlan((p) => fn(p));
  const errors = useMemo(() => validatePlan(plan), [plan]);
  const stale = !!output && contentKey(output.plan) !== contentKey(plan);

  const replacePlan = (p: Plan, stamp?: IssuedStamp) => {
    setPlan(p);
    setIssued(stamp);
    setOutput(undefined);
    setPatientName('');
    setEditorKey((k) => k + 1);
  };

  const startNew = () => {
    if (!confirm('Start a new plan? This clears the current draft and patient name.')) return;
    clearDraft();
    replacePlan(newPlan(uuid(), todayLocal()));
  };

  const createLink = () => {
    const { plan: stamped, stamp } = stampForIssue(plan, issued, todayLocal());
    setPlan(stamped);
    setIssued(stamp);
    setOutput({ plan: stamped, link: planLink(stamped) });
  };

  return (
    <>
      <header className="topbar">
        <div className="brand">{APP_NAME.toLowerCase()} <span>plan builder</span></div>
        <button onClick={startNew}>New plan</button>
        <button onClick={() => setModal('open')}>Open plan link</button>
        <button onClick={() => setModal('templates')}>Templates</button>
      </header>
      <div className="layout">
        <main className="main" key={editorKey}>
          <MealNamesDatalist />
          {issued && (
            <div className="notice">
              Editing <strong>{plan.title}</strong>, last issued as v{issued.version}. Any change you send goes out as v{issued.version + 1}, same plan.
            </div>
          )}
          <BasicsEditor plan={plan} update={update} patientName={patientName} setPatientName={setPatientName} />
          <DayPlansEditor plan={plan} update={update} />
          <ScheduleEditor plan={plan} update={update} />
          <PostWorkoutEditor plan={plan} update={update} />
          <SupplementsEditor plan={plan} update={update} />
          <FeaturesEditor plan={plan} update={update} />
        </main>
        <OutputsPanel errors={errors} output={output} stale={stale} onCreate={createLink} patientName={patientName} toast={toast} />
      </div>

      {modal === 'open' && (
        <OpenLinkModal
          onClose={() => setModal(null)}
          onOpen={(p) => {
            replacePlan(p, stampOf(p));
            setModal(null);
            toast(`Opened ${p.title} (v${p.version}).`);
          }}
        />
      )}
      {modal === 'templates' && (
        <TemplatesModal
          plan={plan}
          onClose={() => setModal(null)}
          onLoad={(t) => {
            if (!confirm(`Start a new plan from "${t.name}"? This replaces the current draft.`)) return;
            clearDraft();
            replacePlan(fromTemplate(t.plan, uuid(), todayLocal()));
            setModal(null);
            toast(`Started from template "${t.name}". Set the start date.`);
          }}
          toast={toast}
        />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}

function OpenLinkModal({ onClose, onOpen }: { onClose: () => void; onOpen: (p: Plan) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>open a plan link</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Paste a plan link to edit it. Your changes go out as the next version of the same plan, so the patient's app replaces the old one.
        </p>
        <textarea autoFocus rows={5} value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} placeholder="https://…/p/#p1.…" />
        {err && <div className="errors">{err}</div>}
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={() => {
              const r = decodePlanLink(text);
              if (r.ok) onOpen(r.plan);
              else setErr(r.message);
            }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplatesModal({ plan, onClose, onLoad, toast }: { plan: Plan; onClose: () => void; onLoad: (t: Template) => void; toast: (s: string) => void }) {
  const [list, setList] = useState<Template[]>(loadTemplates);
  const [name, setName] = useState(plan.title);
  const fileRef = useRef<HTMLInputElement>(null);
  const persist = (l: Template[]) => {
    setList(l);
    saveTemplates(l);
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>templates</h2>
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            Save the current plan as a template
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Carb cycling, 5 meals" />
          </label>
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() => {
              persist([...list, { id: uuid(), name: name.trim(), savedAt: new Date().toISOString(), plan: toTemplate(plan) }]);
              toast('Template saved.');
            }}
          >
            Save
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Templates never include the patient's name or dates. They're saved in this browser only.</p>

        {list.length === 0 ? (
          <p className="muted">No templates yet.</p>
        ) : (
          list.map((t) => (
            <div key={t.id} className="tpl">
              <div className="grow">
                <strong>{t.name}</strong>
                <div className="small muted">
                  {t.plan.dayPlans.length} day plan{t.plan.dayPlans.length === 1 ? '' : 's'} · saved {formatMedium(t.savedAt.slice(0, 10))}
                </div>
              </div>
              <button onClick={() => onLoad(t)}>Use</button>
              <button className="ghost danger" onClick={() => confirm(`Delete template "${t.name}"?`) && persist(list.filter((x) => x.id !== t.id))}>
                Delete
              </button>
            </div>
          ))
        )}

        <div className="label" style={{ marginTop: 6 }}>Examples (made-up, for practice)</div>
        {[
          ['Simple everyday plan', SAMPLE_PLANS.simplePlan],
          ['Weekday carb cycling', SAMPLE_PLANS.carbCyclingPlan],
          ['4-week block with post-workout carbs', SAMPLE_PLANS.fourWeekPlan],
        ].map(([label, p]) => (
          <div key={label as string} className="tpl">
            <div className="grow"><strong>{label as string}</strong></div>
            <button onClick={() => onLoad({ id: label as string, name: label as string, savedAt: '', plan: toTemplate(p as Plan) })}>Use</button>
          </div>
        ))}

        <div className="notice">
          Working on another computer? Export your templates to a file here, then import that file on the other computer. Plan links open anywhere.
        </div>
        <div className="modal-actions">
          <button onClick={() => fileRef.current?.click()}>Import file…</button>
          <button disabled={!list.length} onClick={() => exportTemplatesFile(list)}>Export all</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const { merged, added } = await importTemplatesFile(file, list);
              persist(merged);
              toast(added ? `Imported ${added} template${added === 1 ? '' : 's'}.` : 'Those templates are already here.');
            } catch (err) {
              toast(err instanceof Error ? err.message : "Couldn't read that file.");
            }
          }}
        />
      </div>
    </div>
  );
}
