/**
 * workflowPhase — ユニットテスト
 *
 * テスト構成:
 * 1. 基本フェーズ判定（6パターン）
 * 2. 判定順の優先度テスト
 * 3. フォールバック・エッジケース
 * 4. ソート・フィルター
 * 5. UI mapper (toPlanningWorkflowCardItem)
 */
import { describe, it, expect } from 'vitest';
import {
  determineWorkflowPhase,
  sortByWorkflowPriority,
  filterActionRequired,
  toPlanningWorkflowCardItem,
  findActiveSheet,
  PHASE_PRIORITIES,
  type DeterminePhaseInput,
  type PlanningSheetSnapshot,
  type ReassessmentSnapshot,
  type WorkflowPhaseResult,
} from '../workflowPhase';

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

/** 計画シートの最小スナップショット factory */
function makeSheet(overrides: Partial<PlanningSheetSnapshot> = {}): PlanningSheetSnapshot {
  return {
    id: 'ps-1',
    status: 'active',
    appliedFrom: '2026-01-01',
    reviewedAt: null,
    reviewCycleDays: 90,
    procedureCount: 5,
    isCurrent: true,
    ...overrides,
  };
}

/** 再評価スナップショット factory */
function makeReassessment(overrides: Partial<ReassessmentSnapshot> = {}): ReassessmentSnapshot {
  return {
    planningSheetId: 'ps-1',
    reassessedAt: '2026-03-01',
    planChangeDecision: 'minor_revision',
    ...overrides,
  };
}

