/**
 * TodayPhaseIndicator — unit tests
 *
 * getTodayPhaseHint: 純粋関数テスト（全6フェーズ + 境界値）
 * TodayPhaseIndicator: コンポーネントテスト（表示・dismiss・サジェスト）
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  getTodayPhaseHint,
  TodayPhaseIndicator,
} from '@/features/today/widgets/TodayPhaseIndicator';

// Mock hooks/telemetry that require context unavailable in unit tests
vi.mock('@/features/operationFlow/hooks/useOperationFlowConfig', () => ({
  useOperationFlowConfig: () => ({ config: undefined, loading: false }),
}));
vi.mock('@/features/operationFlow/telemetry/recordPhaseEvent', () => ({
  recordPhaseEvent: vi.fn(),
  PHASE_EVENTS: {
    SUGGEST_SHOWN: 'phase_suggest_shown',
    SUGGEST_DISMISSED: 'phase_suggest_dismissed',
    SUGGEST_ACCEPTED: 'phase_suggest_accepted',
  },
}));

// ── helpers ──
function at(h: number, m: number): Date {
  return new Date(2026, 2, 13, h, m, 0); // 2026-03-13
}

// ────────────────────────────────────────
// 純粋関数テスト: getTodayPhaseHint
// ────────────────────────────────────────
describe('getTodayPhaseHint', () => {
  // 9分割 DEFAULT_PHASE_CONFIG ベース:
  // after_hours_review 18:00-08:30, staff_prep 08:30-09:00,
  // morning_briefing 09:00-09:15, arrival_intake 09:15-10:30,
  // am_activity 10:30-12:00, pm_activity 12:00-15:30,
  // departure_support 15:30-16:00, record_wrapup 16:00-17:00,
  // evening_briefing 17:00-18:00

  it('06:00 → record-review (深夜→after_hours_review)', () => {
    const hint = getTodayPhaseHint(at(6, 0));
    expect(hint.phase).toBe('record-review');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/dashboard');
  });

  it('08:30 → preparation (staff_prep)', () => {
    const hint = getTodayPhaseHint(at(8, 30));
    expect(hint.phase).toBe('preparation');
    expect(hint.isTodayPrimary).toBe(true);
    expect(hint.primaryScreen).toBe('/today');
  });

  it('09:05 → morning-meeting (morning_briefing)', () => {
    const hint = getTodayPhaseHint(at(9, 5));
    expect(hint.phase).toBe('morning-meeting');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/handoff-timeline');
  });

  it('09:15 → am-operation (主役は /daily)', () => {
    const hint = getTodayPhaseHint(at(9, 15));
    expect(hint.phase).toBe('am-operation');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/daily');
  });

  it('10:30 → am-operation (主役は /today)', () => {
    const hint = getTodayPhaseHint(at(10, 30));
    expect(hint.phase).toBe('am-operation');
    expect(hint.isTodayPrimary).toBe(true);
    expect(hint.primaryScreen).toBe('/today');
  });

  it('12:00 → pm-operation (主役は /daily)', () => {
    const hint = getTodayPhaseHint(at(12, 0));
    expect(hint.phase).toBe('pm-operation');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/daily');
  });

  it('15:30 → evening-closing (主役は /daily)', () => {
    const hint = getTodayPhaseHint(at(15, 30));
    expect(hint.phase).toBe('evening-closing');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/daily');
  });

  it('17:00 → record-review (主役は /handoff-timeline)', () => {
    const hint = getTodayPhaseHint(at(17, 0));
    expect(hint.phase).toBe('record-review');
    expect(hint.isTodayPrimary).toBe(false);
    expect(hint.primaryScreen).toBe('/handoff-timeline');
  });

  it('03:00 → record-review (深夜)', () => {
    const hint = getTodayPhaseHint(at(3, 0));
    expect(hint.phase).toBe('record-review');
    expect(hint.primaryScreen).toBe('/dashboard');
  });

  it('すべてのフェーズで label と message が定義されている', () => {
    const times = [
      at(7, 0), at(8, 45), at(10, 30), at(14, 0), at(16, 0), at(18, 0),
    ];
    for (const t of times) {
      const hint = getTodayPhaseHint(t);
      expect(hint.label.length).toBeGreaterThan(0);
      expect(hint.message.length).toBeGreaterThan(0);
      expect(hint.primaryScreenLabel.length).toBeGreaterThan(0);
    }
  });

  it('主役画面が /today のフェーズは staff_prep と am_activity のみ', () => {
    // staff_prep 08:30-09:00, am_activity 10:30-12:00 → /today
    const todayPrimaryPhases = [at(8, 45), at(10, 30)];
    const notTodayPhases = [at(7, 0), at(9, 5), at(9, 20), at(13, 0), at(16, 0), at(18, 0)];

    todayPrimaryPhases.forEach(t => {
      expect(getTodayPhaseHint(t).isTodayPrimary).toBe(true);
    });
    notTodayPhases.forEach(t => {
      expect(getTodayPhaseHint(t).isTodayPrimary).toBe(false);
    });
  });
});

// ────────────────────────────────────────
// コンポーネントテスト: TodayPhaseIndicator
// ────────────────────────────────────────
describe('TodayPhaseIndicator', () => {
  it('バナーが表示される', () => {
    // 10:30 → am_activity → am-operation
    render(<TodayPhaseIndicator now={at(10, 30)} />);
    expect(screen.getByTestId('today-phase-indicator')).toBeInTheDocument();
  });

  it('フェーズラベルとメッセージが表示される', () => {
    // 10:30 → am_activity → am-operation
    render(<TodayPhaseIndicator now={at(10, 30)} />);
    expect(screen.getByText('AM活動')).toBeInTheDocument();
    expect(screen.getByText(/未記録があれば/)).toBeInTheDocument();
  });

  it('閉じるボタンで非表示になる', () => {
    render(<TodayPhaseIndicator now={at(10, 30)} />);
    const closeBtn = screen.getByLabelText('フェーズ表示を閉じる');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('today-phase-indicator')).not.toBeInTheDocument();
  });

  it('/today が主役のフェーズではサジェストが表示されない', () => {
    const handleNavigate = vi.fn();
    // 08:45 → staff_prep → preparation → /today が主役
    render(<TodayPhaseIndicator now={at(8, 45)} onNavigate={handleNavigate} />);
    expect(screen.queryByText(/メインの時間帯です/)).not.toBeInTheDocument();
  });

  it('/today が主役でないフェーズではサジェストが表示される', () => {
    const handleNavigate = vi.fn();
    // 09:05 → morning_briefing → morning-meeting → /handoff-timeline が主役
    render(<TodayPhaseIndicator now={at(9, 5)} onNavigate={handleNavigate} />);
    const suggestBtn = screen.getByText(/今は「申し送り」がメインの時間帯です/);
    expect(suggestBtn).toBeInTheDocument();
  });

  it('onNavigate なしではサジェストボタンが表示されない', () => {
    // 09:05 → morning_briefing (not today primary) but no onNavigate
    render(<TodayPhaseIndicator now={at(9, 5)} />);
    expect(screen.queryByText(/メインの時間帯です/)).not.toBeInTheDocument();
  });

  it('サジェストボタンクリックで onNavigate が呼ばれる', () => {
    const handleNavigate = vi.fn();
    // 12:30 → pm_activity → pm-operation → /daily が主役
    render(<TodayPhaseIndicator now={at(12, 30)} onNavigate={handleNavigate} />);
    const btn = screen.getByText(/今は「日々の記録」がメインの時間帯です/);
    fireEvent.click(btn);
    expect(handleNavigate).toHaveBeenCalledWith('/daily');
  });

  it('閉じるボタンに適切な aria-label がある', () => {
    render(<TodayPhaseIndicator now={at(10, 30)} />);
    expect(screen.getByLabelText('フェーズ表示を閉じる')).toBeInTheDocument();
  });
});
