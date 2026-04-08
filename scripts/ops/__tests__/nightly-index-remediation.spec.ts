// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runNightlyIndexRemediation } from '../nightly-index-remediation';

// ── Mock KNOWN_REQUIRED_INDEXED_FIELDS ─────────────────────────────────────────

vi.mock('@/features/sp/health/indexAdvisor/spIndexKnownConfig', () => ({
  KNOWN_REQUIRED_INDEXED_FIELDS: {
    ListA: [
      { internalName: 'Field1', displayName: 'Field 1', reason: 'test' },
      { internalName: 'Field2', displayName: 'Field 2', reason: 'test' },
    ],
    ListB: [
      { internalName: 'Field3', displayName: 'Field 3', reason: 'test' },
    ],
  },
}));

// ── fetch mock helpers ─────────────────────────────────────────────────────────

const CONFIG = { token: 'test-token', siteUrl: 'https://tenant.sharepoint.com/sites/test' };

/** Build a successful fetch response for the indexed fields endpoint (returns empty set by default) */
function indexedFieldsResponse(fields: string[] = []): Response {
  return new Response(
    JSON.stringify({ value: fields.map((f) => ({ InternalName: f })) }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Build a successful PATCH response */
function patchOkResponse(): Response {
  return new Response('', { status: 200 });
}

/** Build a failed PATCH response */
function patchFailResponse(status = 500): Response {
  return new Response('Internal Server Error', { status });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('runNightlyIndexRemediation — guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds missing index fields and returns ok: true with source: nightly', async () => {
    // ListA: Field1 missing, Field2 already indexed
    // ListB: Field3 missing
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(indexedFieldsResponse(['Field2']))   // GET ListA
      .mockResolvedValueOnce(patchOkResponse())                   // PATCH ListA.Field1
      .mockResolvedValueOnce(indexedFieldsResponse([]))           // GET ListB
      .mockResolvedValueOnce(patchOkResponse());                  // PATCH ListB.Field3

    const results = await runNightlyIndexRemediation(CONFIG);

    const added = results.filter((r) => r.outcome === 'added');
    expect(added).toHaveLength(2);
    added.forEach((r) => {
      expect(r.ok).toBe(true);
      expect(r.source).toBe('nightly');
    });
  });

  it('skips fields already indexed (no PATCH called for them)', async () => {
    // Both ListA fields already indexed
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(indexedFieldsResponse(['Field1', 'Field2']))  // GET ListA
      .mockResolvedValueOnce(indexedFieldsResponse(['Field3']));            // GET ListB

    const results = await runNightlyIndexRemediation(CONFIG);

    expect(results).toHaveLength(0);
    // GET calls only, no PATCH
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it('respects runLimit and marks excess candidates as skipped_limit', async () => {
    // Mock has 3 candidates total (Field1, Field2 in ListA + Field3 in ListB)
    // runLimit=1 → only 1 add, rest skipped_limit
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(indexedFieldsResponse([]))   // GET ListA
      .mockResolvedValueOnce(patchOkResponse())           // PATCH ListA.Field1 → ok (count=1, limit reached)
      // Field2 and Field3 → skipped_limit (no PATCH calls needed)
      .mockResolvedValueOnce(indexedFieldsResponse([]));  // GET ListB (still fetched)

    const results = await runNightlyIndexRemediation({ ...CONFIG, runLimit: 1 });

    const added = results.filter((r) => r.outcome === 'added');
    const skipped = results.filter((r) => r.outcome === 'skipped_limit');
    expect(added).toHaveLength(1);
    expect(skipped.length).toBeGreaterThanOrEqual(1);
    skipped.forEach((r) => expect(r.ok).toBe(false));
  });

  it('is fail-soft: PATCH failure does not abort subsequent fields', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(indexedFieldsResponse([]))   // GET ListA
      .mockResolvedValueOnce(patchFailResponse(500))      // PATCH ListA.Field1 → fail
      .mockResolvedValueOnce(patchOkResponse())           // PATCH ListA.Field2 → ok
      .mockResolvedValueOnce(indexedFieldsResponse([]))   // GET ListB
      .mockResolvedValueOnce(patchOkResponse());          // PATCH ListB.Field3 → ok

    const results = await runNightlyIndexRemediation(CONFIG);

    const failed = results.filter((r) => r.outcome === 'failed');
    const added = results.filter((r) => r.outcome === 'added');
    expect(failed).toHaveLength(1);
    expect(added.length).toBeGreaterThanOrEqual(1);
  });

  it('is fail-soft: list fetch failure skips that list without aborting others', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))  // GET ListA → fail
      .mockResolvedValueOnce(indexedFieldsResponse([]))                    // GET ListB
      .mockResolvedValueOnce(patchOkResponse());                           // PATCH ListB.Field3

    const results = await runNightlyIndexRemediation(CONFIG);

    // ListA skipped, ListB.Field3 added
    expect(results.filter((r) => r.listTitle === 'ListA')).toHaveLength(0);
    expect(results.filter((r) => r.outcome === 'added')).toHaveLength(1);
  });

  it('all results carry source: nightly', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(indexedFieldsResponse([]))
      .mockResolvedValueOnce(patchFailResponse())
      .mockResolvedValueOnce(patchOkResponse())
      .mockResolvedValueOnce(indexedFieldsResponse([]))
      .mockResolvedValueOnce(patchOkResponse());

    const results = await runNightlyIndexRemediation(CONFIG);

    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.source).toBe('nightly'));
  });
});