/** 入力データ factory */
function makeInput(overrides: Partial<DeterminePhaseInput> = {}): DeterminePhaseInput {
  return {
    userId: 'u-1',
    userName: '伊藤 みなみ',
    planningSheets: [makeSheet()],
    reassessments: [],
    referenceDate: '2026-02-15',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. 基本フェーズ判定
// ─────────────────────────────────────────────

describe('determineWorkflowPhase', () => {
  describe('基本フェーズ判定', () => {
    it('計画シートなし → needs_assessment', () => {
      const result = determineWorkflowPhase(
        makeInput({ planningSheets: [] }),
      );

      expect(result.phase).toBe('needs_assessment');
      expect(result.reason).toBe('missing_plan');
      expect(result.severity).toBe('info');
      expect(result.planningSheetId).toBeNull();
      expect(result.monitoring).toBeNull();
    });

    it('計画あり・手順なし → needs_plan', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [makeSheet({ procedureCount: 0 })],
        }),
      );

      expect(result.phase).toBe('needs_plan');
      expect(result.reason).toBe('missing_steps');
      expect(result.severity).toBe('warning');
      expect(result.planningSheetId).toBe('ps-1');
    });

    it('計画あり・手順あり・期限余裕 → active_plan', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // appliedFrom: 2026-01-01, cycle: 90 → due: 2026-04-01
          // referenceDate: 2026-02-15 → 45 days remaining → safe
          referenceDate: '2026-02-15',
        }),
      );

      expect(result.phase).toBe('active_plan');
      expect(result.reason).toBe('stable');
      expect(result.severity).toBe('success');
      expect(result.monitoring).not.toBeNull();
      expect(result.monitoring!.daysRemaining).toBe(45);
    });

    it('モニタリング14日以内 → needs_monitoring', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // due: 2026-04-01, ref: 2026-03-25 → 7 days remaining
          referenceDate: '2026-03-25',
        }),
      );

      expect(result.phase).toBe('needs_monitoring');
      expect(result.reason).toBe('monitoring_upcoming');
      expect(result.severity).toBe('warning');
      expect(result.monitoring!.daysRemaining).toBe(7);
    });

    it('モニタリング超過 → monitoring_overdue', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // due: 2026-04-01, ref: 2026-04-10 → -9 days
          referenceDate: '2026-04-10',
        }),
      );

      expect(result.phase).toBe('monitoring_overdue');
      expect(result.reason).toBe('monitoring_overdue');
      expect(result.severity).toBe('danger');
      expect(result.monitoring!.daysRemaining).toBe(-9);
    });

    it('再評価未反映あり → needs_reassessment', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({ reviewedAt: '2026-02-01' }),
          ],
          reassessments: [
            makeReassessment({
              reassessedAt: '2026-02-20',
              planChangeDecision: 'minor_revision',
            }),
          ],
          referenceDate: '2026-02-25',
        }),
      );

      expect(result.phase).toBe('needs_reassessment');
      expect(result.reason).toBe('reassessment_pending');
      expect(result.severity).toBe('warning');
      expect(result.reassessment).not.toBeNull();
      expect(result.reassessment!.lastReassessmentAt).toBe('2026-02-20');
    });
  });

  // ─────────────────────────────────────────────
  // 2. 判定順の優先度テスト
  // ─────────────────────────────────────────────

  describe('判定順の優先度', () => {
    it('期限超過と再評価待ちが両方ある場合 → monitoring_overdue が優先', () => {
      // reviewedAt: 2026-02-01 → next due: 2026-02-01 + 90 = 2026-05-02
      // referenceDate: 2026-05-10 → 8 days overdue
      // reassessment: 2026-03-20 (> reviewedAt 2026-02-01) → unreflected
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({
              appliedFrom: '2026-01-01',
              reviewedAt: '2026-02-01',
              reviewCycleDays: 90,
            }),
          ],
          reassessments: [
            makeReassessment({
              reassessedAt: '2026-03-20',
              planChangeDecision: 'major_revision',
            }),
          ],
          referenceDate: '2026-05-10',
        }),
      );

      // monitoring_overdue は再評価待ちより優先される
      expect(result.phase).toBe('monitoring_overdue');
    });

    it('再評価の planChangeDecision が no_change なら needs_reassessment にならない', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({ reviewedAt: '2026-02-01' }),
          ],
          reassessments: [
            makeReassessment({
              reassessedAt: '2026-02-20',
              planChangeDecision: 'no_change',
            }),
          ],
          referenceDate: '2026-02-25',
        }),
      );

      // no_change は反映不要なので active_plan になる
      expect(result.phase).not.toBe('needs_reassessment');
    });

    it('再評価日 <= reviewedAt なら反映済みとみなす', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({ reviewedAt: '2026-03-01' }),
          ],
          reassessments: [
            makeReassessment({
              reassessedAt: '2026-02-20',
              planChangeDecision: 'minor_revision',
            }),
          ],
          referenceDate: '2026-03-05',
        }),
      );

      // reviewedAt (3/1) >= reassessedAt (2/20) → 反映済み
      expect(result.phase).not.toBe('needs_reassessment');
    });
  });

  // ─────────────────────────────────────────────
  // 3. フォールバック・エッジケース
  // ─────────────────────────────────────────────

  describe('エッジケース', () => {
    it('appliedFrom 不在時は今日をフォールバックとする', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [makeSheet({ appliedFrom: null })],
          referenceDate: '2026-03-14',
        }),
      );

      // appliedFrom が null → new Date().toISOString().slice(0,10) が使われる
      // cycle: 90 → due は 90日後 → safe
      expect(result.phase).toBe('active_plan');
      expect(result.monitoring).not.toBeNull();
    });

    it('reviewCycleDays 未設定時はデフォルト90日', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [makeSheet({ reviewCycleDays: undefined })],
          referenceDate: '2026-02-15',
        }),
      );

      // デフォルト90日: 1/1 + 90 = 4/1, ref 2/15 → 45日残 → safe
      expect(result.monitoring!.daysRemaining).toBe(45);
    });

    it('境界値: 当日がモニタリング期限日', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // due: 2026-04-01, ref: 2026-04-01 → 0 days → 'due'
          referenceDate: '2026-04-01',
        }),
      );

      // daysRemaining === 0, urgency 'due' は overdue ではない
      // daysRemaining <= 14 → needs_monitoring
      expect(result.phase).toBe('needs_monitoring');
      expect(result.monitoring!.daysRemaining).toBe(0);
    });

    it('境界値: モニタリング14日ちょうど前', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // due: 2026-04-01, ref: 2026-03-18 → 14 days
          referenceDate: '2026-03-18',
        }),
      );

      expect(result.phase).toBe('needs_monitoring');
      expect(result.monitoring!.daysRemaining).toBe(14);
    });

    it('境界値: モニタリング15日前 → active_plan', () => {
      const result = determineWorkflowPhase(
        makeInput({
          // due: 2026-04-01, ref: 2026-03-17 → 15 days
          referenceDate: '2026-03-17',
        }),
      );

      expect(result.phase).toBe('active_plan');
      expect(result.monitoring!.daysRemaining).toBe(15);
    });

    it('利用者名やID欠損時でも落ちない', () => {
      const result = determineWorkflowPhase({
        userId: '',
        userName: '',
        planningSheets: [],
        referenceDate: '2026-03-14',
      });

      expect(result.phase).toBe('needs_assessment');
      expect(result.userId).toBe('');
      expect(result.userName).toBe('');
    });

    it('複数の計画シートがある場合、active + isCurrent を優先', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({ id: 'ps-old', status: 'archived', isCurrent: false, procedureCount: 10 }),
            makeSheet({ id: 'ps-active', status: 'active', isCurrent: true, procedureCount: 3 }),
            makeSheet({ id: 'ps-draft', status: 'draft', isCurrent: false, procedureCount: 0 }),
          ],
        }),
      );

      expect(result.planningSheetId).toBe('ps-active');
    });

    it('completed milestone がある場合 (reviewedAt 使用) のスケジュール計算', () => {
      const result = determineWorkflowPhase(
        makeInput({
          planningSheets: [
            makeSheet({
              appliedFrom: '2026-01-01',
              reviewedAt: '2026-04-01', // 第1回モニタリング完了
              reviewCycleDays: 90,
            }),
          ],
          // next due: 4/1 + 90 = 6/30, ref: 5/1 → 60 days → safe
          referenceDate: '2026-05-01',
        }),
      );

      expect(result.phase).toBe('active_plan');
      expect(result.monitoring!.nextDueDate).toBe('2026-06-30');
      expect(result.monitoring!.daysRemaining).toBe(60);
    });
  });
});

