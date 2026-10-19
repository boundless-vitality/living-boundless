// Turns the report model into a printable HTML page (expo-print makes the PDF on the phone).
// Layout: at a glance → supplements → everything else → day-by-day grid → daily detail.
import { APP_NAME, CLINIC_NAME, type GridCell, type ReportModel } from '@lb/shared';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

const CELL_TITLE: Record<GridCell, string> = {
  full: 'every meal logged',
  partial: 'part of the day logged',
  yes: 'yes',
  no: 'not taken / not logged that day',
  drank: 'had alcohol',
  dry: 'no alcohol',
  none: 'nothing logged',
  na: 'not in plan',
};

const STATUS_CLASS: Record<string, string> = { Followed: 'followed', Substituted: 'substituted', Skipped: 'skipped', 'Not logged': 'notlogged' };

export function reportHtml(r: ReportModel): string {
  const s = r.summary;
  const meals = s.followed + s.substituted + s.skipped;

  const tiles = `
  <div class="tiles">
    <div class="tile"><b>${s.daysLogged}<small> of ${s.days}</small></b><span>days logged</span><em>${pct(s.daysLogged, s.days)}%</em></div>
    <div class="tile"><b>${s.followed}</b><span>meals followed</span><em>${pct(s.followed, meals)}% of logged meals</em></div>
    <div class="tile"><b>${s.substituted}</b><span>substituted</span><em>${pct(s.substituted, meals)}%</em></div>
    <div class="tile"><b>${s.skipped}</b><span>skipped</span><em>${pct(s.skipped, meals)}%</em></div>
  </div>`;

  const supplements = r.supplements.length
    ? `<h2>supplements</h2>
  <table class="supp">${r.supplements
    .map(
      (x) => `<tr>
      <td class="sname"><b>${esc(x.name)}</b>${x.detail ? `<div class="sub">${esc(x.detail)}</div>` : ''}</td>
      <td class="sbar"><div class="bar"><div class="fill" style="width:${pct(x.taken, x.of)}%"></div></div></td>
      <td class="scount"><b>${x.taken} of ${x.of} days</b>${x.pattern ? `<div class="pattern">${esc(x.pattern)}</div>` : ''}</td>
    </tr>`,
    )
    .join('')}</table>
  <p class="hint">Counts days the patient logged anything. Days with nothing logged aren't counted as missed.</p>`
    : '';

  const extras = r.extras.length
    ? `<h2>everything else</h2><table class="extras">${r.extras.map((x) => `<tr><td class="label">${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`).join('')}</table>`
    : '';

  const grid = r.grid
    ? `<h2>day by day</h2>
  <table class="grid">
    <tr><th></th>${r.grid.columns.map((c) => `<th><div class="wd">${c.weekday}</div>${c.day}</th>`).join('')}</tr>
    ${r.grid.rows
      .map((row) => `<tr><td class="rlabel">${esc(row.label)}</td>${row.cells.map((c) => `<td><span class="cell ${c}" title="${CELL_TITLE[c]}"></span></td>`).join('')}</tr>`)
      .join('')}
  </table>
  <div class="legend">
    <span><span class="cell full"></span> every meal / yes</span>
    <span><span class="cell partial"></span> part of the day</span>
    <span><span class="cell no"></span> logged, but not this</span>
    <span><span class="cell drank"></span> had alcohol</span>
    <span><span class="cell none"></span> nothing logged</span>
    <span><span class="cell na"></span> not in plan</span>
  </div>`
    : '';

  const days = r.days
    .map((d) => {
      const head = `<div class="day-head"><span class="date">${esc(d.dateLabel)}</span>${d.dayPlanName ? `<span class="plan">${esc(d.dayPlanName)}</span>` : ''}</div>`;
      if (d.empty) {
        return `<section class="day empty">${head}<p class="nothing">${d.beforePlan ? 'Before the plan started. Nothing logged.' : 'Nothing logged this day.'}</p></section>`;
      }
      const mealRows = d.meals
        .map((m) => `<tr><td class="meal">${esc(m.label)}</td><td class="status"><span class="pill ${STATUS_CLASS[m.status] ?? ''}">${esc(m.status)}</span></td><td>${m.detail ? esc(m.detail) : ''}</td></tr>`)
        .join('');
      const supp = d.supplements.length
        ? `<tr><td class="meal">Supplements</td><td colspan="2">${d.supplements
            .map((x) => `<span class="supp-chip ${x.taken ? 'took' : 'missed'}">${x.taken ? '✓' : '✗'} ${esc(x.name)}</span>`)
            .join(' ')}</td></tr>`
        : '';
      const lines = d.lines.map((l) => `<tr><td class="meal">${esc(l.label)}</td><td colspan="2">${esc(l.value)}</td></tr>`).join('');
      return `<section class="day">${head}<table>${mealRows}${supp}${lines}</table></section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { margin: 34px 38px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c1b19; font-size: 10.5px; line-height: 1.4; margin: 0; }
  .brand { display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5px; color: #3a3733; text-transform: lowercase; }
  .brand .right { color: #6e5a3e; }
  h1 { font-size: 24px; margin: 12px 0 2px; text-transform: lowercase; letter-spacing: -0.3px; }
  h2 { font-size: 13px; text-transform: lowercase; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #9aa885; }
  .meta { color: #3a3733; margin: 1px 0; }
  .tiles { display: flex; gap: 8px; margin: 12px 0 4px; }
  .tile { flex: 1; background: #f6f2ea; border-radius: 8px; padding: 9px 11px; display: flex; flex-direction: column; }
  .tile b { font-size: 18px; } .tile small { font-size: 11px; font-weight: 600; color: #3a3733; }
  .tile span { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #3a3733; }
  .tile em { font-style: normal; color: #5f6b3a; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .supp td { padding: 5px 6px 5px 0; border-bottom: 1px solid #efe7d9; vertical-align: middle; }
  .sname { width: 38%; } .sub { color: #3a3733; font-size: 9.5px; }
  .sbar { width: 34%; } .scount { width: 28%; }
  .bar { height: 8px; border-radius: 4px; background: #e7dcc8; overflow: hidden; } .fill { height: 8px; background: #6b7a52; }
  .pattern { color: #6e5a3e; font-size: 9.5px; font-weight: 600; }
  .hint { color: #3a3733; font-size: 9px; margin: 4px 0 0; }
  .extras td { padding: 3px 6px 3px 0; } .extras td.label { width: 110px; font-weight: 600; }
  .grid { table-layout: fixed; } .grid th { font-size: 8.5px; font-weight: 600; color: #3a3733; text-align: center; padding-bottom: 2px; }
  .grid .wd { font-size: 7.5px; color: #8c877e; }
  .grid td { text-align: center; padding: 1.5px 0; } .grid td.rlabel { text-align: left; width: 140px; font-weight: 600; font-size: 9px; padding-right: 6px; line-height: 1.15; }
  .cell { display: inline-block; width: 11px; height: 11px; border-radius: 3px; vertical-align: middle; }
  .cell.full, .cell.yes { background: #6b7a52; } .cell.partial { background: #c9d2b8; } .cell.no { background: #dccbb0; }
  .cell.drank { background: #6e5a3e; } .cell.dry { background: #c9d2b8; } .cell.none { background: #fff; border: 1px solid #dccbb0; }
  .cell.na { background: repeating-linear-gradient(45deg, #f1ece2, #f1ece2 2px, #fff 2px, #fff 4px); border: 1px solid #efe7d9; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 6px; color: #3a3733; font-size: 9px; } .legend .cell { width: 9px; height: 9px; margin-right: 3px; }
  .day { border: 1px solid #e7dcc8; border-radius: 8px; padding: 8px 10px; margin: 0 0 8px; page-break-inside: avoid; }
  .day.empty { background: #faf7f0; }
  .day-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
  .date { font-weight: 700; font-size: 12px; } .plan { color: #6e5a3e; font-weight: 600; }
  .day td { padding: 2px 6px 2px 0; } .day td.meal { width: 105px; font-weight: 600; } .day td.status { width: 92px; }
  .pill { display: inline-block; border-radius: 999px; padding: 0 7px; font-size: 9.5px; font-weight: 600; }
  .pill.followed { background: #6b7a52; color: #fff; } .pill.substituted { background: #dccbb0; color: #1c1b19; }
  .pill.skipped { background: #e7dcc8; color: #3a3733; } .pill.notlogged { border: 1px solid #dccbb0; color: #8c877e; }
  .supp-chip { display: inline-block; border-radius: 999px; padding: 0 7px; font-size: 9.5px; margin: 0 3px 2px 0; }
  .supp-chip.took { background: #e3e8d9; color: #1c1b19; } .supp-chip.missed { border: 1px solid #dccbb0; color: #6e5a3e; }
  .nothing { margin: 0; color: #3a3733; font-style: italic; }
  .footer { margin-top: 14px; color: #3a3733; font-size: 9px; border-top: 1px solid #dccbb0; padding-top: 6px; }
  </style></head><body>
  <div class="brand"><span>${esc(CLINIC_NAME.toLowerCase())}</span><span class="right">${esc(APP_NAME.toLowerCase())}</span></div>
  <h1>${esc(r.title)}</h1>
  ${r.patientName ? `<p class="meta"><b>${esc(r.patientName)}</b></p>` : ''}
  <p class="meta">${esc(r.rangeLabel)}${r.planLine ? ` · ${esc(r.planLine)}` : ''}</p>
  ${tiles}
  ${supplements}
  ${extras}
  ${grid}
  <h2>daily detail</h2>
  ${days}
  <p class="footer">Shared by the patient from the ${esc(APP_NAME)} app. Portions only; no calories or macros are tracked.</p>
  </body></html>`;
}
