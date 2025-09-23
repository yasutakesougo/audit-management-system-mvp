import { describe, it, expect } from 'vitest';
import { computeEntryHash, canonicalJSONStringify } from '../../src/lib/hashUtil';

describe('hashUtil deep canonicalization and hash stability', () => {
  it('produces identical hash for deep-equal objects with different key orders', async () => {
    const afterA = { foo: { b: 2, a: 1 }, list: [{ z: 9, y: 8 }, { a: 1 }] };
    const afterB = { list: [{ y: 8, z: 9 }, { a: 1 }], foo: { a: 1, b: 2 } };

    const hashA = await computeEntryHash({
      ts: '2024-01-01T00:00:00.000Z',
      actor: 'user@example.com',
      action: 'test',
      entity: 'X',
      entity_id: '1',
      after_json: canonicalJSONStringify(afterA)
    });

    const hashB = await computeEntryHash({
      ts: '2024-01-01T00:00:00.000Z',
      actor: 'user@example.com',
      action: 'test',
      entity: 'X',
      entity_id: '1',
      after_json: canonicalJSONStringify(afterB)
    });

    expect(hashA).toBe(hashB);
    expect(canonicalJSONStringify(afterA)).toBe(canonicalJSONStringify(afterB));
  });

  it('hash changes when values differ even if structure matches', async () => {
    const base = { foo: { a: 1 }, list: [{ a: 1 }] };
    const diff = { foo: { a: 2 }, list: [{ a: 1 }] };

    const h1 = await computeEntryHash({
      ts: '2024-01-01T00:00:00.000Z',
      actor: 'u',
      action: 'act',
      entity: 'E',
      entity_id: 'id',
      after_json: canonicalJSONStringify(base)
    });
    const h2 = await computeEntryHash({
      ts: '2024-01-01T00:00:00.000Z',
      actor: 'u',
      action: 'act',
      entity: 'E',
      entity_id: 'id',
      after_json: canonicalJSONStringify(diff)
    });

    expect(h1).not.toBe(h2);
  });
});
