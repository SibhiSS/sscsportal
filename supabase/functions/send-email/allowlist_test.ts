function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + `assertEquals failed:\n  actual:   ${actual}\n  expected: ${expected}`);
  }
}

import { isAllowedRecipient, parseList } from './allowlist.ts';

const DOMAINS = ['vitstudent.ac.in', 'vit.ac.in'];
const ADDRESSES = ['ieee.sscs.vitchennai@gmail.com'];

Deno.test('allows an address on an allowed domain', () => {
  assertEquals(isAllowedRecipient('someone@vitstudent.ac.in', DOMAINS, ADDRESSES), true);
});

Deno.test('allows case-insensitively', () => {
  assertEquals(isAllowedRecipient('Someone@VITSTUDENT.AC.IN', DOMAINS, ADDRESSES), true);
});

Deno.test('allows an exact allowed address on a domain not otherwise allowed', () => {
  assertEquals(isAllowedRecipient('ieee.sscs.vitchennai@gmail.com', DOMAINS, ADDRESSES), true);
});

Deno.test('rejects an arbitrary external address — the anti-open-relay check', () => {
  assertEquals(isAllowedRecipient('victim@example.com', DOMAINS, ADDRESSES), false);
});

Deno.test('rejects a lookalike domain (suffix match must not count)', () => {
  // "evil-vitstudent.ac.in" or "vitstudent.ac.in.evil.com" must not pass —
  // only an exact domain match after the @ is acceptable.
  assertEquals(isAllowedRecipient('x@evil-vitstudent.ac.in', DOMAINS, ADDRESSES), false);
  assertEquals(isAllowedRecipient('x@vitstudent.ac.in.evil.com', DOMAINS, ADDRESSES), false);
});

Deno.test('rejects malformed input without throwing', () => {
  assertEquals(isAllowedRecipient('', DOMAINS, ADDRESSES), false);
  assertEquals(isAllowedRecipient(undefined, DOMAINS, ADDRESSES), false);
  assertEquals(isAllowedRecipient(null, DOMAINS, ADDRESSES), false);
  assertEquals(isAllowedRecipient('not-an-email', DOMAINS, ADDRESSES), false);
});

Deno.test('an empty configured list allows nothing (fail closed, not fail open)', () => {
  assertEquals(isAllowedRecipient('someone@vitstudent.ac.in', [], []), false);
});

Deno.test('parseList splits, trims, lowercases, and drops empties', () => {
  assertEquals(
    parseList(' vitstudent.ac.in, VIT.AC.IN ,,').join('|'),
    ['vitstudent.ac.in', 'vit.ac.in'].join('|'),
  );
});

Deno.test('parseList of undefined is an empty list, not a throw', () => {
  assertEquals(parseList(undefined).length, 0);
});
