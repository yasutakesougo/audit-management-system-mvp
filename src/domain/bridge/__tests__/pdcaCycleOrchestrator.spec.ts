/**
 * pdcaCycleOrchestrator — ユニットテスト
 *
 * テスト構成:
 * 1. resolveCurrentPhase — WorkflowPhase → PdcaCyclePhase マッピング
 * 2. buildPhaseCompletionMap — 完了日マップの構築
 * 3. computeCycleHealth — 健全度スコア計算
 * 4. determinePdcaCycleState — 統合テスト（メインエントリ）
 * 5. サイクル循環（Act → 次 Plan）
 */
import { describe, it, expect } from 'vitest';
import {
  resolveCurrentPhase,
  buildPhaseCompletionMap,
  computeCycleHealth,
  determinePdcaCycleState,
  type DetermineCycleInput,
} from '../pdcaCycleOrchestrator';
import type { WorkflowPhase } from '../workflowPhase';
import type { PdcaPhaseCompletionMap } from '@/domain/isp/types';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

function makeInput(overrides: Partial<DetermineCycleInput> = {}): DetermineCycleInput {
  return {
    userId: 'u-1',
    planningSheetId: 'ps-1',
    workflowPhase: 'active_plan',
    planCreatedAt: '2026-01-10',
    planAppliedAt: '2026-01-15',
    lastMonitoringAt: null,
    lastReassessmentAt: null,
    reassessmentCount: 0,
    procedureCompletionRate: 0.8,
    monitoringDaysRemaining: 60,
    referenceDate: '2026-03-01',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. resolveCurrentPhase
// ─────────────────────────────────────────────

describe('resolveCurrentPhase', () => {
  it.each<[WorkflowPhase, string]>([
    ['needs_assessment', 'plan'],
    ['needs_plan', 'plan'],
    ['active_plan', 'do'],
    ['needs_monitoring', 'check'],
    ['monitoring_overdue', 'check'],
    ['needs_reassessment', 'act'],
  ])('%s → %s', (workflowPhase, expected) => {
    expect(resolveCurrentPhase(workflowPhase)).toBe(expected);
  });
});

// ─────────────────────────────────────────────
// 2. buildPhaseCompletionMap
// ─────────────────────────────────────────────

describe('buildPhaseCompletionMap', () => {
  it('全フィールドが null の場合、all null を返す', () => {
    const map = buildPhaseCompletionMap({
      planCreatedAt: null,
      planAppliedAt: null,
      lastMonitoringAt: null,
      lastReassessmentAt: null,
    });

    expect(map).toEqual({
      plan: null,
      do: null,
      check: null,
      act: null,
    });
  });

  it('部分的に完了している場合、正しくマッピングする', () => {
    const map = buildPhaseCompletionMap({
      planCreatedAt: '2026-01-10',
      planAppliedAt: '2026-01-15',
      lastMonitoringAt: null,
      lastReassessmentAt: null,
    });

    expect(map.plan).toBe('2026-01-10');
    expect(map.do).toBe('2026-01-15');
    expect(map.check).toBeNull();
    expect(map.act).toBeNull();
  });

  it('全フィールドが完了している場合、すべて日付が入る', () => {
    const map = buildPhaseCompletionMap({
      planCreatedAt: '2026-01-10',
      planAppliedAt: '2026-01-15',
      lastMonitoringAt: '2026-03-20',
      lastReassessmentAt: '2026-03-25',
    });

    expect(Object.values(map).every((v) => v !== null)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 3. computeCycleHealth
// ─────────────────────────────────────────────

describe('computeCycleHealth', () => {
  const fullCompletion: PdcaPhaseCompletionMap = {
    plan: '2026-01-10',
    do: '2026-01-15',
    check: '2026-03-20',
    act: '2026-03-25',
  };

  const noCompletion: PdcaPhaseCompletionMap = {
    plan: null,
    do: null,
    check: null,
    act: null,
  };

  it('全フェーズ完了・高実施率・余裕あり → スコア ≈ 1.0', () => {
    const { score, breakdown } = computeCycleHealth(
      { procedureCompletionRate: 1.0, monitoringDaysRemaining: 60 },
      fullCompletion,
    );

    expect(score).toBeGreaterThanOrEqual(0.9);
    expect(score).toBeLessThanOrEqual(1.0);
    expect(breakdown.length).toBeGreaterThanOrEqual(3);
  });

  it('全フェーズ未完了・低実施率・超過 → スコア ≈ 0', () => {
    const { score } = computeCycleHealth(
      { procedureCompletionRate: 0, monitoringDaysRemaining: -30 },
      noCompletion,
    );

    expect(score).toBeLessThanOrEqual(0.1);
  });

  it('モニタリング14日以内 → スコアがやや減少', () => {
    const { score: safeScore } = computeCycleHealth(
      { procedureCompletionRate: 1.0, monitoringDaysRemaining: 60 },
      fullCompletion,
    );
    const { score: urgentScore } = computeCycleHealth(
      { procedureCompletionRate: 1.0, monitoringDaysRemaining: 7 },
      fullCompletion,
    );

    expect(urgentScore).toBeLessThan(safeScore);
  });

  it('procedureCompletionRate が null → スコア 1 として扱う', () => {
    const { score, breakdown } = computeCycleHealth(
      { procedureCompletionRate: null, monitoringDaysRemaining: 60 },
      fullCompletion,
    );

    expect(score).toBeGreaterThanOrEqual(0.8);
    expect(breakdown.some((b) => b.includes('100%'))).toBe(true);
  });

  it('monitoringDaysRemaining が null → データなしとして扱う', () => {
    const { breakdown } = computeCycleHealth(
      { procedureCompletionRate: 0.8, monitoringDaysRemaining: null },
      fullCompletion,
    );

    expect(breakdown.some((b) => b.includes('データなし'))).toBe(true);
  });

  it('スコアは常に 0.0 – 1.0 の範囲', () => {
    // 極端値テスト
    const { score: low } = computeCycleHealth(
      { procedureCompletionRate: 0, monitoringDaysRemaining: -100 },
      noCompletion,
    );
    const { score: high } = computeCycleHealth(
      { procedureCompletionRate: 1, monitoringDaysRemaining: 1000 },
      fullCompletion,
    );

    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
// 4. determinePdcaCycleState — 統合テスト
// ─────────────────────────────────────────────

describe('determinePdcaCycleState', () => {
  it('初回サイクル・計画実施中 → cycleNumber=1, phase=do', () => {
    const state = determinePdcaCycleState(makeInput());

    expect(state.userId).toBe('u-1');
    expect(state.planningSheetId).toBe('ps-1');
    expect(state.currentPhase).toBe('do');
    expect(state.cycleNumber).toBe(1);
    expect(state.phaseCompletions.plan).toBe('2026-01-10');
    expect(state.phaseCompletions.do).toBe('2026-01-15');
    expect(state.phaseCompletions.check).toBeNull();
    expect(state.phaseCompletions.act).toBeNull();
    expect(state.healthScore).toBeGreaterThan(0);
    expect(state.healthScore).toBeLessThanOrEqual(1);
    expect(state.computedAt).toBe('2026-03-01');
  });

  it('アセスメント未実施 → phase=plan, cycleNumber=1', () => {
    const state = determinePdcaCycleState(
      makeInput({
        workflowPhase: 'needs_assessment',
        planCreatedAt: null,
        planAppliedAt: null,
      }),
    );

    expect(state.currentPhase).toBe('plan');
    expect(state.cycleNumber).toBe(1);
  });

  it('モニタリング超過 → phase=check', () => {
    const state = determinePdcaCycleState(
      makeInput({
        workflowPhase: 'monitoring_overdue',
        monitoringDaysRemaining: -5,
        lastMonitoringAt: '2026-02-01',
      }),
    );

    expect(state.currentPhase).toBe('check');
  });

  it('再評価待ち → phase=act', () => {
    const state = determinePdcaCycleState(
      makeInput({
        workflowPhase: 'needs_reassessment',
        lastMonitoringAt: '2026-03-01',
      }),
    );

    expect(state.currentPhase).toBe('act');
  });

  it('referenceDate 省略時 → computedAt に今日の日付', () => {
    const state = determinePdcaCycleState(
      makeInput({ referenceDate: undefined }),
    );

    // 今日の日付（YYYY-MM-DD 形式）
    const today = new Date().toISOString().slice(0, 10);
    expect(state.computedAt).toBe(today);
  });
});

// ─────────────────────────────────────────────
// 5. サイクル循環（Act → 次 Plan）
// ─────────────────────────────────────────────

describe('PDCA サイクル循環', () => {
  it('再評価1回完了 → cycleNumber=2', () => {
    const state = determinePdcaCycleState(
      makeInput({
        reassessmentCount: 1,
        lastReassessmentAt: '2026-03-25',
      }),
    );

    expect(state.cycleNumber).toBe(2);
    expect(state.phaseCompletions.act).toBe('2026-03-25');
  });

  it('再評価3回完了 → cycleNumber=4', () => {
    const state = determinePdcaCycleState(
      makeInput({
        reassessmentCount: 3,
        lastReassessmentAt: '2026-09-01',
      }),
    );

    expect(state.cycleNumber).toBe(4);
  });

  it('Act完了後に needs_plan フェーズ → 次サイクルの Plan', () => {
    const state = determinePdcaCycleState(
      makeInput({
        workflowPhase: 'needs_plan',
        reassessmentCount: 1,
        lastReassessmentAt: '2026-03-25',
      }),
    );

    // 再評価完了 → 次サイクルの計画策定フェーズ
    expect(state.currentPhase).toBe('plan');
    expect(state.cycleNumber).toBe(2);
  });
});
