// The chart PDF, built entirely in the browser. Reads cleanly for a scribe:
// header, schedule in words, each day plan's meals, extras, notes, then the QR.
import fontkit from '@pdf-lib/fontkit';
import {
  APP_NAME, CLINIC_NAME, TAG_LABEL, describeComponent, describeItem, describeSchedule, formatMedium, formatShort, formatWindow,
  hasSchedule, planCode, sortMeals,
} from '@lb/shared';
import type { Plan } from '@lb/shared';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { FONT_URLS } from './fonts';

const W = 612;
const H = 792;
const M = 50;
const BOTTOM = M + 22;
const INK = rgb(0.11, 0.106, 0.098); // off-black
const SOFT = rgb(0.227, 0.215, 0.2); // charcoal
const BRONZE = rgb(0.43, 0.353, 0.243);
const RULE = rgb(0.86, 0.8, 0.69); // sand
const SAGE = rgb(0.604, 0.659, 0.522);

interface Fonts { head: PDFFont; body: PDFFont; semi: PDFFont; italic: PDFFont }
interface Style { font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lead?: number }

async function fetchBytes(url: string) {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

class Layout {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  private charsets = new Map<PDFFont, Set<number>>();
  constructor(private doc: PDFDocument) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.pages.push(this.page);
    this.y = H - M;
  }

  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  /** Drop characters the font can't draw (e.g. emoji) instead of failing. */
  clean(s: string, font: PDFFont): string {
    let set = this.charsets.get(font);
    if (!set) {
      set = new Set(font.getCharacterSet());
      this.charsets.set(font, set);
    }
    return [...s.replace(/\t/g, ' ')].filter((ch) => set!.has(ch.codePointAt(0)!)).join('');
  }

  wrap(text: string, st: Style, width: number): string[] {
    const out: string[] = [];
    for (const para of this.clean(text, st.font).split('\n')) {
      const words = para.split(/ +/);
      let line = '';
      for (const w of words) {
        const tryLine = line ? `${line} ${w}` : w;
        if (st.font.widthOfTextAtSize(tryLine, st.size) <= width || !line) line = tryLine;
        else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }

  lead(st: Style) {
    return st.lead ?? st.size * 1.32;
  }

  height(text: string, st: Style, width: number) {
    return this.wrap(text, st, width).length * this.lead(st);
  }

  text(text: string, st: Style, x = M, width = W - 2 * M) {
    for (const line of this.wrap(text, st, width)) {
      this.ensure(this.lead(st));
      this.page.drawText(line, { x, y: this.y - st.size, size: st.size, font: st.font, color: st.color ?? INK });
      this.y -= this.lead(st);
    }
  }

  /** Draw at a fixed y without moving the cursor. */
  at(text: string, st: Style, x: number, y: number) {
    this.page.drawText(this.clean(text, st.font), { x, y: y - st.size, size: st.size, font: st.font, color: st.color ?? INK });
  }

  rule(color = RULE, gap = 8) {
    this.y -= gap;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.75, color });
    this.y -= gap;
  }

  space(n: number) {
    this.y -= n;
  }
}

