import {
    buildListCheckPath,
    checkAllLists,
    checkSingleList,
    type SpFetcher,
} from '@/sharepoint/spListHealthCheck';
import { SP_LIST_REGISTRY, type SpListEntry } from '@/sharepoint/spListRegistry';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Registry completeness
// ---------------------------------------------------------------------------

describe('SP_LIST_REGISTRY', () => {
  it('should not be empty', () => {
    expect(SP_LIST_REGISTRY.length).toBeGreaterThan(0);
  });

  it('should have unique keys', () => {
    const keys = SP_LIST_REGISTRY.map((e) => e.key);
    const duplicates = keys.filter((item, index) => keys.indexOf(item) !== index);
    expect(duplicates, `Duplicate keys found: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('every entry should have valid meta-data structure', () => {
    for (const entry of SP_LIST_REGISTRY) {
      // 1. Resolve capability
      const resolved = entry.resolve();
      expect(resolved, `entry "${entry.key}" resolved empty`).toBeTruthy();
      expect(typeof resolved).toBe('string');

      // 2. Operations validity
      expect(entry.operations.length, `entry "${entry.key}" has no operations`).toBeGreaterThan(0);
      for (const op of entry.operations) {
        expect(['R', 'W', 'D'], `entry "${entry.key}" has invalid operation "${op}"`).toContain(op);
      }

      // 3. Lifecycle validity
      expect(['required', 'optional', 'deprecated', 'experimental'], `entry "${entry.key}" has invalid lifecycle "${entry.lifecycle}"`)
        .toContain(entry.lifecycle);

      // 4. Provisioning vs Essential fields consistency
      if (entry.provisioningFields && entry.essentialFields) {
        const provInternalNames = entry.provisioningFields.map(f => f.internalName);
        for (const essential of entry.essentialFields) {
          // Note: Title is always present in SP, so we skip it if not in provisioning
          if (essential === 'Title') continue;
          
          expect(provInternalNames, `entry "${entry.key}" lists essential field "${essential}" which is missing in provisioningFields`)
            .toContain(essential);
        }
      }

      // 5. Provisioning internalName uniqueness
      if (entry.provisioningFields) {
        const names = entry.provisioningFields.map(f => f.internalName);
        const dupNames = names.filter((item, index) => names.indexOf(item) !== index);
        expect(dupNames, `entry "${entry.key}" has duplicate provisioning field names: ${dupNames.join(', ')}`).toHaveLength(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildListCheckPath
// ---------------------------------------------------------------------------

describe('buildListCheckPath', () => {
  it('should build title-based path for normal list names', () => {
    const path = buildListCheckPath('Users_Master');
    expect(path).toBe(
      "/_api/web/lists/getbytitle('Users_Master')?$select=Id,Title",
    );
  });

  it('should encode special characters in title', () => {
    const path = buildListCheckPath("My List & More's");
    expect(path).toContain('getbytitle');
    expect(path).toContain(encodeURIComponent("My List & More's"));
  });

  it('should build GUID-based path for guid: prefix', () => {
    const path = buildListCheckPath('guid:576f882f-446f-4f7e-8444-d15ba746c681');
    expect(path).toBe(
      "/_api/web/lists(guid'576f882f-446f-4f7e-8444-d15ba746c681')?$select=Id,Title",
    );
  });

  it('should build GUID-based path for bare GUID string', () => {
    const path = buildListCheckPath('576f882f-446f-4f7e-8444-d15ba746c681');
    expect(path).toBe(
      "/_api/web/lists(guid'576f882f-446f-4f7e-8444-d15ba746c681')?$select=Id,Title",
    );
  });
});

// ---------------------------------------------------------------------------
// checkSingleList
// ---------------------------------------------------------------------------

const makeEntry = (overrides?: Partial<SpListEntry>): SpListEntry => ({
  key: 'test_list',
  displayName: 'テスト',
  resolve: () => 'TestList',
  operations: ['R'],
  category: 'master',
  lifecycle: 'optional',
  ...overrides,
});

const makeFetcher = (status: number): SpFetcher =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status }));

describe('checkSingleList', () => {
  it('should return ok for 200 response', async () => {
    const result = await checkSingleList(makeEntry(), makeFetcher(200));
    expect(result.status).toBe('ok');
    expect(result.httpStatus).toBe(200);
    expect(result.listName).toBe('TestList');
  });

  it('should return not_found for 404 response', async () => {
    const result = await checkSingleList(makeEntry(), makeFetcher(404));
    expect(result.status).toBe('not_found');
    expect(result.httpStatus).toBe(404);
  });

  it('should return forbidden for 403 response', async () => {
    const result = await checkSingleList(makeEntry(), makeFetcher(403));
    expect(result.status).toBe('forbidden');
    expect(result.httpStatus).toBe(403);
  });

  it('should return forbidden for 401 response', async () => {
    const result = await checkSingleList(makeEntry(), makeFetcher(401));
    expect(result.status).toBe('forbidden');
  });

  it('should return error for 500 response', async () => {
    const result = await checkSingleList(makeEntry(), makeFetcher(500));
    expect(result.status).toBe('error');
    expect(result.httpStatus).toBe(500);
  });

  it('should return error when fetcher throws', async () => {
    const fetcher: SpFetcher = vi.fn().mockRejectedValue(new Error('Network failure'));
    const result = await checkSingleList(makeEntry(), fetcher);
    expect(result.status).toBe('error');
    expect(result.error).toBe('Network failure');
  });

  it('should return error when resolve() throws', async () => {
    const entry = makeEntry({ resolve: () => { throw new Error('Config error'); } });
    const result = await checkSingleList(entry, makeFetcher(200));
    expect(result.status).toBe('error');
    expect(result.error).toBe('Config error');
    expect(result.listName).toBe('(resolve failed)');
  });
});

// ---------------------------------------------------------------------------
// checkAllLists
// ---------------------------------------------------------------------------

describe('checkAllLists', () => {
  let fetcher: SpFetcher;

  beforeEach(() => {
    fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
  });

  it('should check all entries and return summary', async () => {
    const entries: SpListEntry[] = [
      makeEntry({ key: 'list_a' }),
      makeEntry({ key: 'list_b' }),
      makeEntry({ key: 'list_c' }),
    ];

    const summary = await checkAllLists(fetcher, entries);
    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(3);
    expect(summary.notFound).toBe(0);
    expect(summary.forbidden).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.results).toHaveLength(3);
  });

  it('should correctly count mixed statuses', async () => {
    const mixedFetcher: SpFetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 403 }))
      .mockRejectedValueOnce(new Error('timeout'));

    const entries: SpListEntry[] = [
      makeEntry({ key: 'ok_list' }),
      makeEntry({ key: 'missing_list' }),
      makeEntry({ key: 'forbidden_list' }),
      makeEntry({ key: 'error_list' }),
    ];

    const summary = await checkAllLists(mixedFetcher, entries);
    expect(summary.total).toBe(4);
    expect(summary.ok).toBe(1);
    expect(summary.notFound).toBe(1);
    expect(summary.forbidden).toBe(1);
    expect(summary.errors).toBe(1);
  });

  it('should handle GUID-based list names', async () => {
    const entry = makeEntry({
      key: 'guid_list',
      resolve: () => 'guid:576f882f-446f-4f7e-8444-d15ba746c681',
    });

    const summary = await checkAllLists(fetcher, [entry]);
    expect(summary.ok).toBe(1);

    const calledPath = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledPath).toContain("lists(guid'576f882f");
  });
});
