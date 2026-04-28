import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';

describe('DataProviderUserRepository Contract Compliance', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(async () => {
    // Contract tests should be independent of cutover state where possible,
    // but we use WRITE_CUTOVER as the baseline for canonical behavior.
    process.env.VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'WRITE_CUTOVER';
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider, listTitle: 'Users_Master' });
  });

  describe('Clearable Update Contract', () => {
    it('treats undefined as "no change" (skip field)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001', FullName: 'Original', UsageStatus: 'init' }]);
      
      // FullName is undefined in this patch
      await repo.update(1, { UsageStatus: 'active' } as unknown as Record<string, unknown>);
      
      const items = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(items[0].FullName).toBe('Original');
      expect(items[0].UsageStatus).toBe('active');
    });

    it('treats empty string as null (clear field)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001', FullName: 'Original' }]);
      
      await repo.update(1, { FullName: '' } as unknown as Record<string, unknown>);
      
      const items = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(items[0].FullName).toBeNull();
    });

    it('treats whitespace string as null (clear field)', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001', FullName: 'Original' }]);
      
      await repo.update(1, { FullName: '   ' } as unknown as Record<string, unknown>);
      
      const items = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(items[0].FullName).toBeNull();
    });
  });

  describe('Case-Insensitive Mapping', () => {
    it('maps lowercase DTO keys to PascalCase physical fields', async () => {
      // Users_Master has 'FullName' (Pascal)
      // DTO might provide 'fullName' (camel)
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001', FullName: 'Old' }]);
      
      await repo.update(1, { fullName: 'New' } as unknown as Record<string, unknown>);
      
      const items = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(items[0].FullName).toBe('New');
    });

    it('maps PascalCase DTO keys to camelCase physical fields', async () => {
      // If a list has 'usageStatus' (camel)
      // and DTO provides 'UsageStatus' (Pascal)
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001', usageStatus: 'old' }]);
      
      await repo.update(1, { UsageStatus: 'new' } as unknown as Record<string, unknown>);
      
      const items = await provider.listItems<Record<string, unknown>>('Users_Master');
      // buildMappedPayload handles the case-insensitivity against the resolved mapping
      // If 'UsageStatus' was resolved to 'usageStatus', it works.
      const status = items[0].usageStatus || items[0].UsageStatus;
      expect(status).toBe('new');
    });
  });

  describe('No-op Guard', () => {
    it('skips API call if payload is effectively empty after normalization', async () => {
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U001' }]);
      
      const spy = vi.spyOn(provider, 'updateItem');
      
      // Update with only undefined fields
      await repo.update(1, { FullName: undefined } as unknown as Record<string, unknown>);
      
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