// ─────────────────────────────────────────────
// 4. findActiveSheet
// ─────────────────────────────────────────────

describe('findActiveSheet', () => {
  it('空配列に対して null を返す', () => {
    expect(findActiveSheet([])).toBeNull();
  });

  it('active + isCurrent を最優先で返す', () => {
    const sheets = [
      makeSheet({ id: 'ps-1', status: 'draft', isCurrent: false }),
      makeSheet({ id: 'ps-2', status: 'active', isCurrent: true }),
      makeSheet({ id: 'ps-3', status: 'active', isCurrent: false }),
    ];

    expect(findActiveSheet(sheets)!.id).toBe('ps-2');
  });

  it('isCurrent なし → status=active を返す', () => {
    const sheets = [
      makeSheet({ id: 'ps-1', status: 'draft', isCurrent: false }),
      makeSheet({ id: 'ps-2', status: 'active', isCurrent: false }),
    ];

    expect(findActiveSheet(sheets)!.id).toBe('ps-2');
  });

  it('active なし → 最初のシートを返す', () => {
    const sheets = [
      makeSheet({ id: 'ps-1', status: 'draft' }),
    ];

    expect(findActiveSheet(sheets)!.id).toBe('ps-1');
  });
});

// ─────────────────────────────────────────────
// 5. ソート・フィルター
// ─────────────────────────────────────────────

describe('sortByWorkflowPriority', () => {
  it('priority 昇順でソートされる', () => {
    const items: WorkflowPhaseResult[] = [
      determineWorkflowPhase(makeInput({ referenceDate: '2026-02-15' })), // active_plan (6)
      determineWorkflowPhase(makeInput({ planningSheets: [] })), // needs_assessment (3)
      determineWorkflowPhase(makeInput({ referenceDate: '2026-04-10' })), // monitoring_overdue (1)
    ];

    const sorted = sortByWorkflowPriority(items);

    expect(sorted[0].phase).toBe('monitoring_overdue');
    expect(sorted[1].phase).toBe('needs_assessment');
    expect(sorted[2].phase).toBe('active_plan');
  });

  it('同一 priority ではモニタリング残日数の昇順', () => {
    // 異なる referenceDate で needs_monitoring を2件作る
    const item1 = determineWorkflowPhase(
      makeInput({
        userId: 'u-1',
        userName: 'A',
        referenceDate: '2026-03-25', // 7 days remaining
      }),
    );
    const item2 = determineWorkflowPhase(
      makeInput({
        userId: 'u-2',
        userName: 'B',
        referenceDate: '2026-03-28', // 4 days remaining
      }),
    );

    const sorted = sortByWorkflowPriority([item1, item2]);
    expect(sorted[0].monitoring!.daysRemaining).toBeLessThan(
      sorted[1].monitoring!.daysRemaining,
    );
  });
});

