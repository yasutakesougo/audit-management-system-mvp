/**
 * regulatoryHud — 制度 HUD 信号灯 判定テスト
 */
import { describe, expect, it } from 'vitest';
import type { IspComplianceMetadata } from '@/domain/isp/schema';
import type { DeadlineInfo } from '../../types';
import {
  buildRegulatoryHudItems,
  worstSignal,
  signalCounts,
  type RegulatoryHudInput,
  type RegulatoryHudItem,
} from '../regulatoryHud';

// ── Helpers ──

const makeDeadline = (overrides: Partial<DeadlineInfo> = {}): DeadlineInfo => ({
  label: 'テスト期限',
  color: 'default',
  ...overrides,
});

const makeCompliance = (
  overrides: Partial<IspComplianceMetadata> = {},
): IspComplianceMetadata => ({
  serviceType: 'other',
  standardServiceHours: null,
  consent: {
    explainedAt: null,
    explainedBy: '',
    consentedAt: null,
    consentedBy: '',
    proxyName: '',
    proxyRelation: '',
    notes: '',
  },
  delivery: {
    deliveredAt: null,
    deliveredToUser: false,
    deliveredToConsultationSupport: false,
    deliveryMethod: '',
    notes: '',
  },
  reviewControl: {
    reviewCycleDays: 180,
    lastReviewedAt: null,
    nextReviewDueAt: null,
    reviewReason: '',
  },
  approval: {
    approvedBy: null,
    approvedAt: null,
    approvalStatus: 'draft',
  },
  meeting: {
    meetingDate: null,
    meetingMinutes: '',
    attendees: [],
  },
  consultationSupport: {
    agencyName: '',
    officerName: '',
    serviceUsePlanReceivedAt: null,
    gapNotes: '',
  },
  ...overrides,
});

const makeInput = (overrides: Partial<RegulatoryHudInput> = {}): RegulatoryHudInput => ({
  ispStatus: 'assessment',
  compliance: null,
  deadlines: {
    creation: makeDeadline(),
    monitoring: makeDeadline(),
  },
  latestMonitoring: null,
  icebergTotal: 0,
  ...overrides,
});

const findByKey = (items: RegulatoryHudItem[], key: string) =>
  items.find((i) => i.key === key)!;

// ── Tests ──

