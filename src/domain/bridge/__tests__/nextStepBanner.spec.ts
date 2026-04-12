/**
 * nextStepBanner — ユニットテスト
 *
 * テスト構成:
 * 1. overview コンテキスト（全フェーズ）
 * 2. monitoring コンテキスト（シグナル有無）
 * 3. reassessment コンテキスト（未反映有無）
 * 4. planning コンテキスト（手順有無）
 * 5. ルール検証（CTA 1つ、hidden 制御）
 */
import { describe, it, expect } from 'vitest';
import {
  buildPdcaAlerts,
  resolveNextStepBanner,
  type ResolveNextStepInput,
} from '../nextStepBanner';
import type { PdcaCycleState } from '@/domain/isp/types';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeInput(overrides: Partial<ResolveNextStepInput> = {}): ResolveNextStepInput {
  return {
    phase: 'active_plan',
    context: 'overview',
    userId: 'u-1',
    planningSheetId: 'ps-1',
    hasMonitoringSignals: false,
    hasUnappliedReassessment: false,
    hasPendingPlanUpdate: false,
    hasOverduePlanUpdate: false,
    ...overrides,
  };
}

function makePdcaState(
  overrides: Omit<Partial<PdcaCycleState>, 'phaseCompletions'> & {
    phaseCompletions?: Partial<PdcaCycleState['phaseCompletions']>;
  } = {},
): PdcaCycleState {
  const basePhaseCompletions: PdcaCycleState['phaseCompletions'] = {
    plan: '2026-03-01',
    do: '2026-03-01',
    check: null,
    act: null,
  };

  const { phaseCompletions, ...rest } = overrides;

  return {
    userId: 'u-1',
    planningSheetId: 'ps-1',
    currentPhase: 'check',
    cycleNumber: 1,
    healthScore: 0.9,
    healthScoreBreakdown: [],
    computedAt: '2026-03-10',
    ...rest,
    phaseCompletions: {
      ...basePhaseCompletions,
      ...(phaseCompletions ?? {}),
    },
  };
}

// ─────────────────────────────────────────────
// 1. Overview コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — overview', () => {
  it('monitoring_overdue → danger バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'monitoring_overdue', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('danger');
    expect(result.title).toContain('期限');
    expect(result.ctaLabel).toBe('モニタリングを実施');
    expect(result.href).toContain('tab=monitoring');
  });

  it('needs_reassessment → warning バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_reassessment', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.ctaLabel).toBe('再評価を確認');
    expect(result.href).toContain('tab=reassessment');
  });

  it('needs_monitoring → warning バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_monitoring', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.ctaLabel).toBe('モニタリングを確認');
  });

  it('needs_plan → info バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('支援設計を続ける');
    expect(result.href).toContain('tab=planning');
  });

  it('needs_assessment → info バナー表示', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'needs_assessment', context: 'overview' }),
    );

    expect(result.hidden).toBe(false);
    expect(result.ctaLabel).toBe('計画シートを新規作成');
    expect(result.href).toBe('/support-planning-sheet/new');
  });

  it('active_plan → hidden', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'active_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(true);
  });

  it('pdcaCycleState 未指定でも従来どおり（alerts は空）', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'needs_monitoring',
        context: 'overview',
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.ctaLabel).toBe('モニタリングを確認');
    expect(result.alerts).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// 2. Monitoring コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — monitoring', () => {
  it('シグナルあり → warning「再評価に反映」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'monitoring',
        hasMonitoringSignals: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('見直し候補');
    expect(result.ctaLabel).toBe('再評価に反映');
    expect(result.href).toContain('tab=reassessment');
  });

  it('シグナルなし → success「再評価を確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'monitoring',
        hasMonitoringSignals: false,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('success');
    expect(result.ctaLabel).toBe('再評価を確認');
  });
});

// ─────────────────────────────────────────────
// 3. Reassessment コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — reassessment', () => {
  it('未反映あり → warning「計画を更新」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'reassessment',
        hasUnappliedReassessment: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('計画を更新');
    expect(result.ctaLabel).toBe('計画を更新');
    expect(result.href).toContain('tab=planning');
  });

  it('未反映なし → info「反映内容を確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        context: 'reassessment',
        hasUnappliedReassessment: false,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('反映内容を確認');
  });
});

// ─────────────────────────────────────────────
// 4. Planning コンテキスト
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — planning', () => {
  it('未反映の計画更新があると warning バナーで更新案確認を促す', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'active_plan',
        context: 'planning',
        hasPendingPlanUpdate: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('未反映');
    expect(result.ctaLabel).toBe('更新案を確認');
    expect(result.href).toContain('tab=planning');
  });

  it('期限超過の計画更新があると danger バナーを返す', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'active_plan',
        context: 'planning',
        hasPendingPlanUpdate: true,
        hasOverduePlanUpdate: true,
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('danger');
    expect(result.title).toContain('期限');
  });

  it('needs_plan → info「手順を追加」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'needs_plan',
        context: 'planning',
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('info');
    expect(result.ctaLabel).toBe('手順を追加');
  });

  it('active_plan → success「Dailyで確認」', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'active_plan',
        context: 'planning',
      }),
    );

    expect(result.hidden).toBe(false);
    expect(result.tone).toBe('success');
    expect(result.ctaLabel).toBe('Dailyで確認');
    expect(result.href).toContain('userId=u-1');
  });
});

// ─────────────────────────────────────────────
// 5. ルール検証
// ─────────────────────────────────────────────

