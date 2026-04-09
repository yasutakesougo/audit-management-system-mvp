import { describe, expect, it, beforeEach } from 'vitest';
import { InMemoryPdcaRepository } from '../infra/inMemoryPdcaRepository';

describe('InMemoryPdcaRepository', () => {
  let repo: InMemoryPdcaRepository;

  beforeEach(() => {
    repo = new InMemoryPdcaRepository();
  });

  // ── Create ──────────────────────────────────────────────

  it('creates a new PDCA item with correct fields', async () => {
    const item = await repo.create({
      userId: 'U001',
      title: '行動パターン分析',
      summary: '午前中の不穏行動について',
      phase: 'PLAN',
    });

    expect(item.id).toBeTruthy();
    expect(item.userId).toBe('U001');
    expect(item.title).toBe('行動パターン分析');
    expect(item.summary).toBe('午前中の不穏行動について');
    expect(item.phase).toBe('PLAN');
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();
  });

  it('defaults phase to PLAN when not provided', async () => {
    const item = await repo.create({ userId: 'U001', title: 'テスト' });
    expect(item.phase).toBe('PLAN');
  });

  it('defaults summary to empty string when not provided', async () => {
    const item = await repo.create({ userId: 'U001', title: 'テスト' });
    expect(item.summary).toBe('');
  });

  it('preserves planningSheetId on create when provided', async () => {
    const item = await repo.create({
      userId: 'U001',
      planningSheetId: 'sheet-1',
      title: 'シート紐付けPDCA',
    });
    expect(item.planningSheetId).toBe('sheet-1');
  });

  // ── List ────────────────────────────────────────────────

  it('lists items filtered by userId', async () => {
    await repo.create({ userId: 'U001', title: 'Item A' });
    await repo.create({ userId: 'U002', title: 'Item B' });
    await repo.create({ userId: 'U001', title: 'Item C' });

    const u001Items = await repo.list({ userId: 'U001' });
    expect(u001Items).toHaveLength(2);
    expect(u001Items.every((i) => i.userId === 'U001')).toBe(true);
  });

  it('returns empty array when userId has no items', async () => {
    const result = await repo.list({ userId: 'nonexistent' });
    expect(result).toEqual([]);
  });

  it('returns empty array when userId is undefined', async () => {
    const result = await repo.list({});
    expect(result).toEqual([]);
  });

  it('filters by planningSheetId when provided', async () => {
    await repo.create({ userId: 'U001', planningSheetId: 'sheet-1', title: 'Item A' });
    await repo.create({ userId: 'U001', planningSheetId: 'sheet-2', title: 'Item B' });

    const sheet1Items = await repo.list({ userId: 'U001', planningSheetId: 'sheet-1' });
    expect(sheet1Items).toHaveLength(1);
    expect(sheet1Items[0]?.planningSheetId).toBe('sheet-1');
  });

  // ── Update ──────────────────────────────────────────────

  it('updates an existing item', async () => {
    const created = await repo.create({
      userId: 'U001',
      title: 'Original',
      phase: 'PLAN',
    });

    const updated = await repo.update({
      id: created.id,
      title: 'Updated Title',
      phase: 'DO',
      summary: '新しい概要',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated Title');
    expect(updated.phase).toBe('DO');
    expect(updated.summary).toBe('新しい概要');
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.updatedAt).getTime(),
    );
  });

  it('preserves unchanged fields during update', async () => {
    const created = await repo.create({
      userId: 'U001',
      title: 'Keep This',
      summary: 'Keep Summary',
      phase: 'PLAN',
    });

    const updated = await repo.update({
      id: created.id,
      phase: 'CHECK',
    });

    expect(updated.title).toBe('Keep This');
    expect(updated.summary).toBe('Keep Summary');
    expect(updated.phase).toBe('CHECK');
  });

  it('updates planningSheetId when provided', async () => {
    const created = await repo.create({
      userId: 'U001',
      planningSheetId: 'sheet-1',
      title: 'Sheet Link',
    });

    const updated = await repo.update({
      id: created.id,
      planningSheetId: 'sheet-2',
    });

    expect(updated.planningSheetId).toBe('sheet-2');
  });

  it('throws when updating non-existent item', async () => {
    await expect(
      repo.update({ id: 'nonexistent', title: 'fail' }),
    ).rejects.toThrow('PDCA item not found');
  });

  // ── Delete ──────────────────────────────────────────────

  it('deletes an item', async () => {
    const created = await repo.create({ userId: 'U001', title: 'To Delete' });
    await repo.delete({ id: created.id });

    const remaining = await repo.list({ userId: 'U001' });
    expect(remaining.find((i) => i.id === created.id)).toBeUndefined();
  });

  it('is idempotent for deleting non-existent item', async () => {
    await expect(repo.delete({ id: 'nonexistent' })).resolves.not.toThrow();
  });

  // ── Full CRUD flow ────────────────────────────────────────

  it('supports full create → update → list → delete cycle', async () => {
    // Create
    const item = await repo.create({
      userId: 'U001',
      title: '環境調整仮説',
      phase: 'PLAN',
    });

    // Update
    await repo.update({ id: item.id, phase: 'DO', summary: '実施開始' });

    // List
    const items = await repo.list({ userId: 'U001' });
    const found = items.find((i) => i.id === item.id);
    expect(found).toBeDefined();
    expect(found!.phase).toBe('DO');
    expect(found!.summary).toBe('実施開始');

    // Delete
    await repo.delete({ id: item.id });
    const afterDelete = await repo.list({ userId: 'U001' });
    expect(afterDelete.find((i) => i.id === item.id)).toBeUndefined();
  });
});
