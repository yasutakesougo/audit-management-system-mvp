/**
 * Iceberg planningSheetId 接続テスト
 *
 * 6-A: IcebergSession / icebergSnapshotSchema に planningSheetId が追加されたことを検証
 * 6-B: IcebergPdcaItem / CreatePdcaInput に planningSheetId が追加されたことを検証
 * 6-C: SupportPlanBundle に icebergCountBySheet / latestMonitoring が追加されたことを検証
 */
import { describe, expect, it } from 'vitest';
import {
  icebergSnapshotSchema,
  type IcebergSession,
} from '@/features/ibd/analysis/iceberg/icebergTypes';
import type { IcebergPdcaItem } from '@/features/ibd/analysis/pdca/types';
import type { CreatePdcaInput, PdcaListQuery, UpdatePdcaInput } from '@/features/ibd/analysis/pdca/domain/pdcaRepository';
import type { SupportPlanBundle } from '@/domain/isp/schema';

// ---------- helpers ----------

function makeValidSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1 as const,
    sessionId: 'sess-001',
    userId: 'user-001',
    title: 'Test Session',
    updatedAt: '2026-03-13T00:00:00Z',
    nodes: [],
    links: [],
    logs: [],
    ...overrides,
  };
}

// =============================
// 6-A: IcebergSession + snapshot
// =============================

describe('6-A: IcebergSession planningSheetId', () => {
  it('IcebergSession accepts planningSheetId', () => {
    const session: IcebergSession = {
      id: 'sess-001',
      targetUserId: 'user-001',
      planningSheetId: 'ps-001',
      title: 'Test',
      createdAt: '2026-03-13T00:00:00Z',
      updatedAt: '2026-03-13T00:00:00Z',
      nodes: [],
      links: [],
      logs: [],
    };
    expect(session.planningSheetId).toBe('ps-001');
  });

  it('IcebergSession allows planningSheetId to be undefined (backward compat)', () => {
    const session: IcebergSession = {
      id: 'sess-002',
      targetUserId: 'user-001',
      title: 'Legacy Session',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      nodes: [],
      links: [],
      logs: [],
    };
    expect(session.planningSheetId).toBeUndefined();
  });
});

describe('6-A: icebergSnapshotSchema planningSheetId', () => {
  it('accepts snapshot with planningSheetId', () => {
    const input = makeValidSnapshot({ planningSheetId: 'ps-001' });
    const result = icebergSnapshotSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planningSheetId).toBe('ps-001');
    }
  });

  it('accepts snapshot without planningSheetId (backward compat)', () => {
    const input = makeValidSnapshot();
    const result = icebergSnapshotSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planningSheetId).toBeUndefined();
    }
  });

  it('rejects empty string planningSheetId', () => {
    const input = makeValidSnapshot({ planningSheetId: '' });
    const result = icebergSnapshotSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts snapshot with both userId and planningSheetId', () => {
    const input = makeValidSnapshot({
      userId: 'user-abc',
      planningSheetId: 'ps-xyz',
    });
    const result = icebergSnapshotSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userId).toBe('user-abc');
      expect(result.data.planningSheetId).toBe('ps-xyz');
    }
  });

  it('round-trips planningSheetId through parse', () => {
    const input = makeValidSnapshot({ planningSheetId: 'ps-round-trip' });
    const parsed = icebergSnapshotSchema.parse(input);
    const reparsed = icebergSnapshotSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.planningSheetId).toBe('ps-round-trip');
  });
});

// =============================
// 6-B: IcebergPdcaItem + inputs
// =============================

describe('6-B: IcebergPdcaItem planningSheetId', () => {
  it('IcebergPdcaItem accepts planningSheetId', () => {
    const item: IcebergPdcaItem = {
      id: 'pdca-001',
      userId: 'user-001',
      planningSheetId: 'ps-001',
      title: 'PDCA cycle',
      summary: 'Test',
      phase: 'PLAN',
      createdAt: '2026-03-13T00:00:00Z',
      updatedAt: '2026-03-13T00:00:00Z',
    };
    expect(item.planningSheetId).toBe('ps-001');
  });

  it('IcebergPdcaItem allows planningSheetId to be undefined', () => {
    const item: IcebergPdcaItem = {
      id: 'pdca-002',
      userId: 'user-001',
      title: 'Legacy PDCA',
      summary: '',
      phase: 'DO',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    expect(item.planningSheetId).toBeUndefined();
  });
});

describe('6-B: CreatePdcaInput planningSheetId', () => {
  it('accepts planningSheetId', () => {
    const input: CreatePdcaInput = {
      userId: 'user-001',
      planningSheetId: 'ps-001',
      title: 'New PDCA',
    };
    expect(input.planningSheetId).toBe('ps-001');
  });

  it('works without planningSheetId', () => {
    const input: CreatePdcaInput = {
      userId: 'user-001',
      title: 'Legacy PDCA',
    };
    expect(input.planningSheetId).toBeUndefined();
  });
});

describe('6-B: UpdatePdcaInput planningSheetId', () => {
  it('accepts planningSheetId', () => {
    const input: UpdatePdcaInput = {
      id: 'pdca-001',
      planningSheetId: 'ps-002',
    };
    expect(input.planningSheetId).toBe('ps-002');
  });
});

describe('6-B: PdcaListQuery planningSheetId', () => {
  it('accepts planningSheetId for filtering', () => {
    const query: PdcaListQuery = {
      userId: 'user-001',
      planningSheetId: 'ps-001',
    };
    expect(query.planningSheetId).toBe('ps-001');
  });

  it('works with only userId (backward compat)', () => {
    const query: PdcaListQuery = { userId: 'user-001' };
    expect(query.planningSheetId).toBeUndefined();
  });
});

// =============================
// 6-C: SupportPlanBundle extensions
// =============================

describe('6-C: SupportPlanBundle extensions', () => {
  it('accepts icebergCountBySheet', () => {
    const bundle: Partial<SupportPlanBundle> = {
      icebergCountBySheet: {
        'ps-001': 3,
        'ps-002': 1,
      },
    };
    expect(bundle.icebergCountBySheet?.['ps-001']).toBe(3);
  });

  it('accepts latestMonitoring', () => {
    const bundle: Partial<SupportPlanBundle> = {
      latestMonitoring: {
        date: '2026-02-15',
        planChangeRequired: true,
      },
    };
    expect(bundle.latestMonitoring?.planChangeRequired).toBe(true);
  });

  it('accepts latestMonitoring as null', () => {
    const bundle: Partial<SupportPlanBundle> = {
      latestMonitoring: null,
    };
    expect(bundle.latestMonitoring).toBeNull();
  });

  it('accepts empty icebergCountBySheet', () => {
    const bundle: Partial<SupportPlanBundle> = {
      icebergCountBySheet: {},
    };
    expect(Object.keys(bundle.icebergCountBySheet!)).toHaveLength(0);
  });

  it('all new fields are optional (backward compat)', () => {
    const bundle: Partial<SupportPlanBundle> = {};
    expect(bundle.icebergCountBySheet).toBeUndefined();
    expect(bundle.latestMonitoring).toBeUndefined();
  });
});
