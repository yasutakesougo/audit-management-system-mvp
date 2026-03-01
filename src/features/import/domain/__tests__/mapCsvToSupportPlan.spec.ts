import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { describe, expect, it } from 'vitest';
import { inferStageFromTime, mapScheduleToSupportPlan } from '../mapCsvToSupportPlan';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    time: '09:00',
    activity: '朝の活動',
    instruction: '見守る',
    isKey: false,
    linkedInterventionIds: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// inferStageFromTime
// ---------------------------------------------------------------------------

describe('inferStageFromTime', () => {
  it('09:00 → proactive', () => {
    expect(inferStageFromTime('09:00')).toBe('proactive');
  });

  it('10:30 → proactive', () => {
    expect(inferStageFromTime('10:30')).toBe('proactive');
  });

  it('11:00 → earlyResponse', () => {
    expect(inferStageFromTime('11:00')).toBe('earlyResponse');
  });

  it('12:00 → earlyResponse', () => {
    expect(inferStageFromTime('12:00')).toBe('earlyResponse');
  });

  it('13:00 → proactive (午後)', () => {
    expect(inferStageFromTime('13:00')).toBe('proactive');
  });

  it('14:30 → proactive (午後)', () => {
    expect(inferStageFromTime('14:30')).toBe('proactive');
  });

  it('15:00 → postCrisis', () => {
    expect(inferStageFromTime('15:00')).toBe('postCrisis');
  });

  it('16:00 → postCrisis', () => {
    expect(inferStageFromTime('16:00')).toBe('postCrisis');
  });

  it('パースできない文字列 → proactive (デフォルト)', () => {
    expect(inferStageFromTime('午前中')).toBe('proactive');
  });
});

// ---------------------------------------------------------------------------
// mapScheduleToSupportPlan
// ---------------------------------------------------------------------------

describe('mapScheduleToSupportPlan', () => {
  it('基本変換: ScheduleItem → SupportPlanDeployment', () => {
    const items = [
      makeItem({ time: '09:00', activity: '朝の受け入れ - 着替える', instruction: '促す' }),
    ];

    const result = mapScheduleToSupportPlan('I001', items);

    expect(result.planId).toBe('import-I001');
    expect(result.planName).toBe('I001 支援計画');
    expect(result.version).toBe('1.0');
    expect(result.author).toBe('CSVインポート');
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0]).toEqual(expect.objectContaining({
      time: '09:00',
      title: '朝の受け入れ',
      personTodo: '着替える',
      supporterTodo: '促す',
      stage: 'proactive',
    }));
  });

  it('空配列の場合は活動0件の計画を返す', () => {
    const result = mapScheduleToSupportPlan('I001', []);

    expect(result.activities).toHaveLength(0);
    expect(result.summary).toContain('0件');
  });

  it('カスタムメタデータが反映される', () => {
    const result = mapScheduleToSupportPlan('I001', [makeItem()], {
      planName: '田中さん日課表',
      author: '管理者',
      version: '2.0',
    });

    expect(result.planName).toBe('田中さん日課表');
    expect(result.author).toBe('管理者');
    expect(result.version).toBe('2.0');
  });

  it('activity にハイフン区切りがない場合、title と personTodo が同じ', () => {
    const items = [makeItem({ activity: '自由時間' })];
    const result = mapScheduleToSupportPlan('I001', items);

    expect(result.activities[0].title).toBe('自由時間');
    expect(result.activities[0].personTodo).toBe('自由時間');
  });

  it('instruction が空の場合、デフォルトの supporterTodo', () => {
    const items = [makeItem({ instruction: '' })];
    const result = mapScheduleToSupportPlan('I001', items);

    expect(result.activities[0].supporterTodo).toBe('支援内容を設定してください');
  });

  it('複数アイテムの stage が時間帯に基づいて推定される', () => {
    const items = [
      makeItem({ time: '09:00', activity: '朝の会' }),
      makeItem({ time: '11:30', activity: '昼食準備' }),
      makeItem({ time: '13:30', activity: '午後活動' }),
      makeItem({ time: '15:30', activity: '振り返り' }),
    ];

    const result = mapScheduleToSupportPlan('I001', items);
    const stages = result.activities.map((a) => a.stage);

    expect(stages).toEqual(['proactive', 'earlyResponse', 'proactive', 'postCrisis']);
  });

  it('summary に活動件数が含まれる', () => {
    const items = [makeItem(), makeItem({ id: 'item-2' }), makeItem({ id: 'item-3' })];
    const result = mapScheduleToSupportPlan('I001', items);

    expect(result.summary).toContain('3件');
  });

  it('deployedAt が ISO 日時文字列', () => {
    const result = mapScheduleToSupportPlan('I001', [makeItem()]);

    expect(() => new Date(result.deployedAt)).not.toThrow();
    expect(result.deployedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
