import { describe, expect, it, beforeEach } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import type { IUserMasterCreateDto } from '../../types';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { AuthRequiredError } from '@/lib/errors';


describe('DataProviderUserRepository Split Logic', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(async () => {
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

  it('create() splits payload into three lists', async () => {
    const payload = {
      UserID: 'U-NEW',
      FullName: 'New User',
      TransportCourse: 'B-Course',
      RecipientCertNumber: 'BEN-456',
      RecipientCertExpiry: '2025-12-31'
    };

    // Schema Resolution を正しく機能させるために、予めフィールドヒントをシードする
    await provider.ensureListExists('Users_Master', [
      { internalName: 'Id', type: 'Integer' },
      { internalName: 'UserID', type: 'Text' },
      { internalName: 'FullName', type: 'Text' },
      { internalName: 'IsActive', type: 'Boolean' },
    ]);
    await provider.ensureListExists('UserTransport_Settings', [
      { internalName: 'UserID', type: 'Text' },
      { internalName: 'TransportCourse', type: 'Text' },
    ]);
    await provider.ensureListExists('UserBenefit_Profile', [
      { internalName: 'UserID', type: 'Text' },
      { internalName: 'RecipientCertExpiry', type: 'Text' },
    ]);
    await provider.ensureListExists('UserBenefit_Profile_Ext', [
      { internalName: 'UserID', type: 'Text' },
      { internalName: 'RecipientCertNumber', type: 'Text' },
    ]);

    const created = await repo.create(payload as unknown as IUserMasterCreateDto);

    
    expect(created.UserID).toBe('U-NEW');
    
    // 各リストの中身を確認
    const core = await provider.listItems<Record<string, unknown>>('Users_Master');
    const transport = await provider.listItems<Record<string, unknown>>('UserTransport_Settings');
    const benefit = await provider.listItems<Record<string, unknown>>('UserBenefit_Profile');
    const benefitExt = await provider.listItems<Record<string, unknown>>('UserBenefit_Profile_Ext');

    
    expect(core[1].FullName).toBe('New User');
    expect(transport[0].TransportCourse).toBe('B-Course');
    expect(benefitExt[0].RecipientCertNumber).toBe('BEN-456');
    
    expect(transport[0].UserID).toBe('U-NEW');
    expect(benefit[0].UserID).toBe('U-NEW');
  });

  it('update() synchronizes accessory lists using upsert logic', async () => {
    // 1. 最初は Core のみ
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Existing' }
    ]);
    // 解決のためにスキーマを提示
    await provider.ensureListExists('UserTransport_Settings', [
      { internalName: 'UserID', type: 'Text' },
      { internalName: 'TransportCourse', type: 'Text' },
    ]);

    // 2. Transport 情報を追加更新
    await repo.update(1, { TransportCourse: 'Updated-Course' } as unknown as Record<string, unknown>);


    // 3. 分離先リストにレコードが作成されたか確認
    const transport = await provider.listItems<Record<string, unknown>>('UserTransport_Settings');
    expect(transport).toHaveLength(1);
    expect(transport[0].UserID).toBe('U-001');
    expect(transport[0].TransportCourse).toBe('Updated-Course');

    // 4. 重複作成されないか、既存レコードを更新するか確認
    await repo.update(1, { TransportCourse: 'Final-Course' } as unknown as Record<string, unknown>);
    const transport2 = await provider.listItems<Record<string, unknown>>('UserTransport_Settings');

    expect(transport2).toHaveLength(1);
    expect(transport2[0].TransportCourse).toBe('Final-Course');
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
  
  describe('Schema Drift Write Resilience', () => {
    it('correctly updates drifted columns (Status instead of UsageStatus)', async () => {
      // 1. 'Status' というキーを持つ既存レコード（ドリフト環境のシミュレート）
      await provider.seed('Users_Master', [
        { Id: 1, UserID: 'U-001', FullName: 'Drift User', Status: 'old-status' }
      ]);

      // 2. Repository 経由で 'UsageStatus' を更新
      await repo.update(1, { UsageStatus: 'new-status' });

      // 3. プロバイダー側の 'Status' 列が更新されていることを確認
      const core = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(core[0].Status).toBe('new-status');
      expect(core[0].UsageStatus).toBeUndefined(); // 元々の正しい名前の列は作成されていない
    });

    it('correctly updates drifted core flags (IntensityTarget instead of IsHighIntensitySupportTarget)', async () => {
      // 1. 'IntensityTarget' というキーを持つ既存レコード
      await provider.seed('Users_Master', [
        { Id: 1, UserID: 'U-001', FullName: 'Flag User', IntensityTarget: false }
      ]);

      // 2. Repository 経由で 'IsHighIntensitySupportTarget' を更新
      await repo.update(1, { IsHighIntensitySupportTarget: true });

      // 3. プロバイダー側の 'IntensityTarget' 列が更新されていることを確認
      const core = await provider.listItems<Record<string, unknown>>('Users_Master');
      expect(core[0].IntensityTarget).toBe(true);
      expect(core[0].IsHighIntensitySupportTarget).toBeUndefined();
    });

    it('syncAccessoryList also respects drift (DisabilitySupportLevel0 in benefit list)', async () => {
      // 1. メインリストと、ドリフトした分離先リストをシード
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Benefit User' }]);
      await provider.seed('UserBenefit_Profile', [
        { UserID: 'U-001', RecipientCertExpiry: '2025-12-31', DisabilitySupportLevel0: 'Level 1' }
      ]);

      // 2. 'DisabilitySupportLevel' を更新
      await repo.update(1, { DisabilitySupportLevel: 'Level 3' });

      // 3. 分離先リストの 'DisabilitySupportLevel0' が更新されたか確認
      const benefit = await provider.listItems<Record<string, unknown>>('UserBenefit_Profile');
      expect(benefit[0].DisabilitySupportLevel0).toBe('Level 3');
      expect(benefit[0].DisabilitySupportLevel).toBeUndefined();
    });

    it('syncAccessoryList also respects truncation drift (Recipient_x0020_Cert_x0020_Numbe in benefit_ext)', async () => {
      // 1. シード (32文字で切り詰められた列名を受容)
      await provider.seed('Users_Master', [{ Id: 1, UserID: 'U-001', FullName: 'Ext User' }]);
      await provider.seed('UserBenefit_Profile_Ext', [
        { UserID: 'U-001', Recipient_x0020_Cert_x0020_Numbe: 'OLD-CERT' }
      ]);

      // 2. RecipientCertNumber を更新
      await repo.update(1, { RecipientCertNumber: 'NEW-CERT' });

      // 3. 切り詰められた列が更新されたか確認
      const ext = await provider.listItems<Record<string, unknown>>('UserBenefit_Profile_Ext');
      expect(ext[0].Recipient_x0020_Cert_x0020_Numbe).toBe('NEW-CERT');
      expect(ext[0].RecipientCertNumber).toBeUndefined();
    });
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
});
