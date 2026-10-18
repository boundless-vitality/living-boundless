// Measures link length and QR density for the sample plans. Run: npm run size
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { planLink } from '../src/codec';
import { carbCyclingPlan, fourWeekPlan, simplePlan } from '../src/fixtures';
import type { Plan } from '../src/types';
import { toWire } from '../src/wire';

function measure(name: string, plan: Plan) {
  const link = planLink(plan);
  const rawJson = JSON.stringify(plan).length;
  const wireJson = JSON.stringify(toWire(plan)).length;
  const qrL = QRCode.create(link, { errorCorrectionLevel: 'L' });
  const qrM = QRCode.create(link, { errorCorrectionLevel: 'M' });
  return { name, rawJson, wireJson, link: link.length, qrL: qrL.version, qrM: qrM.version, modulesM: qrM.modules.size };
}

describe('payload size report', () => {
  it('prints sizes', () => {
    const rows = [measure('simple', simplePlan), measure('carb cycling', carbCyclingPlan), measure('4-week (big)', fourWeekPlan)];
    // eslint-disable-next-line no-console
    console.table(rows);
    // A QR code tops out at version 40. The big plan must fit with room to spare.
    expect(rows[2].qrM).toBeLessThan(40);
  });
});
