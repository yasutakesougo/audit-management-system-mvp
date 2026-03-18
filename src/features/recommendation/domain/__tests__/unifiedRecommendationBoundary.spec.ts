/**
 * Contract Tests: buildUnifiedRecommendation — 境界値補完
 *
 * 既存の unifiedRecommendation.spec.ts (16件) に対して、
 * 未カバーの優先度境界・factor 競合・具体値・secondaryNotes 組み合わせを固定。
 *
 * ## 追加する観点
 *
 * ### 優先度の全境界
 * - missing-record + high-intensity 同時 → missing-record が勝つ（P2 > P3）
 * - high-intensity + snapshot-urgent 同時 → high-intensity が勝つ（P3 > P4）
 * - snapshot-urgent + missing-plan 同時 → snapshot-urgent が勝つ（P4 > P5）
 * - todaySnapshot urgency=medium → snapshot-urgent にならない
 * - todaySnapshot urgency=low → snapshot-urgent にならない
 * - todaySnapshot が null → snapshot-urgent にならない（crashしない）
 *
 * ### 具体値の固定
 * - 各 factor の headline / suggestedAction / actionRoute
 * - missing-record: actionRoute が /daily/activity?userId={encoded}
 * - userId 特殊文字のエンコード
 *
 * ### secondaryNotes の組み合わせ
 * - 問題なし → 0件
 * - 1つのみ → 1件
 * - 3つ以上あっても最大2件
 * - primary factor は secondaryNotes から除外される
 * - isHighIntensity が secondary に入る条件
 */
import { describe, expect, it } from 'vitest';
import {
  buildUnifiedRecommendation,
  buildUnifiedRecommendations,
  type UnifiedRecommendationInput,
} from '../unifiedRecommendation';

function makeInput(overrides: Partial<UnifiedRecommendationInput> = {}): UnifiedRecommendationInput {
  return {
    userId: 'U-001',
    contextAlerts: [],
    todaySnapshot: null,
    hasRecordToday: true,
    criticalHandoffCount: 0,
    hasPlan: true,
    isHighIntensity: false,
    ...overrides,
  };
}

// ─── 優先度の全境界 ───────────────────────────────────────────

describe('buildUnifiedRecommendation — 優先度境界補完', () => {
  it('P2 > P3: missing-record は high-intensity より優先される', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, isHighIntensity: true }),
    );
    expect(result.primaryFactor).toBe('missing-record');
  });

  it('P3 > P4: high-intensity は snapshot-urgent より優先される', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        isHighIntensity: true,
        todaySnapshot: { nextAction: '確認', nextActionPath: '/today', urgency: 'high' },
      }),
    );
    expect(result.primaryFactor).toBe('high-intensity');
  });

  it('P4 > P5: snapshot-urgent は missing-plan より優先される', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        hasPlan: false,
        todaySnapshot: { nextAction: '確認', nextActionPath: '/today', urgency: 'high' },
      }),
    );
    expect(result.primaryFactor).toBe('snapshot-urgent');
  });

  it('P1 > all: criticalHandoffCount > 0 は全条件を上回る', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        criticalHandoffCount: 3,
        hasRecordToday: false,
        isHighIntensity: true,
        hasPlan: false,
        todaySnapshot: { nextAction: '確認', nextActionPath: '/today', urgency: 'high' },
      }),
    );
    expect(result.primaryFactor).toBe('critical-handoff');
    expect(result.urgency).toBe('critical');
  });

  it('todaySnapshot urgency=medium → snapshot-urgent にならない', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        todaySnapshot: { nextAction: '確認', nextActionPath: '/today', urgency: 'medium' },
      }),
    );
    expect(result.primaryFactor).not.toBe('snapshot-urgent');
  });

  it('todaySnapshot urgency=low → snapshot-urgent にならない', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        todaySnapshot: { nextAction: '確認', nextActionPath: '/today', urgency: 'low' },
      }),
    );
    expect(result.primaryFactor).not.toBe('snapshot-urgent');
  });

  it('todaySnapshot が null でもクラッシュしない', () => {
    expect(() => buildUnifiedRecommendation(makeInput({ todaySnapshot: null }))).not.toThrow();
  });
});

// ─── 各 factor の具体値固定 ─────────────────────────────────

