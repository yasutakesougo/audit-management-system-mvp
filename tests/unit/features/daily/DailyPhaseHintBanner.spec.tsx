/**
 * DailyPhaseHintBanner — 単体テスト
 *
 * 純粋関数 getDailyPhaseHint() のフェーズ別ヒント判定と
 * UIコンポーネント DailyPhaseHintBanner の表示・dismiss 動作を検証
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DailyPhaseHintBanner,
  getDailyPhaseHint,
} from '@/features/daily/components/DailyPhaseHintBanner';

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

// ────────────────────────────────────────────────────────────
// テストユーティリティ
// ────────────────────────────────────────────────────────────

/** 指定時刻の Date オブジェクトを返す */
const at = (h: number, m: number) => new Date(2026, 0, 15, h, m, 0);

// ────────────────────────────────────────────────────────────
// 純粋関数テスト: getDailyPhaseHint
// ────────────────────────────────────────────────────────────

describe('getDailyPhaseHint', () => {
  it.each<[string, Date, string, string]>([
    // [説明, 時刻, 期待フェーズ(9分割→6分割), メッセージに含まれる語]
    // 06:00/07:30 は after_hours_review (18:00-08:30) → record-review
    ['06:00 → record-review', at(6, 0), 'record-review', '振り返り'],
    ['07:30 → record-review', at(7, 30), 'record-review', '仕上げ'],
    // 08:30 は staff_prep (08:30-09:00) → preparation
    ['08:30 → preparation', at(8, 30), 'preparation', '欠席連絡'],
    ['09:00 → morning-meeting', at(9, 0), 'morning-meeting', '通所状況'],
    ['09:15 → am-operation', at(9, 15), 'am-operation', '午前活動'],
    ['11:00 → am-operation', at(11, 0), 'am-operation', '記録'],
    ['12:00 → pm-operation', at(12, 0), 'pm-operation', '午後活動'],
    ['14:00 → pm-operation', at(14, 0), 'pm-operation', '午前分'],
    // 15:30 は pm_activity (13:45-15:45) → pm-operation
    ['15:30 → pm-operation', at(15, 30), 'pm-operation', '午前分'],
    // 16:00 は record_wrapup (16:00-17:00) → record-review
    ['16:00 → record-review', at(16, 0), 'record-review', '振り返り'],
    // 17:00-18:00 は evening_briefing → record-review
    ['17:00 → record-review', at(17, 0), 'record-review', '振り返り'],
    ['20:00 → record-review', at(20, 0), 'record-review', '仕上げ'],
    ['03:00 → record-review', at(3, 0), 'record-review', '確認'],
  ])('%s', (_desc, time, expectedPhase, expectedWord) => {
    const hint = getDailyPhaseHint(time);
    expect(hint.phase).toBe(expectedPhase);
    expect(hint.message).toContain(expectedWord);
    expect(hint.phaseLabel).toBeTruthy();
  });

  it('すべてのフェーズで suggestedAction と color が定義されている', () => {
    const times = [at(7, 0), at(8, 45), at(10, 0), at(13, 0), at(16, 0), at(18, 0)];
    for (const t of times) {
      const hint = getDailyPhaseHint(t);
      expect(hint.color).toMatch(/^(info|warning|success)$/);
      // suggestedAction は null でも可
      expect(hint.phase).toBeTruthy();
    }
  });

  it('朝会は warning, AM/PM activity は info, 振り返りは success', () => {
    // 08:45 → staff_prep → preparation → info
    expect(getDailyPhaseHint(at(8, 45)).color).toBe('info');
    // 09:05 → morning_briefing → morning-meeting → warning
    expect(getDailyPhaseHint(at(9, 5)).color).toBe('warning');
    expect(getDailyPhaseHint(at(10, 30)).color).toBe('info');
    expect(getDailyPhaseHint(at(13, 0)).color).toBe('info');
    // 16:00 → record_wrapup → record-review → success
    expect(getDailyPhaseHint(at(16, 0)).color).toBe('success');
    expect(getDailyPhaseHint(at(18, 0)).color).toBe('success');
  });

  it('推奨アクションが適切に設定されている', () => {
    // 07:00 → after_hours_review → record-review → null
    expect(getDailyPhaseHint(at(7, 0)).suggestedAction).toBeNull();
    // 08:45 → staff_prep → preparation → 通所管理
    expect(getDailyPhaseHint(at(8, 45)).suggestedAction).toBe('通所管理');
    expect(getDailyPhaseHint(at(10, 30)).suggestedAction).toBe('一覧形式の日々の記録');
    expect(getDailyPhaseHint(at(13, 0)).suggestedAction).toBe('一覧形式の日々の記録');
    // 16:00 → record_wrapup → record-review → null
    expect(getDailyPhaseHint(at(16, 0)).suggestedAction).toBeNull();
    expect(getDailyPhaseHint(at(18, 0)).suggestedAction).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// UIコンポーネントテスト: DailyPhaseHintBanner
// ────────────────────────────────────────────────────────────

describe('DailyPhaseHintBanner', () => {
  afterEach(cleanup);

  it('バナーが表示される', () => {
    render(<DailyPhaseHintBanner now={at(10, 0)} />);
    expect(screen.getByTestId('daily-phase-hint-banner')).toBeInTheDocument();
  });

  it('フェーズラベルとメッセージが表示される', () => {
    render(<DailyPhaseHintBanner now={at(10, 0)} />);
    expect(screen.getByText(/AM活動/)).toBeInTheDocument();
    expect(screen.getByText(/午前活動の時間です/)).toBeInTheDocument();
  });

  it('閉じるボタンで非表示になる', () => {
    render(<DailyPhaseHintBanner now={at(10, 0)} />);
    const banner = screen.getByTestId('daily-phase-hint-banner');
    expect(banner).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('daily-phase-hint-dismiss'));
    expect(screen.queryByTestId('daily-phase-hint-banner')).not.toBeInTheDocument();
  });

  it('朝会フェーズでは warning 系の表示になる', () => {
    // 09:05 → morning_briefing → morning-meeting → warning
    render(<DailyPhaseHintBanner now={at(9, 5)} />);
    expect(screen.getByText(/朝会の時間です/)).toBeInTheDocument();
  });

  it('振り返りフェーズでは success 系の表示になる', () => {
    render(<DailyPhaseHintBanner now={at(18, 0)} />);
    expect(screen.getByText(/振り返りの時間です/)).toBeInTheDocument();
  });

  it('閉じるボタンに適切な aria-label がある', () => {
    render(<DailyPhaseHintBanner now={at(10, 0)} />);
    expect(screen.getByLabelText('ヒントを閉じる')).toBeInTheDocument();
  });
});
