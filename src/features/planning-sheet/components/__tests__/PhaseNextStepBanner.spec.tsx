import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PhaseNextStepBanner } from '../PhaseNextStepBanner';
import type { PdcaCycleState } from '@/domain/isp/types';

function makePdcaState(
  overrides: Omit<Partial<PdcaCycleState>, 'phaseCompletions'> & {
    phaseCompletions?: Partial<PdcaCycleState['phaseCompletions']>;
  } = {},
): PdcaCycleState {
  const basePhaseCompletions: PdcaCycleState['phaseCompletions'] = {
    plan: '2026-01-01',
    do: '2026-01-01',
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
    computedAt: '2026-03-21',
    ...rest,
    phaseCompletions: {
      ...basePhaseCompletions,
      ...(phaseCompletions ?? {}),
    },
  };
}

describe('PhaseNextStepBanner', () => {
  it('pdcaCycleState 未指定時は従来バナーのみ表示', () => {
    render(
      <PhaseNextStepBanner
        phase="needs_monitoring"
        context="overview"
        planningSheetId="ps-1"
      />,
    );

    expect(screen.getByText('モニタリング時期が近づいています')).toBeInTheDocument();
    expect(screen.queryByText(/モニタリング未実施/)).not.toBeInTheDocument();
  });

  it('p0 ラベル（早急対応）を表示する', () => {
    render(
      <PhaseNextStepBanner
        phase="needs_monitoring"
        context="overview"
        planningSheetId="ps-1"
        pdcaCycleState={makePdcaState({
          currentPhase: 'check',
          phaseCompletions: { do: '2026-03-06' },
        })}
      />,
    );

    expect(
      screen.getByText('[早急対応] モニタリング長期未実施（15日）（モニタリングへ）'),
    ).toBeInTheDocument();

    const item = screen.getByRole('listitem');
    expect(item).toHaveAttribute('data-p0-emphasis', 'true');
  });

  it('p1 ラベル（注意）を表示する', () => {
    render(
      <PhaseNextStepBanner
        phase="needs_reassessment"
        context="overview"
        planningSheetId="ps-1"
        pdcaCycleState={makePdcaState({
          currentPhase: 'do',
          healthScore: 0.35,
        })}
      />,
    );

    expect(screen.getByText('[注意] 支援状態に注意（PDCA確認）')).toBeInTheDocument();
  });

  it('p2 ラベル（確認）を表示する', () => {
    render(
      <PhaseNextStepBanner
        phase="needs_monitoring"
        context="overview"
        planningSheetId="ps-1"
        pdcaCycleState={makePdcaState({
          currentPhase: 'do',
          healthScore: 0.55,
        })}
      />,
    );

    expect(screen.getByText('[確認] 支援状態を確認（PDCA確認）')).toBeInTheDocument();
  });

  it('複数 alert は priority 順で描画される', () => {
    render(
      <PhaseNextStepBanner
        phase="needs_monitoring"
        context="overview"
        planningSheetId="ps-1"
        pdcaCycleState={makePdcaState({
          currentPhase: 'check',
          phaseCompletions: { do: '2026-03-06' }, // p0 (15日)
          healthScore: 0.35, // p1
        })}
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('[早急対応] モニタリング長期未実施（15日）（モニタリングへ）');
    expect(items[1]).toHaveTextContent('[注意] 支援状態に注意（PDCA確認）');
    expect(items[0]).toHaveAttribute('data-p0-emphasis', 'true');
    expect(items[1]).not.toHaveAttribute('data-p0-emphasis');
    expect(screen.getByText('モニタリング時期が近づいています')).toBeInTheDocument();
  });

  it('計画更新未反映があると planning バナーでレビュー導線を表示する', () => {
    render(
      <PhaseNextStepBanner
        phase="active_plan"
        context="planning"
        userId="u-1"
        planningSheetId="ps-1"
        hasPendingPlanUpdate
      />,
    );

    expect(screen.getByText('未反映の計画更新があります')).toBeInTheDocument();
    expect(screen.getByText('更新案を確認')).toBeInTheDocument();
  });
});
