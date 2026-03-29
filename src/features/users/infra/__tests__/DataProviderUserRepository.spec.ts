import { describe, expect, it, beforeEach } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import { FIELD_MAP } from '@/sharepoint/fields';

describe('DataProviderUserRepository Split Logic', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;
  const fields = FIELD_MAP.Users_Master;

  beforeEach(() => {
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
      RecipientCertNumber: 'BEN-456'
    };

    const created = await repo.create(payload as any);
    
    expect(created.UserID).toBe('U-NEW');
    
    // 各リストの中身を確認
    const core = await provider.listItems<any>('Users_Master');
    const transport = await provider.listItems<any>('UserTransport_Settings');
    const benefit = await provider.listItems<any>('UserBenefit_Profile');
    
    expect(core[0].FullName).toBe('New User');
    expect(transport[0].TransportCourse).toBe('B-Course');
    expect(benefit[0].RecipientCertNumber).toBe('BEN-456');
    
    expect(transport[0].UserID).toBe('U-NEW');
    expect(benefit[0].UserID).toBe('U-NEW');
  });

  it('update() synchronizes accessory lists using upsert logic', async () => {
    // 1. 最初は Core のみ
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Existing' }
    ]);

    // 2. Transport 情報を追加更新
    await repo.update(1, { TransportCourse: 'Updated-Course' } as any);

    // 3. 分離先リストにレコードが作成されたか確認
    const transport = await provider.listItems<any>('UserTransport_Settings');
    expect(transport).toHaveLength(1);
    expect(transport[0].UserID).toBe('U-001');
    expect(transport[0].TransportCourse).toBe('Updated-Course');

    // 4. 重複作成されないか、既存レコードを更新するか確認
    await repo.update(1, { TransportCourse: 'Final-Course' } as any);
    const transport2 = await provider.listItems<any>('UserTransport_Settings');
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
});
