import { describe, expect, it, beforeEach } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';

describe('DataProviderUserRepository Cutover Transitions', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(async () => {
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider, listTitle: 'Users_Master' });
  });

  describe('PRE_MIGRATION stage', () => {
    beforeEach(() => {
      process.env.VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'PRE_MIGRATION';
    });

    it('create() writes to legacy columns in benefit list', async () => {
      const payload = {
        UserID: 'U-PRE',
        FullName: 'Pre User',
        GrantMunicipality: 'City-Legacy'
      };

      await provider.seed('Users_Master', [{ Id: 0, UserID: '', FullName: '' }]);
      await provider.seed('UserBenefit_Profile', [{ UserID: 'INIT', Grant_x0020_Municipality: '' }]);

      await repo.create(payload as any);

      const benefit = await provider.listItems<any>('UserBenefit_Profile');
      const created = benefit.find(b => b.UserID === 'U-PRE');
      expect(created).toBeDefined(); 
      // PRE_MIGRATION writes to legacy name
      expect(created.Grant_x0020_Municipality).toBe('City-Legacy');
      expect(created.GrantMunicipality).toBeUndefined();
    });
  });

  describe('WRITE_CUTOVER stage (Canonical Only)', () => {
    beforeEach(() => {
      process.env.VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'WRITE_CUTOVER';
    });

    it('create() writes only to canonical columns', async () => {
      const payload = {
        UserID: 'U-CUT',
        FullName: 'Cut User',
        GrantMunicipality: 'City-Cut'
      };

      await provider.seed('Users_Master', [{ Id: 0, UserID: '', FullName: '' }]);
      await provider.seed('UserBenefit_Profile', [{ UserID: 'INIT', GrantMunicipality: '' }]);

      await repo.create(payload as any);

      const benefit = await provider.listItems<any>('UserBenefit_Profile');
      const created = benefit.find(b => b.UserID === 'U-CUT');
      expect(created).toBeDefined();
      expect(created.GrantMunicipality).toBe('City-Cut');
      expect(created.Grant_x0020_Municipality).toBeUndefined();
    });
  });
});
