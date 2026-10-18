// Plan ⇄ link. JSON → deflate (with a preset dictionary) → base64url, carried
// after the '#' so it is never sent to a web server.
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { PLAN_LINK_BASE } from './config';
import { DICTIONARY } from './dictionary';
import type { Plan } from './types';
import { validatePlan } from './validate';
import { fromWire, toWire } from './wire';

/** Bump when the wire layout or dictionary changes. Old formats must stay decodable. */
export const FORMAT = 1;

const DICT = strToU8(DICTIONARY);
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP = new Map([...B64].map((c, i) => [c, i]));

export function toBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64[c & 63];
  }
  return out;
}

export function fromBase64Url(s: string): Uint8Array {
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64_LOOKUP.get(s[i + k]) : 0));
    if (n.some((x) => x === undefined)) throw new Error('bad base64');
    const [a, b, c, d] = n as number[];
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < s.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < s.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/** "p1.<base64url>" — the part after '#'. */
export function encodePlan(plan: Plan): string {
  const json = JSON.stringify(toWire(plan));
  const packed = deflateSync(strToU8(json), { level: 9, dictionary: DICT });
  return `p${FORMAT}.${toBase64Url(packed)}`;
}

export function planLink(plan: Plan, base: string = PLAN_LINK_BASE): string {
  return `${base}#${encodePlan(plan)}`;
}

export type DecodeResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: 'notAPlan' | 'damaged' | 'newerFormat'; message: string };

const MESSAGES = {
  notAPlan: "That doesn't look like a plan link. Try copying the whole link again.",
  damaged: "This plan link seems to be cut off or damaged. Try copying the whole link again, or ask your provider to resend it.",
  newerFormat: 'This plan was made with a newer version of the app. Please update the app, then try again.',
} as const;

const fail = (reason: keyof typeof MESSAGES): DecodeResult => ({ ok: false, reason, message: MESSAGES[reason] });

/**
 * Accepts a full link, a bare "p1.…" payload, or text with a link inside it.
 * Messaging apps sometimes add line breaks to long links, so whitespace is ignored.
 */
export function decodePlanLink(text: string): DecodeResult {
  const raw = text ?? '';
  // First as-is (a link inside a longer message), then with whitespace removed
  // (a long link that got wrapped onto several lines).
  const first = decodeCandidate(raw);
  if (first.ok || first.reason === 'newerFormat') return first;
  const second = decodeCandidate(raw.replace(/\s+/g, ''));
  if (second.ok) return second;
  return first.reason === 'notAPlan' ? second : first;
}

const PAYLOAD_RE = /(?:^|#)p(\d+)\.([A-Za-z0-9_-]+)/;

function decodeCandidate(text: string): DecodeResult {
  // Prefer the token after a '#'; fall back to a bare payload at the start.
  const trimmed = text.trim();
  const m = /#p(\d+)\.([A-Za-z0-9_-]+)/.exec(trimmed) ?? PAYLOAD_RE.exec(trimmed);
  if (!m) return fail('notAPlan');
  const format = Number(m[1]);
  if (format > FORMAT) return fail('newerFormat');
  if (format !== 1) return fail('notAPlan');
  let plan: Plan;
  try {
    const bytes = inflateSync(fromBase64Url(m[2]), { dictionary: DICT });
    plan = fromWire(JSON.parse(strFromU8(bytes)));
  } catch {
    return fail('damaged');
  }
  if (validatePlan(plan).length) return fail('damaged');
  return { ok: true, plan };
}
