
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DataProviderUserRepository } from '../DataProviderUserRepository';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';

describe('DataProviderUserRepository Zombie Column Protection', () => {
  let provider: InMemoryDataProvider;
  let repo: DataProviderUserRepository;

  beforeEach(async () => {
    provider = new InMemoryDataProvider();
    repo = new DataProviderUserRepository({ provider });
    
    // シードデータ設定
    await provider.seed('Users_Master', [
      { Id: 1, UserID: 'U-001', FullName: 'Core User' }
    ]);
  });

  it('SHOULD exclude fields moved to accessory lists from Users_Master query', async () => {
    const listItemsSpy = vi.spyOn(provider, 'listItems');

    // 1. 全ての物理列リストを取得
    // Users_Master 側に本来分離されているはずの列名が含まれている場合をシミュレート
    const coreFields = new Set(['Id', 'UserID', 'FullName', 'TransportCourse', 'RecipientCertNumber']);
    vi.spyOn(provider, 'getFieldInternalNames').mockImplementation(async (listName) => {
      if (listName === 'Users_Master') return coreFields;
      if (listName === 'UserTransport_Settings') return new Set(['Id', 'UserID', 'TransportCourse']);
      if (listName === 'UserBenefit_Profile') return new Set(['Id', 'UserID', 'DisabilitySupportLevel']);
      if (listName === 'UserBenefit_Profile_Ext') return new Set(['Id', 'UserID', 'RecipientCertNumber']);
      return new Set(['Id', 'Title']);
    });

    // 実行
    await repo.getAll({ selectMode: 'core' });

    // 検証: Users_Master へのクエリに TransportCourse や RecipientCertNumber が含まれていないこと
    const lastCall = listItemsSpy.mock.calls.find(call => call[0] === 'Users_Master');
    const select = lastCall?.[1]?.select;

    expect(select).toBeDefined();
    // 存在するはずのフィールド
    expect(select).toContain('UserID');
    expect(select).toContain('FullName');
    
    // 除外されるべきフィールド（ゾンビ化している可能性があるもの）
    expect(select).not.toContain('TransportCourse');
    expect(select).not.toContain('RecipientCertNumber');
  });

  it('SHOULD include fields in $select if they are only in the main list', async () => {
    const listItemsSpy = vi.spyOn(provider, 'listItems');

    vi.spyOn(provider, 'getFieldInternalNames').mockImplementation(async (listName) => {
      if (listName === 'Users_Master') return new Set(['Id', 'UserID', 'FullName', 'UsageStatus']);
      return new Set(['Id', 'Title']); // 他は空
    });

    await repo.getAll({ selectMode: 'core' });

    const lastCall = listItemsSpy.mock.calls.find(call => call[0] === 'Users_Master');
    const select = lastCall?.[1]?.select;

    expect(select).toContain('UsageStatus');
    expect(select).toContain('FullName');
  });
});
