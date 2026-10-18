// Browser-only storage on Cristie's laptop. Nothing here leaves the browser.
// The patient's first name is never written anywhere — it lives only in memory.
import type { IssuedStamp, Plan, TemplatePlan } from '@lb/shared';

const DRAFT_KEY = 'lb.coach.draft.v1';
const TEMPLATES_KEY = 'lb.coach.templates.v1';

export interface Draft {
  plan: Plan;
  issued?: IssuedStamp;
}

export interface Template {
  id: string;
  name: string;
  savedAt: string;
  plan: TemplatePlan;
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the page still works, it just won't remember.
  }
}

export const loadDraft = () => read<Draft>(DRAFT_KEY);
export const saveDraft = (d: Draft) => write(DRAFT_KEY, d);
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const loadTemplates = () => read<Template[]>(TEMPLATES_KEY) ?? [];
export const saveTemplates = (t: Template[]) => write(TEMPLATES_KEY, t);

const EXPORT_KIND = 'living-boundless-templates';

export function exportTemplatesFile(templates: Template[]): void {
  const blob = new Blob([JSON.stringify({ kind: EXPORT_KIND, version: 1, templates }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `plan-templates-${new Date().toISOString().slice(0, 10)}.json`);
}

/** Merges templates from an exported file. Returns how many were added. */
export async function importTemplatesFile(file: File, existing: Template[]): Promise<{ merged: Template[]; added: number }> {
  const data = JSON.parse(await file.text());
  if (data?.kind !== EXPORT_KIND || !Array.isArray(data.templates)) throw new Error("That file isn't a templates export.");
  const ids = new Set(existing.map((t) => t.id));
  const incoming = (data.templates as Template[]).filter((t) => t && t.id && t.name && t.plan && !ids.has(t.id));
  return { merged: [...existing, ...incoming], added: incoming.length };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