describe('resolveNextStepBanner — ルール', () => {
  it('CTA は必ず1つ（ctaLabel が非空文字列）', () => {
    const contexts: ResolveNextStepInput['context'][] = ['overview', 'monitoring', 'reassessment', 'planning'];
    const phases: ResolveNextStepInput['phase'][] = [
      'needs_assessment', 'needs_plan', 'active_plan',
      'needs_monitoring', 'monitoring_overdue', 'needs_reassessment',
    ];

    for (const context of contexts) {
      for (const phase of phases) {
        const result = resolveNextStepBanner(makeInput({ context, phase }));
        if (!result.hidden) {
          expect(result.ctaLabel.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('hidden バナーの title/description/ctaLabel は空', () => {
    const result = resolveNextStepBanner(
      makeInput({ phase: 'active_plan', context: 'overview' }),
    );

    expect(result.hidden).toBe(true);
    expect(result.title).toBe('');
    expect(result.description).toBe('');
    expect(result.ctaLabel).toBe('');
  });

  it('planningSheetId が href に埋め込まれる', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'monitoring_overdue',
        context: 'overview',
        planningSheetId: 'ps-test-123',
      }),
    );

    expect(result.href).toContain('ps-test-123');
  });

  it('不明な context は hidden を返す', () => {
    const result = resolveNextStepBanner(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeInput({ context: 'unknown' as ResolveNextStepInput['context'] }),
    );

    expect(result.hidden).toBe(true);
  });
});

describe('resolveNextStepBanner — PDCA alerts', () => {
  it('未反映の計画更新があると alert を追加する', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'needs_monitoring',
        context: 'overview',
        hasPendingPlanUpdate: true,
      }),
    );

    expect(result.alerts).toContainEqual({
      type: 'warning',
      message: '支援計画の更新が未反映',
      action: '更新案を確認',
      priority: 'p1',
    });
  });

  it('期限超過の計画更新があると p0 alert を追加する', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'needs_monitoring',
        context: 'overview',
        hasPendingPlanUpdate: true,
        hasOverduePlanUpdate: true,
      }),
    );

    expect(result.alerts).toContainEqual({
      type: 'danger',
      message: '支援計画の更新期限を超過',
      action: '更新案を確認',
      priority: 'p0',
    });
  });

  it('check phase + 3日 → p2', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'check',
        phaseCompletions: { do: '2026-03-07' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: 'モニタリング確認推奨（3日）',
      action: 'モニタリングへ',
      priority: 'p2',
    });
  });

  it('check phase で開始日が未来日でも 0日扱いで p2', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'check',
        phaseCompletions: { do: '2026-03-12' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: 'モニタリング確認推奨（0日）',
      priority: 'p2',
    });
  });

  it('check phase + 8日 → p1', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'check',
        phaseCompletions: { do: '2026-03-02' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: 'モニタリング未実施（8日）',
      priority: 'p1',
    });
  });

  it('check phase + 15日 → p0', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'check',
        phaseCompletions: { do: '2026-02-23' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: 'モニタリング長期未実施（15日）',
      priority: 'p0',
      type: 'danger',
    });
  });

  it('act phase + 3日 → p2', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'act',
        phaseCompletions: { check: '2026-03-07' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '再評価確認推奨（3日）',
      action: '再評価入力へ',
      priority: 'p2',
    });
  });

  it('act phase + 8日 → p1', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'act',
        phaseCompletions: { check: '2026-03-02' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '再評価未実施（8日）',
      priority: 'p1',
    });
  });

  it('act phase + 15日 → p0', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'act',
        phaseCompletions: { check: '2026-02-23' },
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '再評価長期未実施（15日）',
      priority: 'p0',
      type: 'danger',
    });
  });

  it('healthScore 0.55 → p2', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'do',
        healthScore: 0.55,
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '支援状態を確認',
      priority: 'p2',
      action: 'PDCA確認',
    });
  });

  it('healthScore 0.35 → p1', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'do',
        healthScore: 0.35,
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '支援状態に注意',
      priority: 'p1',
    });
  });

  it('healthScore 0.15 → p0', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'do',
        healthScore: 0.15,
      }),
      '2026-03-10',
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      message: '支援状態が危険域',
      priority: 'p0',
      type: 'danger',
    });
  });

  it('既存バナー内容を壊さず、PDCA alerts のみ追加する', () => {
    const result = resolveNextStepBanner(
      makeInput({
        phase: 'monitoring_overdue',
        context: 'overview',
        pdcaCycleState: makePdcaState({
          currentPhase: 'check',
          phaseCompletions: { do: '2026-02-20' },
        }),
      }),
    );

    expect(result.tone).toBe('danger');
    expect(result.title).toBe('モニタリング期限を過ぎています');
    expect(result.description).toBe('速やかにモニタリングを実施してください。');
    expect(result.ctaLabel).toBe('モニタリングを実施');
    expect(result.href).toContain('tab=monitoring');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].message).toBe('モニタリング長期未実施（18日）');
    expect(result.alerts[0].priority).toBe('p0');
  });

  it('複数 alert は priority 順（p0→p1→p2）に整列', () => {
    const alerts = buildPdcaAlerts(
      makePdcaState({
        currentPhase: 'check',
        phaseCompletions: { do: '2026-02-20' }, // check は p0
        healthScore: 0.35, // health は p1
      }),
      '2026-03-10',
    );

    expect(alerts.map((a) => a.priority)).toEqual(['p0', 'p1']);
  });
});
