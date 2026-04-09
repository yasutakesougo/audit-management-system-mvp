/**
 * computeCtaKpis — 単体テスト
 *
 * pure function なので Firestore 不要。
 * テストデータを直接渡して KPI 算出結果を検証する。
 */
import { describe, it, expect } from 'vitest';
import { computeCtaKpis, type TelemetryRecord } from '../computeCtaKpis';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeCtaRecord(ctaId: string, overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    type: 'todayops_cta_click',
    ctaId,
    sourceComponent: 'Test',
    stateType: 'widget-action',
    clientTs: '2026-03-19T10:00:00.000Z',
    ...overrides,
  };
}

function makeLandingRecord(overrides: Partial<TelemetryRecord> = {}): TelemetryRecord {
  return {
    type: 'todayops_landing',
    path: '/today',
    clientTs: '2026-03-19T10:00:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeCtaKpis', () => {
  it('空配列なら全指標ゼロ', () => {
    const kpis = computeCtaKpis([]);
    expect(kpis.totalEvents).toBe(0);
    expect(kpis.totalCtaClicks).toBe(0);
    expect(kpis.totalLandings).toBe(0);
    expect(kpis.heroQueueRatio.heroCount).toBe(0);
    expect(kpis.heroQueueRatio.queueCount).toBe(0);
    expect(kpis.flowDistribution).toHaveLength(0);
    expect(kpis.funnel).toHaveLength(3);
  });

  // ── Hero vs Queue ──────────────────────────────────────────────

  describe('Hero vs Queue 比率', () => {
    it('Hero CTA のみ → heroRate 100%', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('daily_hero_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.heroQueueRatio.heroCount).toBe(2);
      expect(kpis.heroQueueRatio.queueCount).toBe(0);
      expect(kpis.heroQueueRatio.heroRate).toBe(100);
    });

    it('Queue CTA のみ → queueRate 100%', () => {
      const records = [
        makeCtaRecord('daily_queue_item_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.heroQueueRatio.queueCount).toBe(1);
      expect(kpis.heroQueueRatio.queueRate).toBe(100);
    });

    it('Hero 3 + Queue 1 → heroRate 75%', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('calllog_hero_done_clicked'),
        makeCtaRecord('handoff_hero_confirm_clicked'),
        makeCtaRecord('daily_queue_item_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.heroQueueRatio.heroRate).toBe(75);
      expect(kpis.heroQueueRatio.queueRate).toBe(25);
    });
  });

  // ── Screen KPIs ────────────────────────────────────────────────

  describe('画面別 KPIs', () => {
    it('クリックのある画面だけ返す', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('daily_queue_item_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.screenKpis).toHaveLength(1);
      expect(kpis.screenKpis[0].screen).toBe('daily');
      expect(kpis.screenKpis[0].heroClicks).toBe(1);
      expect(kpis.screenKpis[0].queueClicks).toBe(1);
      expect(kpis.screenKpis[0].heroRate).toBe(50);
    });

    it('複数画面のクリックを正しく分類', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('calllog_priority_item_clicked'),
        makeCtaRecord('handoff_hero_confirm_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.screenKpis).toHaveLength(3);
    });
  });

  // ── Flow Distribution ──────────────────────────────────────────

  describe('導線分布', () => {
    it('CTA IDから遷移先ごとに集計', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('daily_queue_item_clicked'),
        makeCtaRecord('calllog_hero_done_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.flowDistribution).toHaveLength(2);

      const daily = kpis.flowDistribution.find((f) => f.destination === '/daily/activity');
      expect(daily?.count).toBe(2);
      expect(daily?.rate).toBe(67); // 2/3 = 67%

      const calllog = kpis.flowDistribution.find((f) => f.destination === '/calllog');
      expect(calllog?.count).toBe(1);
    });

    it('降順ソート', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('calllog_hero_done_clicked'),
        makeCtaRecord('handoff_hero_confirm_clicked'),
        makeCtaRecord('handoff_hero_done_clicked'),
        makeCtaRecord('handoff_priority_item_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.flowDistribution[0].label).toBe('申し送り'); // 3
      expect(kpis.flowDistribution[1].label).toBe('日々の記録'); // 2
    });
  });

  // ── Funnel ─────────────────────────────────────────────────────

  describe('ファネル', () => {
    it('ランディング → クリック → 完了 の転換率を計算', () => {
      const records: TelemetryRecord[] = [
        makeLandingRecord(),
        makeLandingRecord(),
        makeLandingRecord(),
        makeLandingRecord(),
        makeCtaRecord('daily_hero_clicked'),
        makeCtaRecord('calllog_hero_done_clicked'), // done
        makeCtaRecord('handoff_hero_done_clicked'),  // done
      ];
      const kpis = computeCtaKpis(records);

      expect(kpis.funnel[0].label).toBe('ランディング');
      expect(kpis.funnel[0].count).toBe(4);
      expect(kpis.funnel[0].rate).toBe(100);

      expect(kpis.funnel[1].label).toBe('CTAクリック');
      expect(kpis.funnel[1].count).toBe(3);
      expect(kpis.funnel[1].rate).toBe(75); // 3/4

      expect(kpis.funnel[2].label).toBe('完了');
      expect(kpis.funnel[2].count).toBe(2);
      expect(kpis.funnel[2].rate).toBe(67); // 2/3
    });
  });

  // ── Hourly Distribution ────────────────────────────────────────

  describe('時間帯分布', () => {
    it('6時〜21時の16バケットを返す', () => {
      const kpis = computeCtaKpis([]);
      expect(kpis.hourlyDistribution).toHaveLength(16);
      expect(kpis.hourlyDistribution[0].hour).toBe(6);
      expect(kpis.hourlyDistribution[15].hour).toBe(21);
    });

    it('clientTs から時間帯を正しく分類', () => {
      const records = [
        makeCtaRecord('daily_hero_clicked', { ts: new Date('2026-03-19T09:15:00') }),
        makeCtaRecord('daily_hero_clicked', { ts: new Date('2026-03-19T09:45:00') }),
        makeCtaRecord('daily_hero_clicked', { ts: new Date('2026-03-19T14:00:00') }),
      ];
      const kpis = computeCtaKpis(records);
      const h9 = kpis.hourlyDistribution.find((h) => h.hour === 9);
      const h14 = kpis.hourlyDistribution.find((h) => h.hour === 14);
      expect(h9?.count).toBe(2);
      expect(h14?.count).toBe(1);
    });
  });

  // ── Totals ─────────────────────────────────────────────────────

  describe('合計値', () => {
    it('landing と cta_click をそれぞれカウント', () => {
      const records: TelemetryRecord[] = [
        makeLandingRecord(),
        makeLandingRecord(),
        makeCtaRecord('daily_hero_clicked'),
      ];
      const kpis = computeCtaKpis(records);
      expect(kpis.totalEvents).toBe(3);
      expect(kpis.totalLandings).toBe(2);
      expect(kpis.totalCtaClicks).toBe(1);
    });
  });
});
