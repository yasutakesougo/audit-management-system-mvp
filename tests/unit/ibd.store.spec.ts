import { beforeEach, describe, expect, it } from 'vitest';

import {
    calculateNextReviewDueDate,
    daysUntilSPSReview,
    getSPSAlertLevel,
} from '@/features/ibd/ibdTypes';

import {
    addSPS,
    addSupervisionLog,
    canConfirmSPS,
    confirmSPS,
    getAllSPS,
    getExpiringSPSAlerts,
    getSupervisionAlertLevel,
    getSupervisionAlertMessage,
    getSupervisionCounter,
    incrementSupportCount,
    removeSPS,
    resetIBDStore,
    resetSupportCount,
    updateSPS,
} from '@/features/ibd/ibdStore';

import type { SupervisionLog, SupportPlanSheet } from '@/features/ibd/ibdTypes';

// ---------------------------------------------------------------------------
// ibdTypes — ユーティリティ関数テスト
// ---------------------------------------------------------------------------

describe('ibdTypes utilities', () => {
  describe('calculateNextReviewDueDate', () => {
    it('作成日から90日後の日付を返す', () => {
      expect(calculateNextReviewDueDate('2026-01-01')).toBe('2026-04-01');
    });

    it('月末を跨ぐ場合に正しく計算する', () => {
      expect(calculateNextReviewDueDate('2026-11-30')).toBe('2027-02-28');
    });

    it('ISO 8601 datetime でも YYYY-MM-DD を返す', () => {
      const result = calculateNextReviewDueDate('2026-03-15T10:30:00+09:00');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('daysUntilSPSReview', () => {
    it('今日が期限14日前のとき14を返す', () => {
      expect(daysUntilSPSReview('2026-03-14', '2026-02-28')).toBe(14);
    });

    it('期限当日のとき0を返す', () => {
      expect(daysUntilSPSReview('2026-03-01', '2026-03-01')).toBe(0);
    });

    it('期限超過のとき負の値を返す', () => {
      expect(daysUntilSPSReview('2026-02-01', '2026-02-10')).toBe(-9);
    });
  });

  describe('getSPSAlertLevel', () => {
    it('15日以上で ok', () => {
      expect(getSPSAlertLevel(15)).toBe('ok');
    });

    it('14日以内で warning', () => {
      expect(getSPSAlertLevel(14)).toBe('warning');
      expect(getSPSAlertLevel(1)).toBe('warning');
      expect(getSPSAlertLevel(0)).toBe('warning');
    });

    it('負の値（期限超過）で error', () => {
      expect(getSPSAlertLevel(-1)).toBe('error');
      expect(getSPSAlertLevel(-30)).toBe('error');
    });
  });
});

// ---------------------------------------------------------------------------
// ibdStore — ストアロジックテスト
// ---------------------------------------------------------------------------

describe('ibdStore', () => {
  beforeEach(() => {
    resetIBDStore();
  });

  const baseSPS: Omit<SupportPlanSheet, 'nextReviewDueDate'> = {
    id: 'sps-001',
    userId: 1,
    version: '1.0',
    createdAt: '2026-01-15',
    updatedAt: '2026-01-15',
    status: 'draft',
    confirmedBy: null,
    confirmedAt: null,
    icebergModel: {
      observableBehaviors: ['自傷'],
      underlyingFactors: ['感覚過敏'],
      environmentalAdjustments: ['刺激を減らす'],
    },
    positiveConditions: ['穏やかな環境'],
  };

  describe('SPS CRUD', () => {
    it('SPS を追加すると nextReviewDueDate が自動計算される', () => {
      addSPS(baseSPS);
      const sheets = getAllSPS();
      expect(sheets).toHaveLength(1);
      expect(sheets[0].nextReviewDueDate).toBe('2026-04-15');
    });

    it('SPS を更新できる', () => {
      addSPS(baseSPS);
      updateSPS('sps-001', { version: '1.1' });
      expect(getAllSPS()[0].version).toBe('1.1');
    });

    it('SPS を削除できる', () => {
      addSPS(baseSPS);
      removeSPS('sps-001');
      expect(getAllSPS()).toHaveLength(0);
    });

    it('SPS 確定時に confirmedAt を起算点として nextReviewDueDate が再計算される', () => {
      addSPS(baseSPS);
      confirmSPS('sps-001', 100, '2026-02-01');

      const sps = getAllSPS()[0];
      expect(sps.status).toBe('confirmed');
      expect(sps.confirmedBy).toBe(100);
      expect(sps.confirmedAt).toBe('2026-02-01');
      // 起算点は confirmedAt (2/1) → 90日後 = 5/2
      expect(sps.nextReviewDueDate).toBe('2026-05-02');
    });
  });

  describe('SPS アラート', () => {
    it('confirmed な SPS で期限30日以内のものをアラートとして返す', () => {
      addSPS({
        id: 'sps-a',
        userId: 1,
        version: '1.0',
        createdAt: '2025-12-01',
        updatedAt: '2025-12-01',
        status: 'draft',
        confirmedBy: null,
        confirmedAt: null,
        icebergModel: {
          observableBehaviors: [],
          underlyingFactors: [],
          environmentalAdjustments: [],
        },
        positiveConditions: [],
      });
      // 確定: 起算 2025-12-01 → due 2026-03-01
      confirmSPS('sps-a', 1, '2025-12-01');

      // 2026-02-27 時点: 残り2日 → warning
      const alerts = getExpiringSPSAlerts(30, '2026-02-27');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].level).toBe('warning');
      expect(alerts[0].daysRemaining).toBe(2);
    });

    it('draft 状態の SPS はアラート対象外', () => {
      addSPS({
        id: 'sps-draft',
        userId: 1,
        version: '1.0',
        createdAt: '2025-11-01',
        updatedAt: '2025-11-01',
        status: 'draft',
        confirmedBy: null,
        confirmedAt: null,
        icebergModel: {
          observableBehaviors: [],
          underlyingFactors: [],
          environmentalAdjustments: [],
        },
        positiveConditions: [],
      });

      const alerts = getExpiringSPSAlerts(90, '2026-02-27');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('観察カウンター', () => {
    it('初期状態で supportCount は 0', () => {
      const counter = getSupervisionCounter(1);
      expect(counter.supportCount).toBe(0);
      expect(counter.lastObservedAt).toBeNull();
    });

    it('incrementSupportCount でカウントが増加する', () => {
      incrementSupportCount(1);
      incrementSupportCount(1);
      expect(getSupervisionCounter(1).supportCount).toBe(2);
    });

    it('resetSupportCount でカウントが0にリセットされる', () => {
      incrementSupportCount(1);
      incrementSupportCount(1);
      resetSupportCount(1, '2026-02-27');

      const counter = getSupervisionCounter(1);
      expect(counter.supportCount).toBe(0);
      expect(counter.lastObservedAt).toBe('2026-02-27');
    });

    it('addSupervisionLog でカウンターが自動リセットされる', () => {
      incrementSupportCount(1);
      incrementSupportCount(1);

      const log: SupervisionLog = {
        id: 'log-001',
        userId: 1,
        supervisorId: 100,
        observedAt: '2026-02-27',
        notes: '安定した状態で活動参加',
        actionsTaken: ['計画通り支援を実施'],
      };
      addSupervisionLog(log);

      const counter = getSupervisionCounter(1);
      expect(counter.supportCount).toBe(0);
      expect(counter.lastObservedAt).toBe('2026-02-27');
    });
  });
});

// ---------------------------------------------------------------------------
// Pure 関数テスト
// ---------------------------------------------------------------------------

describe('canConfirmSPS', () => {
  it('実践研修修了者は確定可能', () => {
    const result = canConfirmSPS(true);
    expect(result.allowed).toBe(true);
  });

  it('非修了者は確定不可で理由メッセージあり', () => {
    const result = canConfirmSPS(false);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('実践研修修了者');
  });
});

describe('getSupervisionAlertLevel', () => {
  it('0回で ok', () => {
    expect(getSupervisionAlertLevel(0)).toBe('ok');
  });

  it('1回で warning', () => {
    expect(getSupervisionAlertLevel(1)).toBe('warning');
  });

  it('2回以上で overdue', () => {
    expect(getSupervisionAlertLevel(2)).toBe('overdue');
    expect(getSupervisionAlertLevel(5)).toBe('overdue');
  });
});

describe('getSupervisionAlertMessage', () => {
  it('0回で空文字を返す', () => {
    expect(getSupervisionAlertMessage(0)).toBe('');
  });

  it('1回で推奨メッセージを返す', () => {
    expect(getSupervisionAlertMessage(1)).toContain('推奨');
  });

  it('2回以上で超過メッセージを返す', () => {
    expect(getSupervisionAlertMessage(2)).toContain('超過');
  });
});
