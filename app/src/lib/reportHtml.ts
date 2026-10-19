// Turns the report model into a printable HTML page (expo-print makes the PDF on the phone).
import { APP_NAME, CLINIC_NAME, type ReportModel } from '@lb/shared';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function reportHtml(r: ReportModel): string {
  const s = r.summary;
  const days = r.days
    .map((d) => {
      const head = `<div class="day-head"><span class="date">${esc(d.dateLabel)}</span>${d.dayPlanName ? `<span class="plan">${esc(d.dayPlanName)}</span>` : ''}</div>`;
      if (d.empty) {
        return `<section class="day empty">${head}<p class="nothing">${d.beforePlan ? 'Before the plan started. Nothing logged.' : 'Nothing logged this day.'}</p></section>`;
      }
      const meals = d.meals
        .map(
          (m) =>
            `<tr class="${m.status === 'Not logged' ? 'muted' : ''}"><td class="meal">${esc(m.label)}</td><td class="status">${esc(m.status)}</td><td>${m.detail ? esc(m.detail) : ''}</td></tr>`,
        )
        .join('');
      const lines = d.lines.map((l) => `<tr><td class="meal">${esc(l.label)}</td><td colspan="2">${esc(l.value)}</td></tr>`).join('');
      return `<section class="day">${head}<table>${meals}${lines}</table></section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 36px 40px; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c1b19; font-size: 11px; line-height: 1.4; }
  .brand { display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; color: #3a3733; text-transform: lowercase; }
  .brand .right { color: #6e5a3e; }
  h1 { font-size: 24px; margin: 14px 0 4px; text-transform: lowercase; letter-spacing: -0.3px; }
  .meta { color: #3a3733; margin: 2px 0; }
  .summary { display: flex; gap: 18px; background: #f6f2ea; border-radius: 8px; padding: 10px 14px; margin: 12px 0 16px; }
  .summary div { display: flex; flex-direction: column; }
  .summary b { font-size: 16px; }
  .summary span { color: #3a3733; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
  .extras { margin: -6px 0 14px; }
  .extras td { padding: 3px 6px 3px 0; }
  .day { border-top: 1px solid #dccbb0; padding: 8px 0 6px; page-break-inside: avoid; }
  .day-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
  .date { font-weight: 700; font-size: 12.5px; }
  .plan { color: #6e5a3e; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 6px 2px 0; vertical-align: top; }
  td.meal { width: 120px; font-weight: 600; }
  td.status { width: 90px; }
  tr.muted td { color: #8c877e; }
  .nothing { margin: 2px 0 0; color: #3a3733; font-style: italic; }
  .footer { margin-top: 18px; color: #3a3733; font-size: 9.5px; border-top: 1px solid #dccbb0; padding-top: 8px; }
  </style></head><body>
  <div class="brand"><span>${esc(CLINIC_NAME.toLowerCase())}</span><span class="right">${esc(APP_NAME.toLowerCase())}</span></div>
  <h1>${esc(r.title)}</h1>
  ${r.patientName ? `<p class="meta">${esc(r.patientName)}</p>` : ''}
  <p class="meta">${esc(r.rangeLabel)}${r.planLine ? ` · ${esc(r.planLine)}` : ''}</p>
  <div class="summary">
    <div><b>${s.daysLogged} of ${s.days}</b><span>days logged</span></div>
    <div><b>${s.followed}</b><span>followed</span></div>
    <div><b>${s.substituted}</b><span>substituted</span></div>
    <div><b>${s.skipped}</b><span>skipped</span></div>
  </div>
  ${r.extras.length ? `<table class="extras">${r.extras.map((x) => `<tr><td class="meal">${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`).join('')}</table>` : ''}
  ${days}
  <p class="footer">Shared by the patient from the ${esc(APP_NAME)} app. Portions only; no calories or macros are tracked.</p>
  </body></html>`;
}
