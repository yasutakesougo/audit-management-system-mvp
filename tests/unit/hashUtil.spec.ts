import { describe, it, expect } from 'vitest';
import { canonicalJSONStringify, computeEntryHash } from '@/lib/hashUtil';

describe('hashUtil canonicalization', () => {
  it('canonicalJSONStringify stable for different key orders', () => {
    const a = { z: 1, a: { b: 2, a: 1 } };
    const b = { a: { a: 1, b: 2 }, z: 1 };
    expect(canonicalJSONStringify(a)).toEqual(canonicalJSONStringify(b));
  });

  it('computeEntryHash same for deep equal payload and different when field changes', async () => {
    const base = {
      ts: '2025-01-01T00:00:00.000Z',
      actor: 'user1',
      action: 'CREATE',
      entity: 'Record',
      entity_id: '123',
      after_json: JSON.stringify({ value: 1 })
    };
    const h1 = await computeEntryHash(base);
    const h2 = await computeEntryHash({ ...base });
    const h3 = await computeEntryHash({ ...base, after_json: JSON.stringify({ value: 2 }) });
    expect(h1).toEqual(h2);
    expect(h1).not.toEqual(h3);
  });
});
