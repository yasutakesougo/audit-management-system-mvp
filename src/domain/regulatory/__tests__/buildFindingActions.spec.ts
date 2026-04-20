/**
 * buildFindingActions テスト
 *
 * 監査 finding → アクション URL のマッピングを検証する。
 * evidence 系アクション（Iceberg PDCA 導線）のテストを含む。
 */
import { describe, expect, it } from 'vitest';
import { buildFindingActions, type FindingAction } from '@/domain/regulatory/buildFindingActions';
import type { AuditFinding } from '@/domain/regulatory';

function makeFinding(overrides: Partial<AuditFinding>): AuditFinding {
  return {
    id: 'f-001',
    type: 'planning_sheet_missing',
    severity: 'high',
    userId: 'U001',
    message: 'テスト',
    domain: 'sheet',
    detectedAt: '2026-03-13',
    ...overrides,
  };
}

describe('buildFindingActions', () => {
  it('planning_sheet_missing → 支援計画を作成', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'planning_sheet_missing',
    }));
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('支援計画を作成');
    expect(actions[0].url).toContain('/support-plan-guide');
    expect(actions[0].url).toContain('userId=U001');
    expect(actions[0].kind).toBe('plan');
  });

  it('author_qualification_missing → 修正画面を開く', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'author_qualification_missing',
      planningSheetId: 'sheet-1',
    }));
    expect(actions).toHaveLength(1);
    expect(actions[0].label).toBe('修正画面を開く');
    expect(actions[0].kind).toBe('review');
  });

  it('author_qualification_missing without planningSheetId → no actions', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'author_qualification_missing',
    }));
    expect(actions).toHaveLength(0);
  });

  it('review_overdue → 見直しを開始 + 分析を確認', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'review_overdue',
      planningSheetId: 'sheet-1',
    }));
    expect(actions).toHaveLength(2);
    expect(actions[0].label).toBe('見直しを開始');
    expect(actions[0].kind).toBe('review');

    const evidenceAction = actions.find((a: FindingAction) => a.kind === 'evidence')!;
    expect(evidenceAction).toBeDefined();
    expect(evidenceAction.label).toBe('分析を確認');
    expect(evidenceAction.url).toContain('/analysis/iceberg-pdca');
    expect(evidenceAction.url).toContain('userId=U001');
    expect(evidenceAction.url).toContain('source=regulatory-dashboard');
  });

  it('procedure_record_gap → 3つのアクション (時間割 + 支援計画 + 分析)', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'procedure_record_gap',
      planningSheetId: 'sheet-1',
    }));
    expect(actions).toHaveLength(3);

    const executeAction = actions.find((a: FindingAction) => a.kind === 'execute')!;
    expect(executeAction.label).toBe('時間割を開く');
    expect(executeAction.url).toContain('/daily/support');
    expect(executeAction.url).toContain('userId=U001');
    expect(executeAction.url).toContain('planningSheetId=sheet-1');

    const planAction = actions.find((a: FindingAction) => a.kind === 'plan')!;
    expect(planAction.label).toBe('支援計画を確認');

    const evidenceAction = actions.find((a: FindingAction) => a.kind === 'evidence')!;
    expect(evidenceAction).toBeDefined();
    expect(evidenceAction.label).toBe('分析を確認');
    expect(evidenceAction.url).toContain('/analysis/iceberg-pdca');
  });

  it('delivery_missing → 支援計画を確認 (evidence なし)', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'delivery_missing',
    }));
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe('review');
    expect(actions.find((a: FindingAction) => a.kind === 'evidence')).toBeUndefined();
  });

  it('add_on_candidate → 支援計画を確認 + 分析を確認', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'add_on_candidate',
    }));
    expect(actions).toHaveLength(2);
    expect(actions[0].kind).toBe('review');

    const evidenceAction = actions.find((a: FindingAction) => a.kind === 'evidence')!;
    expect(evidenceAction).toBeDefined();
    expect(evidenceAction.label).toBe('分析を確認');
    expect(evidenceAction.url).toContain('/analysis/iceberg-pdca');
  });

  it('encodes special characters in userId', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'planning_sheet_missing',
      userId: 'user 001',
    }));
    expect(actions[0].url).toContain('userId=user%20001');
  });

  // ── evidence 導線の詳細テスト ──

  it('evidence actions include source=regulatory-dashboard', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'procedure_record_gap',
      planningSheetId: 'sheet-1',
    }));
    const evidenceAction = actions.find((a: FindingAction) => a.kind === 'evidence')!;
    expect(evidenceAction.url).toContain('source=regulatory-dashboard');
  });

  it('evidence action URL encodes special userId', () => {
    const actions = buildFindingActions(makeFinding({
      type: 'review_overdue',
      userId: 'user&id=1',
    }));
    const evidenceAction = actions.find((a: FindingAction) => a.kind === 'evidence')!;
    expect(evidenceAction.url).toContain('/analysis/iceberg-pdca');
    // URLSearchParams encodes & properly
    expect(evidenceAction.url).not.toContain('&id=1');
  });
});
