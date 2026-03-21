import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PdcaCyclePanel } from '../PdcaCyclePanel';

describe('PdcaCyclePanel', () => {
  it('loading 時は読み込み表示', () => {
    render(<PdcaCyclePanel state={null} loading />);
    expect(screen.getByText('PDCA状態を読み込み中です。')).toBeInTheDocument();
  });

  it('error 時はエラー表示', () => {
    render(<PdcaCyclePanel state={null} error={new Error('failed')} />);
    expect(screen.getByText('PDCA状態の取得に失敗しました。')).toBeInTheDocument();
  });

  it('state があると主要項目を表示', () => {
    render(
      <PdcaCyclePanel
        state={{
          userId: 'U-001',
          planningSheetId: 'sp-1',
          currentPhase: 'check',
          cycleNumber: 2,
          phaseCompletions: {
            plan: '2026-03-01',
            do: '2026-03-05',
            check: null,
            act: '2026-03-10',
          },
          healthScore: 0.74,
          healthScoreBreakdown: ['手順実施率: 70%'],
          computedAt: '2026-03-20',
        }}
      />,
    );

    expect(screen.getByText('PDCAサイクル状態')).toBeInTheDocument();
    expect(screen.getByText(/現在フェーズ:/)).toBeInTheDocument();
    expect(screen.getByText(/健全度スコア:/)).toBeInTheDocument();
    expect(screen.getByText(/サイクル番号: 2/)).toBeInTheDocument();
    expect(screen.getByText(/現在フェーズ完了日: 未完了/)).toBeInTheDocument();
  });
});
