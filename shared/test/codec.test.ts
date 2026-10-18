import { describe, expect, it } from 'vitest';
import { decodePlanLink, encodePlan, fromBase64Url, planLink, toBase64Url } from '../src/codec';
import { carbCyclingPlan, fourWeekPlan, simplePlan } from '../src/fixtures';
import type { Plan } from '../src/types';
import { validatePlan } from '../src/validate';

const samples: [string, Plan][] = [
  ['simple', simplePlan],
  ['carb cycling', carbCyclingPlan],
  ['four week', fourWeekPlan],
];

describe('fixtures', () => {
  it.each(samples)('%s plan is valid', (_n, plan) => {
    expect(validatePlan(plan)).toEqual([]);
  });
});

describe('encode/decode round trip', () => {
  it.each(samples)('%s plan survives a round trip exactly', (_n, plan) => {
    const r = decodePlanLink(planLink(plan));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan).toEqual(plan);
  });

  it('keeps a custom title and drops a default one from the payload', () => {
    const custom = { ...simplePlan, title: 'Spring reset' };
    const r = decodePlanLink(encodePlan(custom));
    expect(r.ok && r.plan.title).toBe('Spring reset');
    expect(encodePlan(simplePlan).length).toBeLessThan(encodePlan(custom).length);
  });

  it('round-trips unicode text', () => {
    const p = { ...simplePlan, notes: 'Café con leche ☕ — sí, ½ cup 💚' };
    const r = decodePlanLink(encodePlan(p));
    expect(r.ok && r.plan.notes).toBe(p.notes);
  });

  it('puts the plan after # so it never reaches a server', () => {
    const link = planLink(simplePlan, 'https://example.test/p/');
    expect(link.startsWith('https://example.test/p/#p1.')).toBe(true);
    expect(new URL(link).pathname).toBe('/p/');
  });

  it('never includes a patient name field', () => {
    const json = JSON.stringify(simplePlan);
    expect(json).not.toMatch(/patient|firstName/i);
  });
});

describe('decoding messy input', () => {
  const link = planLink(carbCyclingPlan);

  it('accepts a bare payload', () => {
    expect(decodePlanLink(link.split('#')[1]).ok).toBe(true);
  });

  it('ignores line breaks and spaces a messaging app may add', () => {
    const broken = link.slice(0, 60) + '\n' + link.slice(60, 200) + ' \r\n ' + link.slice(200);
    expect(decodePlanLink(broken).ok).toBe(true);
  });

  it('finds the link inside a longer message', () => {
    expect(decodePlanLink(`Hi! Here's your plan: ${link} See you soon`).ok).toBe(true);
  });

  it('rejects text that is not a plan', () => {
    const r = decodePlanLink('https://boundlessvitality.com');
    expect(r).toMatchObject({ ok: false, reason: 'notAPlan' });
  });

  it('reports a cut-off link as damaged', () => {
    const r = decodePlanLink(link.slice(0, link.length - 40));
    expect(r).toMatchObject({ ok: false, reason: 'damaged' });
  });

  it('reports a newer format as needing an app update', () => {
    const r = decodePlanLink('https://x.test/p/#p9.abcdef');
    expect(r).toMatchObject({ ok: false, reason: 'newerFormat' });
  });

  it('rejects a payload that decodes but fails validation', () => {
    const bad = { ...simplePlan, dayPlans: [] };
    const r = decodePlanLink(encodePlan(bad as Plan));
    expect(r).toMatchObject({ ok: false, reason: 'damaged' });
  });
});

describe('base64url', () => {
  it('round-trips every length mod 3', () => {
    for (let n = 0; n < 20; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 255);
      expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
    }
  });

  it('uses only URL-safe characters', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(toBase64Url(bytes)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