describe('buildRegulatoryHudItems', () => {
  it('6項目を返す', () => {
    const items = buildRegulatoryHudItems(makeInput());
    expect(items).toHaveLength(6);
    expect(items.map((i) => i.key)).toEqual([
      'isp-status',
      'consent',
      'delivery',
      'creation-deadline',
      'monitoring-deadline',
      'iceberg-analysis',
    ]);
  });

  // ── ISP ──

  it('ISP active → ok', () => {
    const items = buildRegulatoryHudItems(makeInput({ ispStatus: 'active' }));
    expect(findByKey(items, 'isp-status').signal).toBe('ok');
    expect(findByKey(items, 'isp-status').label).toContain('確定');
  });

  it('ISP assessment → danger', () => {
    const items = buildRegulatoryHudItems(makeInput({ ispStatus: 'assessment' }));
    expect(findByKey(items, 'isp-status').signal).toBe('danger');
  });

  // ── 同意 ──

  it('同意取得済み → ok', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        compliance: makeCompliance({
          consent: {
            explainedAt: '2025-04-01',
            explainedBy: 'A',
            consentedAt: '2025-04-02',
            consentedBy: 'B',
            proxyName: '',
            proxyRelation: '',
            notes: '',
          },
        }),
      }),
    );
    expect(findByKey(items, 'consent').signal).toBe('ok');
  });

  it('説明済み同意なし → warning', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        compliance: makeCompliance({
          consent: {
            explainedAt: '2025-04-01',
            explainedBy: 'A',
            consentedAt: null,
            consentedBy: '',
            proxyName: '',
            proxyRelation: '',
            notes: '',
          },
        }),
      }),
    );
    expect(findByKey(items, 'consent').signal).toBe('warning');
  });

  it('compliance が null → 同意 danger', () => {
    const items = buildRegulatoryHudItems(makeInput({ compliance: null }));
    expect(findByKey(items, 'consent').signal).toBe('danger');
  });

  // ── 交付 ──

  it('交付完了 → ok', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        compliance: makeCompliance({
          delivery: {
            deliveredAt: '2025-04-05',
            deliveredToUser: true,
            deliveredToConsultationSupport: true,
            deliveryMethod: '手渡し',
            notes: '',
          },
        }),
      }),
    );
    expect(findByKey(items, 'delivery').signal).toBe('ok');
  });

  it('交付一部のみ → warning', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        compliance: makeCompliance({
          delivery: {
            deliveredAt: '2025-04-05',
            deliveredToUser: true,
            deliveredToConsultationSupport: false,
            deliveryMethod: '',
            notes: '',
          },
        }),
      }),
    );
    expect(findByKey(items, 'delivery').signal).toBe('warning');
  });

  // ── 作成期限 ──

  it('作成期限未設定 → warning', () => {
    const items = buildRegulatoryHudItems(makeInput());
    expect(findByKey(items, 'creation-deadline').signal).toBe('warning');
  });

  it('作成期限超過 → danger', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        deadlines: {
          creation: makeDeadline({ daysLeft: -3, date: new Date(), color: 'error' }),
          monitoring: makeDeadline(),
        },
      }),
    );
    const item = findByKey(items, 'creation-deadline');
    expect(item.signal).toBe('danger');
    expect(item.label).toContain('3日超過');
  });

  it('作成期限残7日以内 → warning', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        deadlines: {
          creation: makeDeadline({ daysLeft: 5, date: new Date(), color: 'warning' }),
          monitoring: makeDeadline(),
        },
      }),
    );
    expect(findByKey(items, 'creation-deadline').signal).toBe('warning');
  });

  it('作成期限十分 → ok', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        deadlines: {
          creation: makeDeadline({ daysLeft: 20, date: new Date(), color: 'success' }),
          monitoring: makeDeadline(),
        },
      }),
    );
    expect(findByKey(items, 'creation-deadline').signal).toBe('ok');
  });

  // ── モニタリング期限 ──

  it('モニタ期限超過 → danger', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        deadlines: {
          creation: makeDeadline(),
          monitoring: makeDeadline({ daysLeft: -10, date: new Date(), color: 'error' }),
        },
      }),
    );
    expect(findByKey(items, 'monitoring-deadline').signal).toBe('danger');
  });

  it('モニタ期限14日以内 → warning', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        deadlines: {
          creation: makeDeadline(),
          monitoring: makeDeadline({ daysLeft: 10, date: new Date(), color: 'warning' }),
        },
      }),
    );
    expect(findByKey(items, 'monitoring-deadline').signal).toBe('warning');
  });

  // ── Iceberg ──

  it('モニタリング未実施 → danger', () => {
    const items = buildRegulatoryHudItems(
      makeInput({ latestMonitoring: null, icebergTotal: 0 }),
    );
    expect(findByKey(items, 'iceberg-analysis').signal).toBe('danger');
  });

  it('計画変更推奨 → warning', () => {
    const items = buildRegulatoryHudItems(
      makeInput({
        latestMonitoring: { date: '2025-12-01', planChangeRequired: true },
        icebergTotal: 3,
      }),
    );
    expect(findByKey(items, 'iceberg-analysis').signal).toBe('warning');
    expect(findByKey(items, 'iceberg-analysis').label).toContain('再分析');
  });

  it('Iceberg 分析あり + モニタリング正常 → ok', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30);
    const items = buildRegulatoryHudItems(
      makeInput({
        latestMonitoring: {
          date: recentDate.toISOString().slice(0, 10),
          planChangeRequired: false,
        },
        icebergTotal: 5,
      }),
    );
    expect(findByKey(items, 'iceberg-analysis').signal).toBe('ok');
  });

  // ── navigateTo ──

  it('全項目に navigateTo が設定されている', () => {
    const items = buildRegulatoryHudItems(makeInput());
    for (const item of items) {
      expect(item.navigateTo).toBeDefined();
    }
  });
});

// ── ヘルパー ──

describe('worstSignal', () => {
  it('danger が1つでもあれば danger', () => {
    const items = buildRegulatoryHudItems(makeInput());
    expect(worstSignal(items)).toBe('danger');
  });

  it('全て ok なら ok', () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10);
    const items = buildRegulatoryHudItems(
      makeInput({
        ispStatus: 'active',
        compliance: makeCompliance({
          consent: {
            explainedAt: '2025-04-01',
            explainedBy: 'A',
            consentedAt: '2025-04-02',
            consentedBy: 'B',
            proxyName: '',
            proxyRelation: '',
            notes: '',
          },
          delivery: {
            deliveredAt: '2025-04-05',
            deliveredToUser: true,
            deliveredToConsultationSupport: true,
            deliveryMethod: '手渡し',
            notes: '',
          },
        }),
        deadlines: {
          creation: makeDeadline({ daysLeft: 20, date: new Date(), color: 'success' }),
          monitoring: makeDeadline({ daysLeft: 60, date: new Date(), color: 'success' }),
        },
        latestMonitoring: {
          date: recentDate.toISOString().slice(0, 10),
          planChangeRequired: false,
        },
        icebergTotal: 3,
      }),
    );
    expect(worstSignal(items)).toBe('ok');
  });
});

describe('signalCounts', () => {
  it('信号ごとの件数を返す', () => {
    const items = buildRegulatoryHudItems(makeInput({ ispStatus: 'active' }));
    const counts = signalCounts(items);
    expect(counts.ok).toBeGreaterThanOrEqual(1);
    expect(counts.ok + counts.warning + counts.danger).toBe(6);
  });
});
