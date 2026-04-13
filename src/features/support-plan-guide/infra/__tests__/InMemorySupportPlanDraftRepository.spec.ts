import { beforeEach, describe, expect, it } from 'vitest';
import type { SupportPlanDraft } from '../../types';
import { defaultFormState } from '../../types';
import { createInMemorySupportPlanDraftRepository } from '../InMemorySupportPlanDraftRepository';

const makeDraft = (overrides: Partial<SupportPlanDraft> = {}): SupportPlanDraft => ({
  id: `test-${Math.random().toString(36).slice(2, 8)}`,
  name: 'テスト利用者',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  userId: null,
  userCode: 'U001',
  data: { ...defaultFormState },
  ...overrides,
});

describe('InMemorySupportPlanDraftRepository', () => {
  let repo: ReturnType<typeof createInMemorySupportPlanDraftRepository>;

  beforeEach(() => {
    repo = createInMemorySupportPlanDraftRepository();
  });

  it('seeds with two default drafts', async () => {
    const drafts = await repo.listDrafts();
    expect(drafts).toHaveLength(2);
    expect(drafts[0].name).toBe('塩田 裕貴');
    expect(drafts[1].name).toBe('利用者 1');
  });

  it('saveDraft creates a new draft', async () => {
    const draft = makeDraft({ id: 'new-1', name: '山田太郎' });
    await repo.saveDraft(draft);
 
    const drafts = await repo.listDrafts();
    expect(drafts).toHaveLength(3); // seed + new
    expect(drafts.find((d) => d.id === 'new-1')?.name).toBe('山田太郎');
  });

  it('saveDraft updates an existing draft', async () => {
    const draft = makeDraft({ id: 'upd-1', name: '初期名' });
    await repo.saveDraft(draft);

    const updated = { ...draft, name: '更新名', updatedAt: new Date().toISOString() };
    await repo.saveDraft(updated);

    const drafts = await repo.listDrafts();
    const found = drafts.find((d) => d.id === 'upd-1');
    expect(found?.name).toBe('更新名');
  });

  it('deleteDraft removes a draft', async () => {
    const draft = makeDraft({ id: 'del-1' });
    await repo.saveDraft(draft);
    expect(repo.size).toBe(3); // seed + new

    await repo.deleteDraft('del-1');
    expect(repo.size).toBe(2);

    const drafts = await repo.listDrafts();
    expect(drafts.find((d) => d.id === 'del-1')).toBeUndefined();
  });

  it('deleteDraft is idempotent for non-existent IDs', async () => {
    await expect(repo.deleteDraft('nonexistent')).resolves.not.toThrow();
  });

  it('bulkSave adds multiple drafts', async () => {
    const drafts = [
      makeDraft({ id: 'b1', name: '利用者A', userCode: 'UA' }),
      makeDraft({ id: 'b2', name: '利用者B', userCode: 'UB' }),
      makeDraft({ id: 'b3', name: '利用者C', userCode: 'UA' }),
    ];
    await repo.bulkSave(drafts);

    const all = await repo.listDrafts();
    expect(all).toHaveLength(5); // seed + 3
  });

  it('listDrafts filters by userCode', async () => {
    repo.clear();
    await repo.bulkSave([
      makeDraft({ id: 'f1', userCode: 'U001' }),
      makeDraft({ id: 'f2', userCode: 'U002' }),
      makeDraft({ id: 'f3', userCode: 'U001' }),
    ]);

    const filtered = await repo.listDrafts({ userCode: 'U001' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((d) => d.userCode === 'U001')).toBe(true);
  });

  it('listDrafts returns sorted by createdAt', async () => {
    repo.clear();
    const older = makeDraft({ id: 's1', createdAt: '2025-01-01T00:00:00Z' });
    const newer = makeDraft({ id: 's2', createdAt: '2026-01-01T00:00:00Z' });
    await repo.saveDraft(newer);
    await repo.saveDraft(older);

    const drafts = await repo.listDrafts();
    expect(drafts[0].id).toBe('s1'); // older first
    expect(drafts[1].id).toBe('s2');
  });

  it('clear removes all data', async () => {
    repo.clear();
    expect(repo.size).toBe(0);
    const drafts = await repo.listDrafts();
    expect(drafts).toHaveLength(0);
  });
});
