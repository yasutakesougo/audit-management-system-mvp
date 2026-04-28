import { describe, expect, it, beforeEach } from 'vitest';

import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import type { DataProviderOptions } from '@/lib/data/dataProvider.interface';

import { DataProviderUserRepository } from '../DataProviderUserRepository';

const ACCESSORY_LISTS = ['UserTransport_Settings', 'UserBenefit_Profile', 'UserBenefit_Profile_Ext'] as const;
type AccessoryList = (typeof ACCESSORY_LISTS)[number];

interface InstrumentationResult {
  callCounts: Map<string, number>;
  filteredCalls: Map<string, number>;
}

const seedDataset = async (provider: InMemoryDataProvider, n: number) => {
  const users = Array.from({ length: n }, (_, i) => ({
    Id: i + 1,
    UserID: `U-${String(i + 1).padStart(3, '0')}`,
    FullName: `User ${i + 1}`,
    IsActive: true,
  }));
  await provider.seed('Users_Master', users);
  await provider.seed(
    'UserTransport_Settings',
    users.map((u) => ({ UserID: u.UserID, TransportCourse: `Course-${u.UserID}` })),
  );
  await provider.seed(
    'UserBenefit_Profile',
    users.map((u) => ({ UserID: u.UserID, GrantMunicipality: `City-${u.UserID}` })),
  );
  await provider.seed(
    'UserBenefit_Profile_Ext',
    users.map((u) => ({ UserID: u.UserID, RecipientCertNumber: `BEN-${u.UserID}` })),
  );
  return users;
};

/**
 * Wrap provider.listItems so we can:
 *   1. Inject failures for selected accessory lists.
 *   2. Distinguish bulk reads (no $filter) from per-user fallback reads (with $filter).
 */
const instrument = (
  provider: InMemoryDataProvider,
  failingLists: ReadonlyArray<AccessoryList>,
): InstrumentationResult => {
  const callCounts = new Map<string, number>();
  const filteredCalls = new Map<string, number>();
  const original = provider.listItems.bind(provider);
  provider.listItems = (async (resource: string, options?: DataProviderOptions) => {
    callCounts.set(resource, (callCounts.get(resource) ?? 0) + 1);
    if (options?.filter) {
      filteredCalls.set(resource, (filteredCalls.get(resource) ?? 0) + 1);
    }
    if ((failingLists as readonly string[]).includes(resource)) {
      throw new Error(`SIMULATED_LIST_DOWN:${resource}`);
    }
    return original(resource, options);
  }) as typeof provider.listItems;
  return { callCounts, filteredCalls };
};

describe('DataProviderUserRepository — bulk vs fallback semantics', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(() => {
    process.env.VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'WRITE_CUTOVER';
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider, listTitle: 'Users_Master' });
  });

  it('falls back to chunked per-user fetch only when ALL 3 accessory lists fail', async () => {
    const users = await seedDataset(provider, 4);
    const { callCounts, filteredCalls } = instrument(provider, [...ACCESSORY_LISTS]);

    const result = await repo.getAll({ selectMode: 'detail' });

    expect(result).toHaveLength(users.length);
    // Bulk path attempted exactly once per accessory list (and failed each).
    // Fallback path then issues per-user filtered reads — N attempts per list.
    for (const list of ACCESSORY_LISTS) {
      expect(callCounts.get(list)).toBe(1 + users.length);
      expect(filteredCalls.get(list)).toBe(users.length);
    }
    // Per-user enrichUser swallows errors → users come back unenriched.
    expect(result.every((u) => u.TransportCourse === null)).toBe(true);
    expect(result.every((u) => u.RecipientCertNumber === null)).toBe(true);
  });

  it('does NOT fall back when only 1 accessory list fails — joins continue with the 2 surviving lists', async () => {
    const users = await seedDataset(provider, 4);
    const { callCounts, filteredCalls } = instrument(provider, ['UserBenefit_Profile']);

    const result = await repo.getAll({ selectMode: 'detail' });

    expect(result).toHaveLength(users.length);
    // Each accessory list bulk-read exactly once. No per-user filtered reads.
    for (const list of ACCESSORY_LISTS) {
      expect(callCounts.get(list)).toBe(1);
      expect(filteredCalls.get(list) ?? 0).toBe(0);
    }
    // Surviving lists joined; failing list left unenriched.
    expect(result.every((u) => u.TransportCourse?.startsWith('Course-'))).toBe(true);
    expect(result.every((u) => u.RecipientCertNumber?.startsWith('BEN-'))).toBe(true);
    expect(result.every((u) => u.GrantMunicipality === null)).toBe(true);
  });

  it('does NOT fall back when 2 of 3 accessory lists fail — last surviving list still joins', async () => {
    const users = await seedDataset(provider, 3);
    const { callCounts, filteredCalls } = instrument(provider, [
      'UserTransport_Settings',
      'UserBenefit_Profile',
    ]);

    const result = await repo.getAll({ selectMode: 'detail' });

    expect(result).toHaveLength(users.length);
    for (const list of ACCESSORY_LISTS) {
      expect(callCounts.get(list)).toBe(1);
      expect(filteredCalls.get(list) ?? 0).toBe(0);
    }
    expect(result.every((u) => u.RecipientCertNumber?.startsWith('BEN-'))).toBe(true);
    expect(result.every((u) => u.TransportCourse === null)).toBe(true);
    expect(result.every((u) => u.GrantMunicipality === null)).toBe(true);
  });

  it('produces equivalent enriched output to the per-user (chunked) path on a fixture dataset', async () => {
    // Bulk path: all 3 lists succeed.
    const bulkProvider = new InMemoryDataProvider();
    const users = await seedDataset(bulkProvider, 5);
    const bulkRepo = new DataProviderUserRepository({ provider: bulkProvider, listTitle: 'Users_Master' });
    const bulkResult = await bulkRepo.getAll({ selectMode: 'detail' });

    // Chunked fallback: replicate the same dataset but force ALL accessory bulk
    // reads to fail, forcing fallback to chunkedEnrichUsers (which uses
    // per-user filtered reads → same semantics as the legacy enrichUser path).
    const chunkProvider = new InMemoryDataProvider();
    await seedDataset(chunkProvider, 5);
    const chunkRepo = new DataProviderUserRepository({ provider: chunkProvider, listTitle: 'Users_Master' });

    const original = chunkProvider.listItems.bind(chunkProvider);
    chunkProvider.listItems = (async (resource: string, options?: DataProviderOptions) => {
      // Fail bulk reads (no filter) on accessory lists, but pass through per-user filtered reads.
      if (
        (ACCESSORY_LISTS as readonly string[]).includes(resource) &&
        !options?.filter
      ) {
        throw new Error(`FORCE_FALLBACK:${resource}`);
      }
      return original(resource, options);
    }) as typeof chunkProvider.listItems;

    const chunkResult = await chunkRepo.getAll({ selectMode: 'detail' });

    expect(chunkResult).toHaveLength(users.length);
    expect(bulkResult).toHaveLength(users.length);

    // Compare relevant joined fields per user.
    const project = (u: (typeof bulkResult)[number]) => ({
      Id: u.Id,
      UserID: u.UserID,
      FullName: u.FullName,
      TransportCourse: u.TransportCourse,
      GrantMunicipality: u.GrantMunicipality,
      RecipientCertNumber: u.RecipientCertNumber,
    });
    expect(bulkResult.map(project)).toEqual(chunkResult.map(project));
  });
});
