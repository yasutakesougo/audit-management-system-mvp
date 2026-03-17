/**
 * buildTimeline — ユニットテスト
 *
 * 4ドメイン結合 → フィルタ → ソートの統合テスト。
 */

import { describe, it, expect } from 'vitest';
import { buildTimeline } from '../buildTimeline';
import type { TimelineSources, TimelineOptions } from '../buildTimeline';
import type { PersonDaily } from '@/domain/daily/types';
import type { HighRiskIncident } from '@/domain/support/highRiskIncident';
import type { IndividualSupportPlan } from '@/domain/isp/schema';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';

// ─── テストデータ ──────────────────────────────

const makeDaily = (id: number, date: string): PersonDaily => ({
  id,
  userId: 'U001',
  userName: '田中',
  date,
  status: '完了',
  reporter: { name: '佐藤', id: 'R001' },
  draft: { isDraft: false },
  kind: 'A',
  data: { amActivities: [], pmActivities: [] },
});

const makeIncident = (
  id: string,
  occurredAt: string,
  severity: '低' | '中' | '高' | '重大インシデント' = '中',
): HighRiskIncident => ({
  id,
  userId: 'U001',
  occurredAt,
  severity,
  description: 'テスト',
});

const makeIsp = (
  id: string,
  createdAt: string,
): IndividualSupportPlan =>
  ({
    id,
    userId: 'U001',
    title: 'テスト ISP',
    planStartDate: '2026-04-01',
    planEndDate: '2027-03-31',
    userIntent: 'テスト',
    familyIntent: '',
    overallSupportPolicy: 'テスト',
    qolIssues: '',
    longTermGoals: ['目標'],
    shortTermGoals: ['目標'],
    supportSummary: '',
    precautions: '',
    consentAt: null,
    deliveredAt: null,
    monitoringSummary: '',
    lastMonitoringAt: null,
    nextReviewAt: null,
    status: 'active',
    isCurrent: true,
    createdAt,
    createdBy: 'admin',
    updatedAt: createdAt,
    updatedBy: 'admin',
    version: 1,
  }) as IndividualSupportPlan;

const makeHandoff = (id: number, createdAt: string): HandoffRecord => ({
  id,
  title: '申し送り',
  message: '',
  userCode: 'UC001',
  userDisplayName: '田中',
  category: '体調',
  severity: '通常',
  status: '未対応',
  timeBand: '午前',
  createdAt,
  createdByName: '佐藤',
  isDraft: false,
});

// ─── テスト ─────────────────────────────────────

describe('buildTimeline', () => {
  // ── 基本結合 ──

  it('空ソースなら空配列', () => {
    expect(buildTimeline({})).toEqual([]);
  });

  it('全ドメインを結合してイベント数が正しい', () => {
    const sources: TimelineSources = {
      dailyRecords: [makeDaily(1, '2026-03-15')],
      incidents: [makeIncident('INC-1', '2026-03-15T10:00:00Z')],
      ispRecords: [makeIsp('ISP-1', '2026-03-15')],
      handoffRecords: [makeHandoff(100, '2026-03-15T09:00:00Z')],
    };
    const result = buildTimeline(sources);
    expect(result).toHaveLength(4);
  });

  // ── ソート ──

  it('occurredAt 降順にソートされる', () => {
    const sources: TimelineSources = {
      dailyRecords: [makeDaily(1, '2026-03-10')],
      incidents: [makeIncident('INC-1', '2026-03-15T10:00:00Z')],
      handoffRecords: [makeHandoff(100, '2026-03-12T09:00:00Z')],
    };
    const result = buildTimeline(sources);
    expect(result.map((e) => e.id)).toEqual([
      'incident-INC-1',     // 2026-03-15
      'handoff-100',        // 2026-03-12
      'daily-1',            // 2026-03-10
    ]);
  });

  // ── Handoff resolver ──

  it('resolver が null を返した Handoff は除外される', () => {
    const sources: TimelineSources = {
      handoffRecords: [
        makeHandoff(100, '2026-03-15T09:00:00Z'),
        makeHandoff(101, '2026-03-15T10:00:00Z'),
      ],
    };
    const options: TimelineOptions = {
      resolveUserIdFromCode: (code) => (code === 'UC001' ? null : code),
    };
    // UC001 は null → 両方 UC001 なので全て除外
    const result = buildTimeline(sources, options);
    expect(result).toHaveLength(0);
  });

  it('resolver 省略時は identity として動作', () => {
    const sources: TimelineSources = {
      handoffRecords: [makeHandoff(100, '2026-03-15T09:00:00Z')],
    };
    const result = buildTimeline(sources);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('UC001'); // identity → userCode がそのまま
  });

  // ── ソースフィルタ ──

  it('filter.sources で特定ドメインのみ取得', () => {
    const sources: TimelineSources = {
      dailyRecords: [makeDaily(1, '2026-03-15')],
      incidents: [makeIncident('INC-1', '2026-03-15T10:00:00Z')],
    };
    const result = buildTimeline(sources, {
      filter: { sources: ['daily'] },
    });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('daily');
  });

  // ── 期間フィルタ ──

  it('filter.from で開始日以降のみ取得', () => {
    const sources: TimelineSources = {
      dailyRecords: [
        makeDaily(1, '2026-03-01'),
        makeDaily(2, '2026-03-15'),
      ],
    };
    const result = buildTimeline(sources, {
      filter: { from: '2026-03-10' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('daily-2');
  });

  it('filter.to で終了日以前のみ取得', () => {
    const sources: TimelineSources = {
      dailyRecords: [
        makeDaily(1, '2026-03-01'),
        makeDaily(2, '2026-03-15'),
      ],
    };
    const result = buildTimeline(sources, {
      filter: { to: '2026-03-10' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('daily-1');
  });

  // ── 重要度フィルタ ──

  it('filter.severity で指定以上のみ取得', () => {
    const sources: TimelineSources = {
      dailyRecords: [makeDaily(1, '2026-03-15')], // info
      incidents: [
        makeIncident('INC-1', '2026-03-15T10:00:00Z', '中'), // warning
        makeIncident('INC-2', '2026-03-15T11:00:00Z', '高'), // critical
      ],
    };
    const result = buildTimeline(sources, {
      filter: { severity: 'warning' },
    });
    expect(result).toHaveLength(2); // warning + critical
    expect(result.every((e) => e.severity !== 'info')).toBe(true);
  });

  it('filter.severity=critical なら critical のみ', () => {
    const sources: TimelineSources = {
      incidents: [
        makeIncident('INC-1', '2026-03-15T10:00:00Z', '中'), // warning
        makeIncident('INC-2', '2026-03-15T11:00:00Z', '高'), // critical
      ],
    };
    const result = buildTimeline(sources, {
      filter: { severity: 'critical' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('incident-INC-2');
  });

  // ── 複合フィルタ ──

  it('複数フィルタを同時適用', () => {
    const sources: TimelineSources = {
      dailyRecords: [makeDaily(1, '2026-03-15')],
      incidents: [
        makeIncident('INC-1', '2026-03-10T10:00:00Z', '低'), // info, 範囲外
        makeIncident('INC-2', '2026-03-15T11:00:00Z', '高'), // critical, 範囲内
      ],
      handoffRecords: [makeHandoff(100, '2026-03-15T09:00:00Z')],
    };
    const result = buildTimeline(sources, {
      filter: {
        sources: ['incident'],
        from: '2026-03-12',
        severity: 'warning',
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('incident-INC-2');
  });
});
