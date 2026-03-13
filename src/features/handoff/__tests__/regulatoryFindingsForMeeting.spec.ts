/**
 * RegulatoryFindingsForMeeting 純粋関数のユニットテスト
 *
 * P6 Phase 2: extractPendingRegulatoryHandoffs + classifyRegulatoryHandoff
 */
import { describe, expect, it } from 'vitest';
import type { HandoffRecord } from '../handoffTypes';
import {
  extractPendingRegulatoryHandoffs,
  classifyRegulatoryHandoff,
} from '../RegulatoryFindingsForMeeting';

// ── ヘルパー ──

function createRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 1,
    title: 'テスト',
    message: 'テスト内容',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: 'その他',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdAt: new Date().toISOString(),
    createdByName: 'テスト太郎',
    isDraft: false,
    ...overrides,
  };
}

// ── extractPendingRegulatoryHandoffs ──

describe('extractPendingRegulatoryHandoffs', () => {
  it('regulatory-finding と severe-addon-finding の未完了のみ抽出する', () => {
    const records = [
      createRecord({ id: 1, sourceType: 'regulatory-finding', status: '未対応' }),
      createRecord({ id: 2, sourceType: 'severe-addon-finding', status: '対応中' }),
      createRecord({ id: 3, sourceType: 'regulatory-finding', status: '完了' }), // terminal
      createRecord({ id: 4, sourceType: 'meeting-minutes', status: '未対応' }), // 別ソース
      createRecord({ id: 5, status: '未対応' }), // sourceType なし
    ];

    const result = extractPendingRegulatoryHandoffs(records);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });

  it('空配列に対して空配列を返す', () => {
    expect(extractPendingRegulatoryHandoffs([])).toEqual([]);
  });

  it('terminal status（完了・対応済）はすべて除外する', () => {
    const records = [
      createRecord({ id: 1, sourceType: 'regulatory-finding', status: '完了' }),
      createRecord({ id: 2, sourceType: 'regulatory-finding', status: '対応済' }),
    ];

    const result = extractPendingRegulatoryHandoffs(records);

    expect(result).toHaveLength(0);
  });

  it('明日へ持越は非 terminal → 抽出される', () => {
    const records = [
      createRecord({ id: 1, sourceType: 'regulatory-finding', status: '明日へ持越' }),
    ];

    const result = extractPendingRegulatoryHandoffs(records);

    expect(result).toHaveLength(1);
  });
});

// ── classifyRegulatoryHandoff ──

describe('classifyRegulatoryHandoff', () => {
  it('sourceKey に reassessment_overdue → "reassessment"', () => {
    const r = createRecord({ sourceKey: 'regulatory-finding:planning_sheet_reassessment_overdue' });
    expect(classifyRegulatoryHandoff(r)).toBe('reassessment');
  });

  it('sourceKey に weekly_observation → "observation"', () => {
    const r = createRecord({ sourceKey: 'severe-addon-finding:weekly_observation_shortage' });
    expect(classifyRegulatoryHandoff(r)).toBe('observation');
  });

  it('sourceKey に qualification → "qualification"', () => {
    const r = createRecord({ sourceKey: 'severe-addon-finding:assignment_without_required_qualification' });
    expect(classifyRegulatoryHandoff(r)).toBe('qualification');
  });

  it('sourceKey に authoring_requirement → "qualification"', () => {
    const r = createRecord({ sourceKey: 'severe-addon-finding:authoring_requirement_unmet' });
    expect(classifyRegulatoryHandoff(r)).toBe('qualification');
  });

  it('sourceKey に severe_addon → "addon"', () => {
    const r = createRecord({ sourceKey: 'severe-addon-finding:severe_addon_tier2_candidate' });
    expect(classifyRegulatoryHandoff(r)).toBe('addon');
  });

  it('sourceKey に basic_training → "addon"', () => {
    const r = createRecord({ sourceKey: 'severe-addon-finding:basic_training_ratio_insufficient' });
    expect(classifyRegulatoryHandoff(r)).toBe('addon');
  });

  it('sourceType が regulatory-finding で分類できない場合 → "audit"', () => {
    const r = createRecord({ sourceType: 'regulatory-finding', sourceKey: 'regulatory-finding:missing_daily_record' });
    expect(classifyRegulatoryHandoff(r)).toBe('audit');
  });

  it('sourceType も sourceKey もない場合 → "other"', () => {
    const r = createRecord({});
    expect(classifyRegulatoryHandoff(r)).toBe('other');
  });
});
