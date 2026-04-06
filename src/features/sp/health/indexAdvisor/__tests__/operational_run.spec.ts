
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeIndexRemediation } from '../spIndexRemediationService';
import { driftEventBus } from '@/features/diagnostics/drift/domain/DriftEventBus';
import type { UseSP } from '@/lib/spClient';

// Mock driftEventBus
vi.mock('@/features/diagnostics/drift/domain/DriftEventBus', () => ({
  driftEventBus: {
    emit: vi.fn(),
  },
}));

// Mock spListRegistry — service uses this for existence validation
vi.mock('@/sharepoint/spListRegistry', () => ({
  findListEntry: (key: string) =>
    key === 'AttendanceDaily' ? { key: 'AttendanceDaily', displayName: 'テスト用リスト' } : undefined,
}));

// sessionStorage mock (jsdom doesn't persist between tests without reset)
function clearRemediationStorage() {
  Object.keys(sessionStorage).forEach((k) => {
    if (k.startsWith('sp-index-remediation')) sessionStorage.removeItem(k);
  });
}

describe('spIndexRemediationService — guards', () => {
  let mockSp: { updateField: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    clearRemediationStorage();
    mockSp = {
      updateField: vi.fn().mockResolvedValue('success'),
    };
  });

  // ── Guard 1: delete封印 ───────────────────────────────────────────────────

  it('rejects delete action immediately (delete_disabled)', async () => {
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'delete',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('delete_disabled');
    expect(mockSp.updateField).not.toHaveBeenCalled();
  });

  // ── Guard 2: 入力値検証 ───────────────────────────────────────────────────

  it('rejects empty listTitle (validation_error)', async () => {
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: '',
      internalName: 'RecordDate',
      action: 'create',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('validation_error');
    expect(mockSp.updateField).not.toHaveBeenCalled();
  });

  // ── Guard 3: レジストリ確認 ───────────────────────────────────────────────

  it('rejects lists not in registry (registry_not_found)', async () => {
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'UnknownList',
      internalName: 'SomeField',
      action: 'create',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('registry_not_found');
    expect(mockSp.updateField).not.toHaveBeenCalled();
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ listName: 'UnknownList', resolved: false }),
    );
  });

  // ── Guard 4: 1日上限 ──────────────────────────────────────────────────────

  it('rejects when daily limit is exceeded (daily_limit_exceeded)', async () => {
    // exhaust the limit with 5 successful executions (each uses a different field)
    for (let i = 0; i < 5; i++) {
      const r = await executeIndexRemediation(mockSp as unknown as UseSP, {
        listTitle: 'AttendanceDaily',
        internalName: `Field${i}`,
        action: 'create',
      });
      expect(r.ok).toBe(true);
    }

    // 6th attempt must be rejected
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'FieldNew',
      action: 'create',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('daily_limit_exceeded');
    expect(mockSp.updateField).toHaveBeenCalledTimes(5); // only the first 5
  });

  // ── Guard 5: 重複実行禁止 ─────────────────────────────────────────────────

  it('rejects duplicate action on the same field in the same session (duplicate_action)', async () => {
    const params = {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create' as const,
    };

    const first = await executeIndexRemediation(mockSp as unknown as UseSP, params);
    expect(first.ok).toBe(true);

    const second = await executeIndexRemediation(mockSp as unknown as UseSP, params);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('duplicate_action');
    expect(mockSp.updateField).toHaveBeenCalledTimes(1);
  });

  // ── 正常実行 ──────────────────────────────────────────────────────────────

  it('successfully creates an index and emits audit log', async () => {
    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('RecordDate');
    expect(mockSp.updateField).toHaveBeenCalledWith(
      'AttendanceDaily',
      'RecordDate',
      { Indexed: true },
    );
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        listName: 'AttendanceDaily',
        resolved: true,
        severity: 'info',
      }),
    );
  });

  // ── SP更新失敗 ────────────────────────────────────────────────────────────

  it('returns update_failed when SharePoint returns error status', async () => {
    mockSp.updateField.mockResolvedValue('error');

    const result = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('update_failed');
    expect(driftEventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false, severity: 'warn' }),
    );
  });

  it('does NOT increment daily count on failure', async () => {
    mockSp.updateField.mockResolvedValue('error');

    await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'RecordDate',
      action: 'create',
    });

    // next attempt with different field should still be allowed (count stayed at 0)
    mockSp.updateField.mockResolvedValue('success');
    const retry = await executeIndexRemediation(mockSp as unknown as UseSP, {
      listTitle: 'AttendanceDaily',
      internalName: 'AnotherField',
      action: 'create',
    });
    expect(retry.ok).toBe(true);
  });
});
