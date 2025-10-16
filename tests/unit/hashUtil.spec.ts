import { canonicalJSONStringify, computeEntryHash } from '@/lib/hashUtil';
import { describe, expect, it } from 'vitest';

describe('hashUtil canonicalization', () => {
  it('canonicalJSONStringify stable for different key orders', () => {
    const a = { z: 1, a: { b: 2, a: 1 } };
    const b = { a: { a: 1, b: 2 }, z: 1 };
    expect(canonicalJSONStringify(a)).toEqual(canonicalJSONStringify(b));
  });

  it('canonicalJSONStringify replaces cycles and repeated references with null', () => {
    const root: { value: number; self?: unknown; list?: unknown[] } = { value: 1 };
    root.self = root;
    const shared = { nested: root };
    root.list = [root, shared];

    const serialized = canonicalJSONStringify(root);

    expect(serialized).toBe('{"list":[null,{"nested":null}],"self":null,"value":1}');
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

  it('computeEntryHash treats missing optional fields as empty strings', async () => {
    const payload = {
      ts: '2025-01-01T00:00:00.000Z',
      actor: 'user1',
      action: 'UPDATE',
      entity: 'Record'
    };

    const withEmpty = {
      ...payload,
      entity_id: '',
      after_json: ''
    };

    await expect(computeEntryHash(payload)).resolves.toEqual(await computeEntryHash(withEmpty));

    const withNulls = {
      ...payload,
      entity_id: null,
      after_json: null
    } as const;

    await expect(computeEntryHash(payload)).resolves.toEqual(await computeEntryHash(withNulls));
  });
});
