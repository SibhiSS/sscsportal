function assertEquals(actual: unknown, expected: unknown, msg?: string): void {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n' : '') + `assertEquals failed:\n  actual:   ${actual}\n  expected: ${expected}`);
  }
}

import { buildDedupeId, validateEnqueueItems, type EnqueueItem } from './queue_logic.ts';

Deno.test('buildDedupeId is deterministic for the same purpose + target', () => {
  const id1 = buildDedupeId('shortlist_notify', 'app-1', undefined);
  const id2 = buildDedupeId('shortlist_notify', 'app-1', undefined);
  assertEquals(id1, id2);
  assertEquals(id1, 'shortlist_notify:app-1');
});

Deno.test('buildDedupeId differs across purposes for the same target', () => {
  const a = buildDedupeId('shortlist_notify', 'app-1', undefined);
  const b = buildDedupeId('publish_selected', 'app-1', undefined);
  if (a === b) throw new Error('different purposes must not collide on the same dedupe id');
});

Deno.test('buildDedupeId falls back to the provided fallback when there is no purpose/target', () => {
  assertEquals(buildDedupeId(undefined, undefined, 'client-generated-id'), 'client-generated-id');
});

Deno.test('buildDedupeId generates something when there is neither a target/purpose nor a fallback', () => {
  const id = buildDedupeId(undefined, undefined, undefined);
  if (!id || id.length < 10) throw new Error('expected a generated id, got: ' + id);
});

const VALID_ITEM: EnqueueItem = {
  to: 'a@vitstudent.ac.in',
  subject: 'Subject',
  html: '<p>hi</p>',
};

Deno.test('validateEnqueueItems accepts a well-formed item with no purpose', () => {
  assertEquals(validateEnqueueItems([VALID_ITEM]).length, 0);
});

Deno.test('validateEnqueueItems accepts a well-formed item with a valid purpose + target', () => {
  const errors = validateEnqueueItems([
    { ...VALID_ITEM, purpose: 'shortlist_notify', targetApplicationId: 'app-1' },
  ]);
  assertEquals(errors.length, 0);
});

Deno.test('validateEnqueueItems rejects a missing "to"', () => {
  const errors = validateEnqueueItems([{ ...VALID_ITEM, to: '' }]);
  assertEquals(errors.length, 1);
  assertEquals(errors[0].index, 0);
});

Deno.test('validateEnqueueItems rejects an unknown purpose', () => {
  // deno-lint-ignore no-explicit-any
  const errors = validateEnqueueItems([{ ...VALID_ITEM, purpose: 'not_a_real_purpose' as any }]);
  if (errors.length === 0) throw new Error('expected an unknown-purpose error');
});

Deno.test('validateEnqueueItems rejects a purpose with no targetApplicationId', () => {
  const errors = validateEnqueueItems([{ ...VALID_ITEM, purpose: 'shortlist_notify' }]);
  if (errors.length === 0) throw new Error('expected a missing-target error');
});

Deno.test('validateEnqueueItems requires assignedPosition specifically for committee_offer', () => {
  const errors = validateEnqueueItems([
    { ...VALID_ITEM, purpose: 'committee_offer', targetApplicationId: 'app-1' },
  ]);
  if (!errors.some((e) => e.reason.includes('assignedPosition'))) {
    throw new Error('expected an assignedPosition error, got: ' + JSON.stringify(errors));
  }
});

Deno.test('validateEnqueueItems does not require assignedPosition for other purposes', () => {
  const errors = validateEnqueueItems([
    { ...VALID_ITEM, purpose: 'position_offer', targetApplicationId: 'app-1' },
  ]);
  assertEquals(errors.length, 0);
});

Deno.test('validateEnqueueItems reports every bad row, not just the first', () => {
  const errors = validateEnqueueItems([
    { ...VALID_ITEM, to: '' },
    VALID_ITEM,
    { ...VALID_ITEM, subject: '' },
  ]);
  const indices = errors.map((e) => e.index).sort();
  assertEquals(indices.join(','), '0,2');
});
