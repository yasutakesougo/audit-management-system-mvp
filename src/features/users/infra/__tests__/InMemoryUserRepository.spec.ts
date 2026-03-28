import { describe, expect, it } from 'vitest';

import { USAGE_STATUS_VALUES } from '../../typesExtended';
import { InMemoryUserRepository } from '../InMemoryUserRepository';

describe('InMemoryUserRepository terminate', () => {
  it('is idempotent and preserves existing ServiceEndDate', async () => {
    const repo = new InMemoryUserRepository([
      {
        Id: 1,
        UserID: 'U-001',
        FullName: '対象利用者',
        IsActive: true,
        ServiceEndDate: '2026-12-31',
      },
    ]);

    const first = await repo.terminate(1);
    const second = await repo.terminate(1);

    expect(first.UsageStatus).toBe(USAGE_STATUS_VALUES.TERMINATED);
    expect(first.IsActive).toBe(false);
    expect(first.ServiceEndDate).toBe('2026-12-31');
    expect(second).toEqual(first);
  });

  it('rejects update for terminated user', async () => {
    const repo = new InMemoryUserRepository([
      {
        Id: 2,
        UserID: 'U-002',
        FullName: '更新禁止利用者',
        IsActive: true,
      },
    ]);

    await repo.terminate(2);

    await expect(
      repo.update(2, { FullName: '更新後氏名' }),
    ).rejects.toThrow('契約終了の利用者は編集できません。');
  });
});
