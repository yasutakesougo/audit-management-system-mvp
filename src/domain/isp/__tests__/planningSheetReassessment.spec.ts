import { describe, it, expect } from 'vitest';
import {
  computeDaysSinceReassessment,
  isQuarterlyReassessmentOverdue,
  isReassessmentDueDateOverdue,
  daysUntilReassessment,
  computeNextReassessmentDueDate,
  DEFAULT_REASSESSMENT_CYCLE_DAYS,
  type PlanningSheetReassessment,
  type ReassessmentTrigger,
  type PlanChangeDecision,
  REASSESSMENT_TRIGGER_LABELS,
  PLAN_CHANGE_DECISION_LABELS,
} from '../planningSheetReassessment';

// ─────────────────────────────────────────────
// 型の完全性テスト
// ─────────────────────────────────────────────

describe('PlanningSheetReassessment 型', () => {
  it('全フィールドを持ったオブジェクトが型に適合する', () => {
    const record: PlanningSheetReassessment = {
      id: 'ra-001',
      planningSheetId: 'ps-001',
      reassessedAt: '2026-01-15',
      reassessedBy: 'staff-001',
      triggerType: 'scheduled',
      abcSummary: '先行事象として環境の変化が多く、パニック行動が日に2-3回',
      hypothesisReview: '感覚過敏仮説は支持。音への過敏が主因と確認',
      procedureEffectiveness: 'イヤーマフ提供で行動頻度20%低減。一定の効果あり',
      environmentChange: '通所先の部屋変更あり。照明が明るくなった',
      planChangeDecision: 'minor_revision',
      nextReassessmentAt: '2026-04-15',
      notes: 'イヤーマフの種類を変更して経過観察',
    };

    expect(record.id).toBe('ra-001');
    expect(record.planningSheetId).toBe('ps-001');
    expect(record.triggerType).toBe('scheduled');
    expect(record.planChangeDecision).toBe('minor_revision');
  });

  it('triggerType のすべてのバリアントがラベルを持つ', () => {
    const triggers: ReassessmentTrigger[] = ['scheduled', 'incident', 'monitoring', 'other'];
    for (const t of triggers) {
      expect(REASSESSMENT_TRIGGER_LABELS[t]).toBeDefined();
      expect(typeof REASSESSMENT_TRIGGER_LABELS[t]).toBe('string');
    }
  });

  it('planChangeDecision のすべてのバリアントがラベルを持つ', () => {
    const decisions: PlanChangeDecision[] = [
      'no_change', 'minor_revision', 'major_revision', 'urgent_revision',
    ];
    for (const d of decisions) {
      expect(PLAN_CHANGE_DECISION_LABELS[d]).toBeDefined();
      expect(typeof PLAN_CHANGE_DECISION_LABELS[d]).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────
// computeDaysSinceReassessment
// ─────────────────────────────────────────────

describe('computeDaysSinceReassessment', () => {
  it('null → null', () => {
    expect(computeDaysSinceReassessment(null)).toBeNull();
  });

  it('undefined → null', () => {
    expect(computeDaysSinceReassessment(undefined)).toBeNull();
  });

  it('同日 → 0', () => {
    expect(computeDaysSinceReassessment('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('30日前 → 30', () => {
    expect(computeDaysSinceReassessment('2026-02-01', '2026-03-03')).toBe(30);
  });

  it('90日前 → 90', () => {
    expect(computeDaysSinceReassessment('2026-01-01', '2026-04-01')).toBe(90);
  });

  it('91日前 → 91', () => {
    expect(computeDaysSinceReassessment('2026-01-01', '2026-04-02')).toBe(91);
  });

  it('未来日 → 負の値', () => {
    const result = computeDaysSinceReassessment('2026-04-01', '2026-03-01');
    expect(result).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────────
// isQuarterlyReassessmentOverdue
// ─────────────────────────────────────────────

describe('isQuarterlyReassessmentOverdue', () => {
  it('再評価未実施 → overdue = true, daysSince = null', () => {
    const result = isQuarterlyReassessmentOverdue(null);
    expect(result.overdue).toBe(true);
    expect(result.daysSince).toBeNull();
    expect(result.cycleDays).toBe(DEFAULT_REASSESSMENT_CYCLE_DAYS);
  });

  it('90日ちょうど → overdue = false', () => {
    const result = isQuarterlyReassessmentOverdue('2026-01-01', 90, '2026-04-01');
    expect(result.overdue).toBe(false);
    expect(result.daysSince).toBe(90);
  });

  it('91日 → overdue = true', () => {
    const result = isQuarterlyReassessmentOverdue('2026-01-01', 90, '2026-04-02');
    expect(result.overdue).toBe(true);
    expect(result.daysSince).toBe(91);
  });

  it('89日 → overdue = false', () => {
    const result = isQuarterlyReassessmentOverdue('2026-01-01', 90, '2026-03-31');
    expect(result.overdue).toBe(false);
    expect(result.daysSince).toBe(89);
  });

  it('カスタム周期 60日で61日経過 → overdue = true', () => {
    const result = isQuarterlyReassessmentOverdue('2026-01-01', 60, '2026-03-03');
    expect(result.overdue).toBe(true);
    expect(result.cycleDays).toBe(60);
  });

  it('当日 → overdue = false', () => {
    const result = isQuarterlyReassessmentOverdue('2026-03-01', 90, '2026-03-01');
    expect(result.overdue).toBe(false);
    expect(result.daysSince).toBe(0);
  });

  it('デフォルト周期は90日', () => {
    expect(DEFAULT_REASSESSMENT_CYCLE_DAYS).toBe(90);
  });
});

// ─────────────────────────────────────────────
// isReassessmentDueDateOverdue
// ─────────────────────────────────────────────

describe('isReassessmentDueDateOverdue', () => {
  it('期限未設定 → false', () => {
    expect(isReassessmentDueDateOverdue(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isReassessmentDueDateOverdue(undefined)).toBe(false);
  });

  it('期限当日 → false（= 未超過）', () => {
    expect(isReassessmentDueDateOverdue('2026-03-01', '2026-03-01')).toBe(false);
  });

  it('期限翌日 → true', () => {
    expect(isReassessmentDueDateOverdue('2026-03-01', '2026-03-02')).toBe(true);
  });

  it('期限前日 → false', () => {
    expect(isReassessmentDueDateOverdue('2026-03-01', '2026-02-28')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// daysUntilReassessment
// ─────────────────────────────────────────────

describe('daysUntilReassessment', () => {
  it('期限未設定 → null', () => {
    expect(daysUntilReassessment(null)).toBeNull();
  });

  it('10日後 → 10', () => {
    expect(daysUntilReassessment('2026-03-11', '2026-03-01')).toBe(10);
  });

  it('当日 → 0', () => {
    expect(daysUntilReassessment('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('3日超過 → -3', () => {
    expect(daysUntilReassessment('2026-03-01', '2026-03-04')).toBe(-3);
  });
});

// ─────────────────────────────────────────────
// computeNextReassessmentDueDate
// ─────────────────────────────────────────────

describe('computeNextReassessmentDueDate', () => {
  it('2026-01-01 + 90日 → 2026-04-01', () => {
    expect(computeNextReassessmentDueDate('2026-01-01', 90)).toBe('2026-04-01');
  });

  it('2026-01-01 + デフォルト90日 → 2026-04-01', () => {
    expect(computeNextReassessmentDueDate('2026-01-01')).toBe('2026-04-01');
  });

  it('2026-03-15 + 90日 → 2026-06-13', () => {
    expect(computeNextReassessmentDueDate('2026-03-15', 90)).toBe('2026-06-13');
  });

  it('月末跨ぎ: 2026-11-15 + 90日 → 2027-02-13', () => {
    expect(computeNextReassessmentDueDate('2026-11-15', 90)).toBe('2027-02-13');
  });

  it('カスタム周期: 2026-01-01 + 60日 → 2026-03-02', () => {
    expect(computeNextReassessmentDueDate('2026-01-01', 60)).toBe('2026-03-02');
  });
});

// ─────────────────────────────────────────────
// ISP MonitoringRecord との分離確認
// ─────────────────────────────────────────────

describe('ISP MonitoringRecord との分離', () => {
  it('PlanningSheetReassessment は goalAchievements を持たない（ISP専用）', () => {
    const record: PlanningSheetReassessment = {
      id: 'ra-002',
      planningSheetId: 'ps-002',
      reassessedAt: '2026-01-15',
      reassessedBy: 'staff-002',
      triggerType: 'incident',
      abcSummary: '',
      hypothesisReview: '',
      procedureEffectiveness: '',
      environmentChange: '',
      planChangeDecision: 'no_change',
      nextReassessmentAt: '2026-04-15',
      notes: '',
    };

    // goalAchievements は ISP MonitoringRecord のフィールド
    expect('goalAchievements' in record).toBe(false);
    // overallAssessment も ISP MonitoringRecord のフィールド
    expect('overallAssessment' in record).toBe(false);
    // planChangeRequired も ISP MonitoringRecord のフィールド
    expect('planChangeRequired' in record).toBe(false);

    // 逆に、支援計画シート再評価固有のフィールドが存在する
    expect('abcSummary' in record).toBe(true);
    expect('hypothesisReview' in record).toBe(true);
    expect('procedureEffectiveness' in record).toBe(true);
    expect('triggerType' in record).toBe(true);
    expect('planChangeDecision' in record).toBe(true);
  });
});
