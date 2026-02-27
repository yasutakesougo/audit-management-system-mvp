import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryServiceProvisionRepository } from '@/features/service-provision/infra/InMemoryServiceProvisionRepository';
import type { UpsertProvisionInput } from '@/features/service-provision/domain/types';

describe('InMemoryServiceProvisionRepository', () => {
  let repo: InMemoryServiceProvisionRepository;

  beforeEach(() => {
    repo = new InMemoryServiceProvisionRepository();
  });

  const baseInput: UpsertProvisionInput = {
    userCode: 'I022',
    recordDateISO: '2026-02-27',
    status: '提供',
  };

  // ─── upsertByEntryKey ──────────────────────────────────────

  it('新規 upsert → レコード作成', async () => {
    const result = await repo.upsertByEntryKey(baseInput);

    expect(result.entryKey).toBe('I022|2026-02-27');
    expect(result.userCode).toBe('I022');
    expect(result.recordDateISO).toBe('2026-02-27');
    expect(result.status).toBe('提供');
    expect(result.id).toBeGreaterThan(0);
  });

  it('同一 EntryKey で再 upsert → 更新（件数増えない）', async () => {
    await repo.upsertByEntryKey(baseInput);
    const updated = await repo.upsertByEntryKey({
      ...baseInput,
      status: '欠席',
      hasMeal: true,
    });

    expect(updated.entryKey).toBe('I022|2026-02-27');
    expect(updated.status).toBe('欠席');
    expect(updated.hasMeal).toBe(true);

    // 件数が1件のまま
    const all = await repo.listByDate('2026-02-27');
    expect(all).toHaveLength(1);
  });

  it('異なる EntryKey → 別レコードとして作成', async () => {
    await repo.upsertByEntryKey(baseInput);
    await repo.upsertByEntryKey({
      ...baseInput,
      userCode: 'I023',
    });

    const all = await repo.listByDate('2026-02-27');
    expect(all).toHaveLength(2);
  });

  it('upsert 時に id は保持される（更新でも変わらない）', async () => {
    const created = await repo.upsertByEntryKey(baseInput);
    const updated = await repo.upsertByEntryKey({
      ...baseInput,
      status: '欠席',
    });
    expect(updated.id).toBe(created.id);
  });

  it('全フィールドが正しく保存される', async () => {
    const fullInput: UpsertProvisionInput = {
      ...baseInput,
      startHHMM: 930,
      endHHMM: 1530,
      hasTransport: true,
      hasMeal: true,
      hasBath: false,
      hasExtended: true,
      hasAbsentSupport: false,
      note: 'テストメモ',
      source: 'Daily',
      updatedByUPN: 'staff@example.com',
    };

    const result = await repo.upsertByEntryKey(fullInput);

    expect(result.startHHMM).toBe(930);
    expect(result.endHHMM).toBe(1530);
    expect(result.hasTransport).toBe(true);
    expect(result.hasMeal).toBe(true);
    expect(result.hasBath).toBe(false);
    expect(result.hasExtended).toBe(true);
    expect(result.hasAbsentSupport).toBe(false);
    expect(result.note).toBe('テストメモ');
    expect(result.source).toBe('Daily');
    expect(result.updatedByUPN).toBe('staff@example.com');
  });

  // ─── getByEntryKey ─────────────────────────────────────────

  it('存在する EntryKey → レコード返却', async () => {
    await repo.upsertByEntryKey(baseInput);
    const found = await repo.getByEntryKey('I022|2026-02-27');

    expect(found).not.toBeNull();
    expect(found!.userCode).toBe('I022');
  });

  it('存在しない EntryKey → null', async () => {
    const found = await repo.getByEntryKey('NOTEXIST|2099-01-01');
    expect(found).toBeNull();
  });

  // ─── listByDate ────────────────────────────────────────────

  it('指定日のレコードのみ返す', async () => {
    await repo.upsertByEntryKey(baseInput);
    await repo.upsertByEntryKey({
      ...baseInput,
      recordDateISO: '2026-02-28',
    });

    const feb27 = await repo.listByDate('2026-02-27');
    const feb28 = await repo.listByDate('2026-02-28');

    expect(feb27).toHaveLength(1);
    expect(feb28).toHaveLength(1);
  });

  it('レコードなし日 → 空配列', async () => {
    const result = await repo.listByDate('2099-01-01');
    expect(result).toEqual([]);
  });

  // ─── デフォルト値 ──────────────────────────────────────────

  it('省略フィールドはデフォルト値が設定される', async () => {
    const result = await repo.upsertByEntryKey(baseInput);

    expect(result.startHHMM).toBeNull();
    expect(result.endHHMM).toBeNull();
    expect(result.hasTransport).toBe(false);
    expect(result.hasMeal).toBe(false);
    expect(result.hasBath).toBe(false);
    expect(result.hasExtended).toBe(false);
    expect(result.hasAbsentSupport).toBe(false);
    expect(result.note).toBe('');
    expect(result.source).toBe('Unified');
    expect(result.updatedByUPN).toBe('');
  });
});
