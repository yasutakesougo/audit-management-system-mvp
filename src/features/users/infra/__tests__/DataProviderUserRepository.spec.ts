import { describe, expect, it, beforeEach } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { AuthRequiredError } from '@/lib/errors';


describe('DataProviderUserRepository Split Logic', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(async () => {
    process.env.VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'WRITE_CUTOVER';
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider });
  });

  it('getAll(core) fetches only from Users_Master', async () => {
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Core User' }
    ]);
    
    // 他のリストにはデータがない状態
    const users = await repo.getAll({ selectMode: 'core' });
    
    expect(users).toHaveLength(1);
    expect(users[0].FullName).toBe('Core User');
    // Lazy Join が呼ばれていない（呼ばれても空だが、リクエスト自体の有無は provider の履歴等で見れる）
  });

  it('getAll(detail) performs lazy join across lists', async () => {
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Joint User' }
    ]);
    await provider.seed('UserTransport_Settings', [
      { UserID: 'U-001', TransportCourse: 'A-Course' }
    ]);
    await provider.seed('UserBenefit_Profile', [
      { UserID: 'U-001', RecipientCertExpiry: '2025-12-31' }
    ]);
    await provider.seed('UserBenefit_Profile_Ext', [
      { UserID: 'U-001', RecipientCertNumber: 'BEN-123' }
    ]);

    const users = await repo.getAll({ selectMode: 'detail' });
    
    expect(users).toHaveLength(1);
    expect(users[0].FullName).toBe('Joint User');
    expect(users[0].TransportCourse).toBe('A-Course');
    expect(users[0].RecipientCertNumber).toBe('BEN-123');
  });


  it('update() synchronizes accessory lists using upsert logic', async () => {
    // 1. 最初は Core のみ
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Existing' }
    ]);
    await provider.seed('UserTransport_Settings', [{ UserID: 'INIT', TransportCourse: '' }]);
    
    // 2. Transport 情報を追加更新
    await repo.update(1, { TransportCourse: 'Updated-Course' } as unknown as Record<string, unknown>);


    // 3. 分離先リストにレコードが作成されたか確認
    const transport = await provider.listItems<Record<string, unknown>>('UserTransport_Settings');
    expect(transport).toHaveLength(2); // INIT + New
    const target = transport.find(t => t.UserID === 'U-001');
    expect(target?.TransportCourse).toBe('Updated-Course');

    // 4. 重複作成されないか、既存レコードを更新するか確認
    await repo.update(1, { TransportCourse: 'Final-Course' } as unknown as Record<string, unknown>);
    const benefit = await provider.listItems<Record<string, unknown>>('UserBenefit_Profile');
    
    expect(benefit).toHaveLength(0);
    const transport2 = await provider.listItems<Record<string, unknown>>('UserTransport_Settings');

    expect(transport2).toHaveLength(2);
    expect(transport2.find(t => t.UserID === 'U-001')?.TransportCourse).toBe('Final-Course');
  });

  it('handles missing accessory rows gracefully', async () => {
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Partial' }
    ]);
    // Transport 等が空の状態

    const user = await repo.getById(1, { selectMode: 'detail' });
    
    expect(user).not.toBeNull();
    expect(user?.FullName).toBe('Partial');
    expect(user?.TransportCourse).toBeNull(); // エラーにならず null で返る
  });
  

  it('propagates AUTH_REQUIRED on getAll (instead of silently returning empty)', async () => {
    const authError = new AuthRequiredError();
    const throwingProvider = {
      getFieldInternalNames: async () => {
        throw authError;
      },
      listItems: async () => [],
    } as unknown as IDataProvider;

    const authRepo = new DataProviderUserRepository({ provider: throwingProvider });

    await expect(authRepo.getAll({ selectMode: 'core' })).rejects.toBe(authError);
  });

  it('propagates non-auth failures on getAll (instead of returning empty)', async () => {
    const listError = new Error('SP_LIST_READ_FAILED');
    const throwingProvider = {
      getFieldInternalNames: async () => ['Id', 'UserID', 'FullName', 'IsActive'],
      listItems: async () => {
        throw listError;
      },
    } as unknown as IDataProvider;

    const errorRepo = new DataProviderUserRepository({ provider: throwingProvider });

    await expect(errorRepo.getAll({ selectMode: 'core' })).rejects.toBe(listError);
  });

  it('does not include unresolved fields in $select', async () => {
    let capturedSelect: string[] | undefined;
    const provider = {
      getFieldInternalNames: async () => new Set([
        'Id',
        'Title',
        'Created',
        'Modified',
        'UserID',
        'FullName',
        'IsActive',
      ]),
      listItems: async (_resource: string, options?: { select?: string[] }) => {
        capturedSelect = options?.select;
        return [{ Id: 1, UserID: 'U-001', FullName: 'User One', IsActive: true }];
      },
    } as unknown as IDataProvider;

    const testRepo = new DataProviderUserRepository({ provider });
    const users = await testRepo.getAll({ selectMode: 'core' });

    expect(users).toHaveLength(1);
    expect(capturedSelect).toBeDefined();
    expect(capturedSelect).not.toContain('IsSupportProcedureTarget');
  });

  it('getAll(detail) issues O(1) accessory reads regardless of N users (bulk path)', async () => {
    const N = 8;
    const userRows = Array.from({ length: N }, (_, i) => ({
      Id: i + 1,
      UserID: `U-${String(i + 1).padStart(3, '0')}`,
      FullName: `User ${i + 1}`,
      IsActive: true,
    }));
    await provider.seed('Users_Master', userRows);

    await provider.seed(
      'UserTransport_Settings',
      userRows.map((u) => ({ UserID: u.UserID, TransportCourse: `Course-${u.UserID}` })),
    );
    await provider.seed(
      'UserBenefit_Profile',
      userRows.map((u) => ({ UserID: u.UserID, GrantMunicipality: 'Tokyo' })),
    );
    await provider.seed(
      'UserBenefit_Profile_Ext',
      userRows.map((u) => ({ UserID: u.UserID, RecipientCertNumber: `BEN-${u.UserID}` })),
    );

    const callCounts = new Map<string, number>();
    const originalListItems = provider.listItems.bind(provider);
    provider.listItems = (async (resource: string, options?: Parameters<typeof originalListItems>[1]) => {
      callCounts.set(resource, (callCounts.get(resource) ?? 0) + 1);
      return originalListItems(resource, options);
    }) as typeof provider.listItems;

    const users = await repo.getAll({ selectMode: 'detail' });

    expect(users).toHaveLength(N);
    expect(users.every((u) => u.TransportCourse?.startsWith('Course-'))).toBe(true);
    expect(users.every((u) => u.RecipientCertNumber?.startsWith('BEN-'))).toBe(true);

    // Bulk path: each accessory list is read exactly once, regardless of N users.
    expect(callCounts.get('UserTransport_Settings')).toBe(1);
    expect(callCounts.get('UserBenefit_Profile')).toBe(1);
    expect(callCounts.get('UserBenefit_Profile_Ext')).toBe(1);
  });
});
