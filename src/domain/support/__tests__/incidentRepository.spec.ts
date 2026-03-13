// ---------------------------------------------------------------------------
// incidentRepository.spec — インシデント記録リポジトリのユニットテスト
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncidentRecord } from '../incidentRepository';
import { computeIncidentSummary, createIncidentRecord } from '../incidentRepository';
import type { HighRiskIncident } from '../highRiskIncident';

// ---------------------------------------------------------------------------
// Mocked localStorage for localIncidentRepository
// ---------------------------------------------------------------------------

const mockStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    mockStorage.delete(key);
  }),
});

// Dynamic import after mock setup
const { localIncidentRepository } = await import(
  '@/infra/localStorage/localIncidentRepository'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testIdCounter = 0;

function baseIncident(overrides: Partial<HighRiskIncident> = {}): HighRiskIncident {
  testIdCounter++;
  return {
    id: `inc_test_${testIdCounter}`,
    userId: 'user-001',
    occurredAt: new Date().toISOString(),
    severity: '中',
    description: 'テスト事象',
    ...overrides,
  };
}

function baseRecord(overrides: Partial<IncidentRecord> = {}): IncidentRecord {
  return createIncidentRecord(baseIncident(overrides), {
    reportedBy: 'テスト職員',
    incidentType: 'behavior',
    immediateResponse: '声かけで対応',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests: localIncidentRepository
// ---------------------------------------------------------------------------

describe('localIncidentRepository', () => {
  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    testIdCounter = 0;
  });

  describe('save', () => {
    it('新規レコードを保存してIDを返す', async () => {
      const record = baseRecord();
      const saved = await localIncidentRepository.save(record);

      expect(saved.id).toBeDefined();
      expect(saved.userId).toBe('user-001');
      expect(saved.severity).toBe('中');
    });

    it('既存レコードを更新する', async () => {
      const record = baseRecord({ id: 'fixed-id-001' } as Partial<IncidentRecord>);
      await localIncidentRepository.save(record);

      const updated = { ...record, description: '更新済み' };
      const saved = await localIncidentRepository.save(updated);

      expect(saved.description).toBe('更新済み');
      const all = await localIncidentRepository.getAll();
      expect(all).toHaveLength(1);
    });

    it('新しいレコードが先頭に追加される', async () => {
      await localIncidentRepository.save(baseRecord({ description: 'first' } as Partial<IncidentRecord>));
      await localIncidentRepository.save(baseRecord({ description: 'second' } as Partial<IncidentRecord>));

      const all = await localIncidentRepository.getAll();
      expect(all).toHaveLength(2);
      expect(all[0].description).toBe('second');
    });
  });

  describe('getAll', () => {
    it('空の場合は空配列を返す', async () => {
      const all = await localIncidentRepository.getAll();
      expect(all).toEqual([]);
    });
  });

  describe('getByUserId', () => {
    it('ユーザーIDでフィルターする', async () => {
      await localIncidentRepository.save(baseRecord({ userId: 'u1' }));
      await localIncidentRepository.save(baseRecord({ userId: 'u2' }));
      await localIncidentRepository.save(baseRecord({ userId: 'u1' }));

      const u1Records = await localIncidentRepository.getByUserId('u1');
      expect(u1Records).toHaveLength(2);
      expect(u1Records.every((r) => r.userId === 'u1')).toBe(true);
    });
  });

  describe('getById', () => {
    it('IDでレコードを取得する', async () => {
      const record = baseRecord({ id: 'target-id' } as Partial<IncidentRecord>);
      await localIncidentRepository.save(record);

      const found = await localIncidentRepository.getById('target-id');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('target-id');
    });

    it('存在しないIDの場合はnullを返す', async () => {
      const found = await localIncidentRepository.getById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('delete', () => {
    it('レコードを削除する', async () => {
      const record = baseRecord({ id: 'delete-me' } as Partial<IncidentRecord>);
      await localIncidentRepository.save(record);
      expect(await localIncidentRepository.getAll()).toHaveLength(1);

      await localIncidentRepository.delete('delete-me');
      expect(await localIncidentRepository.getAll()).toHaveLength(0);
    });
  });

  describe('FIFO', () => {
    it('MAX_RECORDS(500)を超えると古いレコードが削除される', async () => {
      // 502 件保存 → 500 件に切り詰められるはず
      for (let i = 0; i < 502; i++) {
        await localIncidentRepository.save(
          baseRecord({ id: `fifo_${String(i).padStart(4, '0')}` } as Partial<IncidentRecord>),
        );
      }

      const all = await localIncidentRepository.getAll();
      expect(all).toHaveLength(500);

      // 最新(fifo_0501)が先頭にある
      expect(all[0].id).toBe('fifo_0501');
      // 最古(fifo_0000, fifo_0001)は削除されている
      expect(all.find((r) => r.id === 'fifo_0000')).toBeUndefined();
      expect(all.find((r) => r.id === 'fifo_0001')).toBeUndefined();
    });

    it('ちょうど MAX_RECORDS の場合はすべて保持される', async () => {
      for (let i = 0; i < 500; i++) {
        await localIncidentRepository.save(
          baseRecord({ id: `exact_${i}` } as Partial<IncidentRecord>),
        );
      }

      const all = await localIncidentRepository.getAll();
      expect(all).toHaveLength(500);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: createIncidentRecord
// ---------------------------------------------------------------------------

describe('createIncidentRecord', () => {
  it('HighRiskIncident から IncidentRecord を正しく生成する', () => {
    const incident = baseIncident({ id: 'hi-001', severity: '高' });
    const record = createIncidentRecord(incident, {
      reportedBy: '田中太郎',
      incidentType: 'injury',
      immediateResponse: '応急処置',
      relatedStaff: ['佐藤', '鈴木'],
      followUpRequired: true,
      followUpNotes: '経過観察',
    });

    expect(record.id).toBe('hi-001');
    expect(record.severity).toBe('高');
    expect(record.reportedBy).toBe('田中太郎');
    expect(record.incidentType).toBe('injury');
    expect(record.immediateResponse).toBe('応急処置');
    expect(record.relatedStaff).toEqual(['佐藤', '鈴木']);
    expect(record.followUpRequired).toBe(true);
    expect(record.followUpNotes).toBe('経過観察');
    expect(record.reportedAt).toBeDefined();
  });

  it('デフォルト値が正しく適用される', () => {
    const incident = baseIncident();
    const record = createIncidentRecord(incident, { reportedBy: '自動' });

    expect(record.incidentType).toBe('behavior');
    expect(record.immediateResponse).toBe('');
    expect(record.relatedStaff).toEqual([]);
    expect(record.followUpRequired).toBe(false);
    expect(record.followUpNotes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: computeIncidentSummary
// ---------------------------------------------------------------------------

describe('computeIncidentSummary', () => {
  it('空配列のサマリーを計算する', () => {
    const summary = computeIncidentSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.bySeverity['低']).toBe(0);
    expect(summary.pendingFollowUp).toBe(0);
    expect(summary.last30Days).toBe(0);
  });

  it('レコード配列のサマリーを正しく計算する', () => {
    const now = new Date();
    const records: IncidentRecord[] = [
      baseRecord({ severity: '高', followUpRequired: true, occurredAt: now.toISOString() }),
      baseRecord({ severity: '中', followUpRequired: false, occurredAt: now.toISOString() }),
      baseRecord({
        severity: '低',
        followUpRequired: true,
        occurredAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ] as IncidentRecord[];

    const summary = computeIncidentSummary(records);

    expect(summary.total).toBe(3);
    expect(summary.bySeverity['高']).toBe(1);
    expect(summary.bySeverity['中']).toBe(1);
    expect(summary.bySeverity['低']).toBe(1);
    expect(summary.pendingFollowUp).toBe(2);
    expect(summary.last30Days).toBe(2); // 60日前は含まない
  });

  it('incidentType 別の集計が正しい', () => {
    const records: IncidentRecord[] = [
      baseRecord({ incidentType: 'behavior' } as Partial<IncidentRecord>),
      baseRecord({ incidentType: 'injury' } as Partial<IncidentRecord>),
      baseRecord({ incidentType: 'behavior' } as Partial<IncidentRecord>),
    ] as IncidentRecord[];

    const summary = computeIncidentSummary(records);
    expect(summary.byType.behavior).toBe(2);
    expect(summary.byType.injury).toBe(1);
  });
});