export async function buildPlanPdf(plan: Plan, link: string, patientName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // pdf-lib's font subsetting loses Source Sans 3 glyphs, so only League Spartan is subset.
  // Ligatures are off because pdf-lib drops ligature glyphs ("aft er").
  const [head, body, semi, italic] = await Promise.all(
    [FONT_URLS.leagueBold, FONT_URLS.sansRegular, FONT_URLS.sansSemi, FONT_URLS.sansItalic].map(async (u, i) =>
      doc.embedFont(await fetchBytes(u), { subset: i === 0, features: { liga: false, clig: false, dlig: false } }),
    ),
  );
  const f: Fonts = { head, body, semi, italic };
  const code = planCode(plan.id);
  const name = patientName.trim();
  doc.setTitle(`${plan.title} (v${plan.version})`);
  doc.setCreator(`${APP_NAME} plan builder`);
  doc.setProducer(APP_NAME);

  const L = new Layout(doc);
  const h1: Style = { font: f.head, size: 24, lead: 28 };
  const h2: Style = { font: f.head, size: 14, lead: 20, color: INK };
  const bodyS: Style = { font: f.body, size: 10.5, lead: 14 };
  const noteS: Style = { font: f.italic, size: 9.5, lead: 12.5, color: SOFT };
  const labelS: Style = { font: f.semi, size: 10.5, lead: 14 };
  const metaS: Style = { font: f.body, size: 10, lead: 14, color: SOFT };

  // Header
  L.at(CLINIC_NAME.toLowerCase(), { font: f.head, size: 11, color: SOFT }, M, L.y);
  const right = 'nutrition plan';
  L.at(right, { font: f.head, size: 11, color: BRONZE }, W - M - f.head.widthOfTextAtSize(right, 11), L.y);
  L.space(26);
  L.text(plan.title.toLowerCase(), h1);
  L.space(4);
  const meta = [
    name ? `Patient: ${name}` : 'Patient: ____________________',
    `Prescribed: ${formatMedium(plan.issuedAt)}`,
    `Version ${plan.version}`,
    `Plan code: ${code}`,
  ].join('   ·   ');
  L.text(meta, metaS);
  L.text(`Starts ${formatShort(plan.startDate)}, ${plan.startDate.slice(0, 4)}`, metaS);
  L.rule(SAGE, 10);

  // Schedule
  L.text('schedule', h2);
  if (hasSchedule(plan)) for (const line of describeSchedule(plan)) L.text(line, bodyS);
  else L.text(`Same plan every day: ${plan.dayPlans.find((d) => d.id === (plan.schedule as { dayPlanId: number }).dayPlanId)?.name ?? ''}`, bodyS);
  L.space(10);

  // Day plans
  const TIME_W = 92;
  const CONTENT_W = W - 2 * M - TIME_W;
  for (const day of plan.dayPlans) {
    L.ensure(60);
    L.text(day.name.toLowerCase(), h2);
    L.space(2);
    for (const meal of sortMeals(day.meals)) {
      const lines: [string, Style][] = [];
      lines.push([meal.label + (meal.tag ? `  (${TAG_LABEL[meal.tag]})` : ''), labelS]);
      for (const c of meal.components) {
        const t = describeComponent(c);
        lines.push([`•  ${t.main}${t.sub ? ` — ${t.sub}` : ''}`, bodyS]);
      }
      for (const it of meal.items) lines.push([`•  ${describeItem(it)}`, bodyS]);
      if (meal.note) lines.push([meal.note, noteS]);
      const blockH = lines.reduce((sum, [t, st]) => sum + L.height(t, st, CONTENT_W), 0) + 8;
      L.ensure(blockH);
      L.at(formatWindow(meal.start, meal.end), { font: f.body, size: 10, color: SOFT }, M, L.y - 0.5);
      for (const [t, st] of lines) L.text(t, st, M + TIME_W, CONTENT_W);
      L.space(4);
      L.page.drawLine({ start: { x: M + TIME_W, y: L.y }, end: { x: W - M, y: L.y }, thickness: 0.4, color: RULE });
      L.space(6);
    }
    L.space(8);
  }

  // Post-workout carbs
  if (plan.postWorkoutCarbs) {
    const w = plan.postWorkoutCarbs;
    L.ensure(50);
    L.text('post-workout carbs', h2);
    L.text(`${w.grams} g carbs — ${w.foods}`, bodyS);
    if (w.note) L.text(w.note, noteS);
    L.space(10);
  }

  // Supplements
  if (plan.supplements.length) {
    L.ensure(50);
    L.text('supplements', h2);
    for (const s of plan.supplements) L.text(`•  ${[s.name, s.dose, s.timing].filter(Boolean).join(' — ')}`, bodyS);
    L.space(10);
  }

  // Tracking extras (so the chart shows what the patient was asked to track)
  const extras = [
    plan.features.water ? `water (${plan.features.waterGoal ?? '—'} glasses/day)` : '',
    plan.features.alcohol ? 'alcohol' : '',
    plan.features.checkIn ? 'daily check-in' : '',
  ].filter(Boolean);
  if (extras.length) {
    L.ensure(36);
    L.text('tracking', h2);
    L.text(`Patient tracks: ${extras.join(', ')}.`, bodyS);
    L.space(10);
  }

  // Notes
  if (plan.notes?.trim()) {
    L.ensure(50);
    L.text('notes', h2);
    L.text(plan.notes.trim(), bodyS);
    L.space(10);
  }

  // QR, large, on the last page
  const QR = 250;
  L.ensure(QR + 70);
  L.rule(SAGE, 10);
  L.text('add this plan in the app', h2);
  L.text(`Open ${APP_NAME} → Add plan → Scan QR. Plan code ${code}, version ${plan.version}.`, metaS);
  L.space(8);
  const png = await QRCode.toDataURL(link, { errorCorrectionLevel: 'L', margin: 2, scale: 8, color: { dark: '#1c1b19', light: '#ffffff' } });
  const img = await doc.embedPng(png);
  L.page.drawImage(img, { x: (W - QR) / 2, y: L.y - QR, width: QR, height: QR });
  L.space(QR);

  // Footers
  const total = L.pages.length;
  L.pages.forEach((p, i) => {
    const left = [name || null, plan.title, `v${plan.version}`, code].filter(Boolean).join('  ·  ');
    const pageText = `Page ${i + 1} of ${total}`;
    p.drawText(L.clean(left, f.body), { x: M, y: M - 8, size: 8, font: f.body, color: SOFT });
    p.drawText(pageText, { x: W - M - f.body.widthOfTextAtSize(pageText, 8), y: M - 8, size: 8, font: f.body, color: SOFT });
  });

  return doc.save();
}

export function pdfFilename(plan: Plan, patientName: string): string {
  const safe = (s: string) => s.trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return [safe(patientName), 'nutrition-plan', `v${plan.version}`, planCode(plan.id)].filter(Boolean).join('_') + '.pdf';
}
