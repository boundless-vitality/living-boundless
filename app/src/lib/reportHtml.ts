// Turns the report model into a printable HTML page (expo-print makes the PDF on the phone).
// Layout: at a glance → supplements → everything else → day-by-day grid, then daily
// detail starting on a fresh page. Colors are forced on: iOS drops backgrounds when
// printing unless told otherwise.
import { APP_NAME, CLINIC_NAME, type GridCell, type ReportModel } from '@lb/shared';

/** Page margins in points, passed to expo-print (iOS ignores CSS @page margins). */
export const REPORT_MARGINS = { top: 40, bottom: 40, left: 36, right: 36 };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

const CELL_SYMBOL: Record<GridCell, string> = {
  full: '✓',
  yes: '✓',
  partial: '◐',
  no: '✗',
  drank: '●',
  dry: '',
  none: '',
  na: '',
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
    ? `<div class="block"><h2>supplements</h2>
  <table class="supp">${r.supplements
    .map(
      (x) => `<tr>
      <td class="sname"><b>${esc(x.name)}</b>${x.detail ? `<div class="sub">${esc(x.detail)}</div>` : ''}</td>
      <td class="sbar"><div class="bar"><div class="fill" style="width:${pct(x.taken, x.of)}%"></div></div></td>
      <td class="scount"><b>${x.taken} of ${x.of} days</b> <span class="pct">${pct(x.taken, x.of)}%</span>${x.pattern ? `<div class="pattern">${esc(x.pattern)}</div>` : ''}</td>
    </tr>`,
    )
    .join('')}</table>
  <p class="hint">Out of days the patient logged anything. Days with nothing logged aren't counted as missed.</p></div>`
    : '';

  const extras = r.extras.length
    ? `<div class="block"><h2>everything else</h2><table class="extras">${r.extras.map((x) => `<tr><td class="label">${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`).join('')}</table></div>`
    : '';

  const grid = r.grid
    ? `<div class="block"><h2>day by day</h2>
  <table class="grid">
    <tr><th class="rlabel"></th>${r.grid.columns.map((c) => `<th><div class="wd">${c.weekday}</div>${c.day}</th>`).join('')}</tr>
    ${r.grid.rows
      .map((row) => `<tr><td class="rlabel">${esc(row.label)}</td>${row.cells.map((c) => `<td><span class="cell ${c}">${CELL_SYMBOL[c]}</span></td>`).join('')}</tr>`)
      .join('')}
  </table>
  <div class="legend">
    <span><span class="cell full">✓</span> every meal / done</span>
    <span><span class="cell partial">◐</span> part of the day</span>
    <span><span class="cell no">✗</span> logged that day, but not this</span>
    <span><span class="cell drank">●</span> had alcohol</span>
    <span><span class="cell dry"></span> no alcohol</span>
    <span><span class="cell none"></span> nothing logged</span>
    <span><span class="cell na"></span> not in plan</span>
  </div></div>`
    : '';

  const days = r.days
    .map((d) => {
      const badges = [
        d.badges.allFollowed ? '<span class="badge ok">✓ All meals followed</span>' : '',
        d.badges.trained ? '<span class="badge train">🏋 Trained</span>' : '',
        d.badges.drank ? '<span class="badge drink">🍷 Alcohol</span>' : '',
      ].join('');
      const head = `<div class="day-head"><div><span class="date">${esc(d.dateLabel)}</span>${d.dayPlanName ? `<span class="plan">${esc(d.dayPlanName)}</span>` : ''}</div><div class="badges">${badges}</div></div>`;
      if (d.empty) {
        return `<section class="day empty">${head}<p class="nothing">${d.beforePlan ? 'Before the plan started. Nothing logged.' : 'Nothing logged this day.'}</p></section>`;
      }
      const mealRows = d.meals
        .map(
          (m) =>
            `<tr><td>${esc(m.label)}</td><td><span class="pill ${STATUS_CLASS[m.status] ?? ''}">${esc(m.status)}</span></td><td class="time">${m.time ? esc(m.time) : ''}</td><td>${m.detail ? esc(m.detail) : ''}</td></tr>`,
        )
        .join('');
      const supp = d.supplements.length
        ? `<tr><td>Supplements</td><td colspan="3">${d.supplements.map((x) => `<span class="supp-chip ${x.taken ? 'took' : 'missed'}">${x.taken ? '✓' : '✗'} ${esc(x.name)}</span>`).join('')}</td></tr>`
        : '';
      const lines = d.lines.map((l) => `<tr><td>${esc(l.label)}</td><td colspan="3">${esc(l.value)}</td></tr>`).join('');
      const feel =
        d.energy || d.mood || d.checkIn
          ? `<div class="feel">
          <span class="feel-title">Check-in</span>
          ${d.energy ? `<span class="score">⚡ Energy ${d.energy}/5</span>` : ''}
          ${d.mood ? `<span class="score">☺ Mood ${d.mood}/5</span>` : ''}
          ${(d.checkIn?.tags ?? []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
          ${d.checkIn?.note ? `<div class="note">“${esc(d.checkIn.note)}”</div>` : ''}
        </div>`
          : '';
      return `<section class="day">${head}<table class="detail"><colgroup><col class="c1"><col class="c2"><col class="c3"><col></colgroup>${mealRows}${supp}${lines}</table>${feel}</section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1c1b19; font-size: 10.5px; line-height: 1.4; }
  .brand { display: flex; justify-content: space-between; font-weight: 700; font-size: 10.5px; color: #3a3733; text-transform: lowercase; }
  .brand .right { color: #6e5a3e; }
  h1 { font-size: 24px; margin: 12px 0 2px; text-transform: lowercase; letter-spacing: -0.3px; }
  h2 { font-size: 13px; text-transform: lowercase; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 2px solid #9aa885; page-break-after: avoid; break-after: avoid; }
  .block { margin-top: 18px; page-break-inside: avoid; break-inside: avoid; }
  .meta { color: #3a3733; margin: 1px 0; }
  .tiles { display: flex; gap: 8px; margin: 12px 0 0; }
  .tile { flex: 1; background: #f6f2ea; border: 1px solid #e7dcc8; border-radius: 8px; padding: 9px 11px; display: flex; flex-direction: column; }
  .tile b { font-size: 18px; } .tile small { font-size: 11px; font-weight: 600; color: #3a3733; }
  .tile span { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #3a3733; }
  .tile em { font-style: normal; color: #5f6b3a; font-weight: 700; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { vertical-align: top; }
  .supp td { padding: 6px 8px 6px 0; border-bottom: 1px solid #efe7d9; vertical-align: middle; }
  .sname { width: 36%; } .sub { color: #3a3733; font-size: 9.5px; }
  .sbar { width: 34%; } .scount { width: 30%; } .pct { color: #5f6b3a; font-weight: 700; }
  .bar { height: 9px; border-radius: 5px; background: #e7dcc8; overflow: hidden; } .fill { height: 9px; background: #6b7a52; border-radius: 5px; }
  .pattern { color: #6e5a3e; font-size: 9.5px; font-weight: 700; }
  .hint { color: #3a3733; font-size: 9px; margin: 4px 0 0; }
  .extras td { padding: 3px 6px 3px 0; } .extras td.label { width: 110px; font-weight: 700; }
  .grid { table-layout: fixed; }
  .grid th { font-size: 8.5px; font-weight: 700; color: #3a3733; text-align: center; padding-bottom: 3px; }
  .grid .wd { font-size: 7.5px; color: #8c877e; font-weight: 600; }
  .grid td { text-align: center; padding: 2px 0; border-top: 1px solid #f3eee4; }
  .grid .rlabel { text-align: left; width: 120px; font-weight: 700; font-size: 9px; padding-right: 6px; line-height: 1.15; }
  .cell { display: inline-block; width: 14px; height: 14px; line-height: 14px; border-radius: 4px; font-size: 9px; font-weight: 700; text-align: center; vertical-align: middle; }
  .cell.full, .cell.yes { background: #6b7a52; color: #fff; }
  .cell.partial { background: #c9d2b8; color: #3a4a28; }
  .cell.no { background: #ead8c4; color: #8a4b2e; }
  .cell.drank { background: #6e5a3e; color: #fff; }
  .cell.dry { background: #e3e8d9; }
  .cell.none { background: #fff; border: 1px solid #dccbb0; }
  .cell.na { background: #f1ece2; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; color: #3a3733; font-size: 9px; align-items: center; }
  .legend .cell { width: 12px; height: 12px; line-height: 12px; font-size: 8px; margin-right: 3px; }
  .daily { page-break-before: always; break-before: page; }
  .day { border: 1px solid #e7dcc8; border-radius: 8px; padding: 9px 11px; margin: 0 0 10px; page-break-inside: avoid; break-inside: avoid; }
  .day.empty { background: #faf7f0; }
  .day-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 6px; }
  .date { font-weight: 700; font-size: 12px; } .plan { color: #6e5a3e; font-weight: 700; margin-left: 8px; }
  .badges { display: flex; gap: 5px; }
  .badge { border-radius: 999px; padding: 1px 8px; font-size: 9px; font-weight: 700; white-space: nowrap; }
  .badge.ok { background: #6b7a52; color: #fff; } .badge.train { background: #e3e8d9; color: #3a4a28; } .badge.drink { background: #ead8c4; color: #6e5a3e; }
  .detail { table-layout: fixed; }
  .detail col.c1 { width: 24%; } .detail col.c2 { width: 17%; } .detail col.c3 { width: 13%; }
  .detail td { padding: 3px 6px 3px 0; border-top: 1px solid #f3eee4; }
  .detail td:first-child { font-weight: 700; }
  .detail td.time { color: #3a3733; white-space: nowrap; }
  .pill { display: inline-block; min-width: 70px; text-align: center; border-radius: 999px; padding: 1px 8px; font-size: 9.5px; font-weight: 700; }
  .pill.followed { background: #6b7a52; color: #fff; }
  .pill.substituted { background: #dccbb0; color: #1c1b19; }
  .pill.skipped { background: #ead8c4; color: #8a4b2e; }
  .pill.notlogged { background: #fff; border: 1px solid #dccbb0; color: #8c877e; }
  .supp-chip { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 9.5px; font-weight: 600; margin: 0 4px 3px 0; }
  .supp-chip.took { background: #6b7a52; color: #fff; } .supp-chip.missed { background: #fff; border: 1px solid #dccbb0; color: #8a4b2e; }
  .feel { margin-top: 7px; background: #f6f2ea; border-left: 3px solid #6e5a3e; border-radius: 6px; padding: 6px 9px; }
  .feel-title { font-weight: 700; margin-right: 8px; }
  .score { display: inline-block; background: #fff; border: 1px solid #dccbb0; border-radius: 999px; padding: 1px 8px; font-weight: 700; margin: 0 4px 3px 0; }
  .tag { display: inline-block; background: #6e5a3e; color: #fff; border-radius: 999px; padding: 1px 8px; font-weight: 600; margin: 0 4px 3px 0; }
  .note { margin-top: 3px; font-style: italic; }
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
  <div class="daily"><h2>daily detail</h2>
  ${days}</div>
  <p class="footer">Shared by the patient from the ${esc(APP_NAME)} app. Portions only; no calories or macros are tracked.</p>
  </body></html>`;
}