describe('buildUnifiedRecommendation — factor 具体値', () => {
  it('critical-handoff: headline / suggestedAction / actionRoute の具体値', () => {
    const result = buildUnifiedRecommendation(makeInput({ criticalHandoffCount: 1 }));
    expect(result.headline).toBe('重要な申し送りが未対応です — 今すぐ確認してください');
    expect(result.suggestedAction).toBe('申し送りを確認する');
    expect(result.actionRoute).toBe('/handoff/timeline');
    expect(result.urgency).toBe('critical');
  });

  it('missing-record: headline / suggestedAction の具体値', () => {
    const result = buildUnifiedRecommendation(makeInput({ hasRecordToday: false }));
    expect(result.headline).toBe('本日の記録がまだ入力されていません');
    expect(result.suggestedAction).toBe('記録を入力する');
    expect(result.urgency).toBe('high');
  });

  it('high-intensity: headline / suggestedAction / actionRoute の具体値', () => {
    const result = buildUnifiedRecommendation(makeInput({ isHighIntensity: true }));
    expect(result.headline).toBe('強度行動障害対象者です — 支援手順に従って対応してください');
    expect(result.suggestedAction).toBe('支援手順書を確認する');
    expect(result.actionRoute).toBe('/planning');
    expect(result.urgency).toBe('high');
  });

  it('snapshot-urgent: headline / suggestedAction / actionRoute の具体値', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ todaySnapshot: { nextAction: 'x', nextActionPath: '/', urgency: 'high' } }),
    );
    expect(result.headline).toBe('今日の対応が必要な事項があります');
    expect(result.suggestedAction).toBe('今日の画面を確認する');
    expect(result.actionRoute).toBe('/today');
    expect(result.urgency).toBe('high');
  });

  it('missing-plan: headline / suggestedAction / actionRoute の具体値', () => {
    const result = buildUnifiedRecommendation(makeInput({ hasPlan: false }));
    expect(result.headline).toBe('個別支援計画書が未作成です');
    expect(result.suggestedAction).toBe('支援計画を作成する');
    expect(result.actionRoute).toBe('/planning');
    expect(result.urgency).toBe('medium');
  });

  it('no-issues: headline / suggestedAction / actionRoute の具体値', () => {
    const result = buildUnifiedRecommendation(makeInput());
    expect(result.headline).toBe('今日の対応に特記事項はありません');
    expect(result.suggestedAction).toBe('今日の記録を開く');
    expect(result.actionRoute).toBe('/dailysupport');
    expect(result.urgency).toBe('low');
  });
});

// ─── missing-record の userId エンコード ────────────────────

describe('buildUnifiedRecommendation — userId エンコード', () => {
  it('通常 userId はそのまま actionRoute に埋め込まれる', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, userId: 'U-001' }),
    );
    expect(result.actionRoute).toBe('/daily/activity?userId=U-001');
  });

  it('スペースを含む userId はエンコードされる', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, userId: 'U 001' }),
    );
    expect(result.actionRoute).toContain(encodeURIComponent('U 001'));
    expect(result.actionRoute).not.toContain(' ');
  });

  it('critical-handoff では userId を actionRoute に含めない', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ criticalHandoffCount: 1, userId: 'U-XYZ' }),
    );
    expect(result.actionRoute).toBe('/handoff/timeline');
    expect(result.actionRoute).not.toContain('U-XYZ');
  });
});

// ─── secondaryNotes の組み合わせ ─────────────────────────────

describe('buildUnifiedRecommendation — secondaryNotes 組み合わせ', () => {
  it('問題なしなら secondaryNotes は 0件', () => {
    const result = buildUnifiedRecommendation(makeInput());
    expect(result.secondaryNotes).toHaveLength(0);
  });

  it('primary に加えて1件の副次問題 → secondaryNotes は 1件', () => {
    // primary: critical-handoff, secondary: missing-record
    const result = buildUnifiedRecommendation(
      makeInput({ criticalHandoffCount: 1, hasRecordToday: false }),
    );
    expect(result.secondaryNotes).toHaveLength(1);
    expect(result.secondaryNotes[0]).toContain('記録');
  });

  it('secondary が3件以上あっても最大2件に切り捨てられる', () => {
    const result = buildUnifiedRecommendation(
      makeInput({
        criticalHandoffCount: 1,  // primary: critical-handoff
        hasRecordToday: false,    // secondary 1
        hasPlan: false,           // secondary 2
        isHighIntensity: true,    // secondary 3 → 切り捨て
      }),
    );
    expect(result.secondaryNotes).toHaveLength(2);
  });

  it('primary が missing-record のとき secondaryNotes に "記録" は含まれない', () => {
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, hasPlan: false }),
    );
    expect(result.primaryFactor).toBe('missing-record');
    expect(result.secondaryNotes.every((n) => !n.includes('記録が未入力'))).toBe(true);
  });

  it('isHighIntensity が true かつ primary でない場合 secondaryNotes に入る', () => {
    // primary: critical-handoff, secondary に high-intensity が入る
    const result = buildUnifiedRecommendation(
      makeInput({ criticalHandoffCount: 1, isHighIntensity: true }),
    );
    expect(result.secondaryNotes.some((n) => n.includes('強度行動障害'))).toBe(true);
  });

  it('criticalHandoffCount が secondary に件数付きで入る', () => {
    // primary: missing-record, secondary に criticalHandoff 件数
    const result = buildUnifiedRecommendation(
      makeInput({ hasRecordToday: false, criticalHandoffCount: 0 }),
    );
    // criticalHandoffCount = 0 なので secondary に申し送りは入らない
    expect(result.secondaryNotes.some((n) => n.includes('申し送り'))).toBe(false);
  });
});

// ─── buildUnifiedRecommendations 補完 ────────────────────────

describe('buildUnifiedRecommendations — 補完', () => {
  it('単一ユーザーの Map を返す', () => {
    const result = buildUnifiedRecommendations([makeInput({ userId: 'U-001' })]);
    expect(result.size).toBe(1);
    expect(result.has('U-001')).toBe(true);
  });

  it('各エントリのprimaryFactor が正しく設定される', () => {
    const inputs = [
      makeInput({ userId: 'U-A', criticalHandoffCount: 1 }),
      makeInput({ userId: 'U-B', hasRecordToday: false }),
      makeInput({ userId: 'U-C' }),
    ];
    const map = buildUnifiedRecommendations(inputs);
    expect(map.get('U-A')?.primaryFactor).toBe('critical-handoff');
    expect(map.get('U-B')?.primaryFactor).toBe('missing-record');
    expect(map.get('U-C')?.primaryFactor).toBe('no-issues');
  });
});
