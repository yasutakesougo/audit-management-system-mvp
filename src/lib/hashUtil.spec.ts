import { describe, it, expect } from 'vitest';
import { canonicalJSONStringify, computeEntryHash } from './hashUtil';

describe('canonicalJSONStringify', () => {
  it('produces same string for different key orders', () => {
    const a = { b: 2, a: 1, z: { k: 1, j: 2 } };
    const b = { z: { j: 2, k: 1 }, a: 1, b: 2 };
    expect(canonicalJSONStringify(a)).toEqual(canonicalJSONStringify(b));
  });
  it('distinguishes different values', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 1, b: 3 };
    expect(canonicalJSONStringify(a)).not.toEqual(canonicalJSONStringify(b));
  });
  it('is stable with arrays (order matters inside arrays)', () => {
    const a = { arr: [1, 2, 3] };
    const b = { arr: [1, 3, 2] };
    expect(canonicalJSONStringify(a)).not.toEqual(canonicalJSONStringify(b));
  });
});

describe('computeEntryHash', () => {
  it('same logical payload yields same hash regardless of key order', async () => {
    const base = {
      ts: '2025-09-23T01:02:03.000Z',
      actor: 'user@tenant',
      action: 'CREATE_SUCCESS',
      entity: 'SupportRecord_Daily',
      entity_id: '42',
      after_json: canonicalJSONStringify({ x: 1, y: { b: 2, a: 1 } }),
    };
    const v1 = await computeEntryHash(base);
    const v2 = await computeEntryHash({
      action: base.action,
      entity_id: base.entity_id,
      ts: base.ts,
      entity: base.entity,
      after_json: canonicalJSONStringify({ y: { a: 1, b: 2 }, x: 1 }),
      actor: base.actor,
    });
    expect(v1).toEqual(v2);
  });
  it('different payload yields different hash', async () => {
    const a = await computeEntryHash({
      ts: '2025-09-23T01:02:03.000Z', actor: 'u', action: 'A', entity: 'E', entity_id: '1', after_json: '{"x":1}'
    });
    const b = await computeEntryHash({
      ts: '2025-09-23T01:02:03.000Z', actor: 'u', action: 'A', entity: 'E', entity_id: '2', after_json: '{"x":1}'
    });
    expect(a).not.toEqual(b);
  });
});