describe('filterActionRequired', () => {
  it('active_plan を除外する', () => {
    const items: WorkflowPhaseResult[] = [
      determineWorkflowPhase(makeInput({ referenceDate: '2026-02-15' })), // active_plan
      determineWorkflowPhase(makeInput({ planningSheets: [] })), // needs_assessment
    ];

    const filtered = filterActionRequired(items);

    expect(filtered.length).toBe(1);
    expect(filtered[0].phase).toBe('needs_assessment');
  });
});

// ─────────────────────────────────────────────
// 6. toPlanningWorkflowCardItem (UI mapper)
// ─────────────────────────────────────────────

describe('toPlanningWorkflowCardItem', () => {
  it('needs_assessment → 正しいラベルとリンク', () => {
    const result = determineWorkflowPhase(
      makeInput({ planningSheets: [] }),
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('アセスメント未実施');
    expect(card.ctaLabel).toBe('計画シートを新規作成');
    expect(card.href).toBe('/support-planning-sheet/new');
    expect(card.severity).toBe('info');
  });

  it('needs_plan → 正しいラベルとリンク', () => {
    const result = determineWorkflowPhase(
      makeInput({
        planningSheets: [makeSheet({ procedureCount: 0 })],
      }),
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('計画設計中');
    expect(card.ctaLabel).toBe('支援設計タブを開く');
    expect(card.href).toContain('tab=planning');
  });

  it('monitoring_overdue → 超過日数が subtitle に含まれる', () => {
    const result = determineWorkflowPhase(
      makeInput({ referenceDate: '2026-04-10' }), // -9 days
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('モニタリング超過');
    expect(card.subtitle).toContain('9日超過');
    expect(card.ctaLabel).toBe('モニタリングを実施');
    expect(card.href).toContain('tab=monitoring');
  });

  it('needs_monitoring → 残日数が subtitle に含まれる', () => {
    const result = determineWorkflowPhase(
      makeInput({ referenceDate: '2026-03-25' }), // 7 days
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('モニタリング時期');
    expect(card.subtitle).toContain('7日');
    expect(card.ctaLabel).toBe('モニタリングタブを確認');
  });

  it('needs_reassessment → 正しいラベルとリンク', () => {
    const result = determineWorkflowPhase(
      makeInput({
        planningSheets: [makeSheet({ reviewedAt: '2026-02-01' })],
        reassessments: [
          makeReassessment({ reassessedAt: '2026-02-20', planChangeDecision: 'minor_revision' }),
        ],
        referenceDate: '2026-02-25',
      }),
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('再評価待ち');
    expect(card.ctaLabel).toBe('再評価タブへ');
    expect(card.href).toContain('tab=reassessment');
  });

  it('active_plan → Daily 記録へのリンク', () => {
    const result = determineWorkflowPhase(
      makeInput({ referenceDate: '2026-02-15' }),
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.title).toBe('計画実施中');
    expect(card.ctaLabel).toBe('Daily 記録へ');
    expect(card.href).toContain('userId=u-1');
  });

  it('userId/userName が正しくコピーされる', () => {
    const result = determineWorkflowPhase(
      makeInput({ userId: 'u-test', userName: 'テスト太郎' }),
    );
    const card = toPlanningWorkflowCardItem(result);

    expect(card.userId).toBe('u-test');
    expect(card.userName).toBe('テスト太郎');
  });
});

// ─────────────────────────────────────────────
// 7. PHASE_PRIORITIES の一貫性
// ─────────────────────────────────────────────

describe('PHASE_PRIORITIES', () => {
  it('monitoring_overdue が最も高い優先度（最小値）', () => {
    const values = Object.values(PHASE_PRIORITIES);
    const min = Math.min(...values);
    expect(PHASE_PRIORITIES.monitoring_overdue).toBe(min);
  });

  it('active_plan が最も低い優先度（最大値）', () => {
    const values = Object.values(PHASE_PRIORITIES);
    const max = Math.max(...values);
    expect(PHASE_PRIORITIES.active_plan).toBe(max);
  });

  it('全フェーズに一意の priority がある', () => {
    const values = Object.values(PHASE_PRIORITIES);
    expect(new Set(values).size).toBe(values.length);
  });
});
