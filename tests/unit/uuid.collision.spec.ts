import { describe, it, expect } from 'vitest';
import { safeRandomUUID } from '../../src/lib/uuid';

// Not a cryptographic audit — just a sanity uniqueness check to guard accidental regression.
// Generates N UUIDs via current implementation path (preferring crypto APIs if present)
// and asserts high uniqueness ratio.

describe('safeRandomUUID uniqueness (sanity)', () => {
  it('generates mostly unique values for 50k samples', () => {
    const N = 50_000;
    const set = new Set<string>();
    for (let i = 0; i < N; i++) {
      set.add(safeRandomUUID());
    }
    const uniqueRatio = set.size / N;
    // Allow extremely tiny collision rate (<0.01%) just to avoid flakiness on exotic environments.
    expect(uniqueRatio).toBeGreaterThan(0.9999);
  });
});
