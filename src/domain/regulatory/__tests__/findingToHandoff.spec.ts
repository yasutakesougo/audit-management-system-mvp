/**
 * findingToHandoff — テスト
 */
import { describe, expect, it } from 'vitest';

import type { AuditFinding } from '../auditChecks';
import type { SevereAddonFinding } from '../severeAddonFindings';
import {
  buildHandoffFromAddonFinding,
  buildHandoffFromRegularFinding,
} from '../findingToHandoff';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeRegularFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: 'finding-1',
    type: 'review_overdue',
    severity: 'high',
    userId: 'U001',
    userName: '鈴木花子',
    message: '見直し期限超過',
    domain: 'sheet', // Add this
    overdueDays: -14,
    detectedAt: '2026-03-14',
    ...overrides,
  };
}

function makeAddonFinding(overrides: Partial<SevereAddonFinding> = {}): SevereAddonFinding {
  return {
    id: 'addon-1',
    type: 'weekly_observation_shortage',
    severity: 'medium',
    userId: 'U002',
    userName: '田中太郎',
    message: '週次観察不足',
    domain: 'sheet', // Add this
    detectedAt: '2026-03-14',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildHandoffFromRegularFinding
// ---------------------------------------------------------------------------

describe('buildHandoffFromRegularFinding', () => {
  it('title に制度チェックと種別ラベルが入る', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding());
    expect(result.title).toContain('【制度チェック】');
    expect(result.title).toContain('見直し期限超過');
    expect(result.title).toContain('鈴木花子');
  });

  it('sourceType が regulatory-finding', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding());
    expect(result.sourceType).toBe('regulatory-finding');
  });

  it('sourceKey に finding ID が含まれる', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ id: 'f-42' }));
    expect(result.sourceKey).toBe('regulatory-finding:f-42');
  });

  it('high severity → 重要', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ severity: 'high' }));
    expect(result.severity).toBe('重要');
  });

  it('medium severity → 要注意', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ severity: 'medium' }));
    expect(result.severity).toBe('要注意');
  });

  it('low severity → 通常', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ severity: 'low' }));
    expect(result.severity).toBe('通常');
  });

  it('review_overdue → body に超過日数が含まれる', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ overdueDays: -14 }));
    expect(result.body).toContain('14日');
    expect(result.body).toContain('超過');
  });

  it('review_approaching → body に残日数が含まれる', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({
      type: 'review_approaching',
      overdueDays: 7,
    }));
    expect(result.body).toContain('あと7日');
  });

  it('planning_sheet_missing → body にシート未作成が含まれる', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'planning_sheet_missing' }));
    expect(result.body).toContain('未作成');
  });

  it('delivery_missing → body に未交付が含まれる', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'delivery_missing' }));
    expect(result.body).toContain('未交付');
  });

  it('procedure_record_gap → category が事故・ヒヤリ', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'procedure_record_gap' }));
    expect(result.category).toBe('事故・ヒヤリ');
  });

  it('planning_sheet_missing → category が支援の工夫', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'planning_sheet_missing' }));
    expect(result.category).toBe('支援の工夫');
  });

  it('review_approaching → category が支援の工夫', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'review_approaching' }));
    expect(result.category).toBe('支援の工夫');
  });

  it('add_on_candidate → category がその他', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ type: 'add_on_candidate' }));
    expect(result.category).toBe('その他');
  });

  it('userName が undefined の場合 userId を使用する', () => {
    const result = buildHandoffFromRegularFinding(makeRegularFinding({ userName: undefined }));
    expect(result.title).toContain('U001');
    expect(result.body).toContain('U001');
  });
});

// ---------------------------------------------------------------------------
// buildHandoffFromAddonFinding
// ---------------------------------------------------------------------------

describe('buildHandoffFromAddonFinding', () => {
  it('title に加算チェックと種別ラベルが入る', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding());
    expect(result.title).toContain('【加算チェック】');
    expect(result.title).toContain('週次観察不足');
    expect(result.title).toContain('田中太郎');
  });

  it('sourceType が severe-addon-finding', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding());
    expect(result.sourceType).toBe('severe-addon-finding');
  });

  it('sourceKey に finding ID が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({ id: 'addon-99' }));
    expect(result.sourceKey).toBe('severe-addon-finding:addon-99');
  });

  it('weekly_observation_shortage → body に観察・助言記録と確認が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding());
    expect(result.body).toContain('観察');
  });

  it('planning_sheet_reassessment_overdue → body に再評価が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'planning_sheet_reassessment_overdue',
    }));
    expect(result.body).toContain('再評価');
  });

  it('authoring_requirement_unmet → body に実践研修が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'authoring_requirement_unmet',
    }));
    expect(result.body).toContain('実践研修');
  });

  it('assignment_without_required_qualification → body に基礎研修未修了が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'assignment_without_required_qualification',
    }));
    expect(result.body).toContain('基礎研修未修了');
  });

  it('basic_training_ratio_insufficient → body に20%が含まれる', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'basic_training_ratio_insufficient',
      userId: '__facility__',
    }));
    expect(result.body).toContain('20%');
  });

  it('__facility__ userId → title に事業所全体と表示', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'basic_training_ratio_insufficient',
      userId: '__facility__',
      userName: undefined,
    }));
    expect(result.title).toContain('事業所全体');
  });

  it('weekly_observation_shortage → category が事故・ヒヤリ', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding());
    expect(result.category).toBe('事故・ヒヤリ');
  });

  it('severe_addon_tier2_candidate → category がその他', () => {
    const result = buildHandoffFromAddonFinding(makeAddonFinding({
      type: 'severe_addon_tier2_candidate',
    }));
    expect(result.category).toBe('その他');
  });
});
