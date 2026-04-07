import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Test: SharePointUserRepository selectMode fallback (full → detail → core)
//
// Strategy: The PnP chain is items.select(...).top(n)() where the result of
// .top(n) is itself a callable (returns Promise). We mock this entire chain
// and control which calls succeed/fail to verify the fallback cascade.
// ---------------------------------------------------------------------------

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    getAppConfig: () => ({
      VITE_SP_RESOURCE: 'https://example.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/test',
    }),
  };
});

const auditMock = vi.fn();

// Track each call: the queryFn is what gets invoked when PnP resolves
let callCount = 0;
const callResults: Array<{ resolve: unknown } | { reject: Error }> = [];

function setCallResults(results: Array<{ resolve: unknown } | { reject: Error }>) {
  callCount = 0;
  callResults.length = 0;
  callResults.push(...results);
}

// Create a fresh mock SP instance for each call
const createMockSp = () => ({
  web: {
    lists: {
      getByTitle: () => ({
        fields: () => Promise.resolve([
          { InternalName: 'UserID' },
          { InternalName: 'FullName' },
          { InternalName: 'Title' },
        ]),
        items: {
          select: (..._fields: string[]) => ({
            top: (_n: number) => {
              // Return a callable that resolves/rejects based on callResults
              const result = callResults[callCount++];
              if (!result) return () => Promise.reject(new Error('Unexpected call'));
              if ('reject' in result) return () => Promise.reject(result.reject);
              return () => Promise.resolve(result.resolve);
            },
          }),
          getById: () => ({
            select: () => () => Promise.resolve({}),
            update: () => Promise.resolve(),
            recycle: () => Promise.resolve(),
          }),
          add: () => Promise.resolve({ data: {} }),
        },
      }),
    },
  },
});

vi.mock('@pnp/sp', () => ({
  spfi: () => ({ using: () => ({}) }),
  SPFx: () => ({}),
}));

import { SharePointUserRepository } from '../../src/features/users/infra/SharePointUserRepository';

describe('SharePointUserRepository selectMode fallback', () => {
  let repo: SharePointUserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    callCount = 0;
    callResults.length = 0;
    repo = new SharePointUserRepository({ sp: createMockSp() as never, audit: auditMock });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('succeeds on first attempt when full mode works', async () => {
    const mockData = [{ Id: 1, Title: null, UserID: 'U001', FullName: 'User 1' }];
    setCallResults([{ resolve: mockData }]);

    const result = await repo.getAll({ selectMode: 'full' });

    expect(result).toHaveLength(1);
    expect(result[0].FullName).toBe('User 1');
    expect(callCount).toBe(1); // Only tried full
  });

  it('falls back from full → detail when full returns 400', async () => {
    const mockData = [{ Id: 1, Title: null, UserID: 'U001', FullName: 'User 1' }];
    setCallResults([
      { reject: new Error('400 - column does not exist') },
      { resolve: mockData },
    ]);

    const result = await repo.getAll({ selectMode: 'full' });

    expect(result).toHaveLength(1);
    expect(callCount).toBe(2); // full failed, detail succeeded
  });

  it('falls back full → detail → core when both fail with 400', async () => {
    const mockData = [{ Id: 1, Title: null, UserID: 'U001', FullName: 'User 1' }];
    setCallResults([
      { reject: new Error('400 - column does not exist') },
      { reject: new Error('400 - field not found') },
      { resolve: mockData },
    ]);

    const result = await repo.getAll({ selectMode: 'full' });

    expect(result).toHaveLength(1);
    expect(callCount).toBe(3); // full, detail failed; core succeeded
  });

  it('throws when all fallback tiers fail', async () => {
    setCallResults([
      { reject: new Error('400 - column error') },
      { reject: new Error('400 - column error') },
      { reject: new Error('400 - column error') },
    ]);

    await expect(repo.getAll({ selectMode: 'full' })).rejects.toThrow('400');
    expect(callCount).toBe(3);
  });

  it('throws immediately for non-400 errors (no fallback)', async () => {
    setCallResults([{ reject: new Error('403 Forbidden') }]);

    await expect(repo.getAll({ selectMode: 'full' })).rejects.toThrow('403 Forbidden');
    expect(callCount).toBe(1); // No fallback for non-400
  });

  it('core mode has no fallback (only 1 tier)', async () => {
    setCallResults([{ reject: new Error('400 - column error') }]);

    await expect(repo.getAll({ selectMode: 'core' })).rejects.toThrow('400');
    expect(callCount).toBe(1);
  });

  it('detail mode falls back to core only (2 tiers)', async () => {
    const mockData = [{ Id: 1, Title: null, UserID: 'U001', FullName: 'User 1' }];
    setCallResults([
      { reject: new Error('400 - column error') },
      { resolve: mockData },
    ]);

    const result = await repo.getAll({ selectMode: 'detail' });

    expect(result).toHaveLength(1);
    expect(callCount).toBe(2); // detail failed, core succeeded
  });
});
