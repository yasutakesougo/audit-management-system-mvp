/**
 * MeetingTabContent のレンダリングテスト
 *
 * 朝会/夕会の mode 切り替えで、
 * - Alert 文言
 * - タイムライン見出し
 * - チップラベル
 * - 進行ガイドの steps
 * - 要点サマリの条件表示
 * が正しく切り替わることを検証する。
 */

import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MeetingTabContentProps } from '../panels/MeetingTabContent';
import { MeetingTabContent } from '../panels/MeetingTabContent';

// ---------------------------------------------------------------------------
// TodayHandoffTimelineList をモック（内部でSPデータを取りに行くため）
// ---------------------------------------------------------------------------

vi.mock('@/features/handoff/TodayHandoffTimelineList', () => ({
  TodayHandoffTimelineList: ({ dayScope }: { dayScope?: string }) => (
    <div data-testid="mock-timeline" data-day-scope={dayScope}>
      mocked-timeline
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

const theme = createTheme();
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// ---------------------------------------------------------------------------
// Props factory
// ---------------------------------------------------------------------------

const buildProps = (
  overrides: Partial<MeetingTabContentProps> = {},
): MeetingTabContentProps => ({
  mode: 'morning',
  hasSummaryInfo: false,
  total: 0,
  criticalCount: 0,
  byStatus: {},
  timeline: {
    todayHandoffs: [],
    loading: false,
    error: null,
    updateHandoffStatus: vi.fn(),
  },
  handoffStats: null,
  onStatsChange: vi.fn(),
  previewLimit: 6,
  onOpenTimeline: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeetingTabContent', () => {
  // ── Alert 切り替え ──────────────────────────────────
  describe('Alert 文言', () => {
    it('mode=morning で安全インジケーター案内を表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'morning' })} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByText(
          '安全指標サマリはダッシュボードの「安全インジケーター」で確認できます。',
        ),
      ).toBeInTheDocument();
    });

    it('mode=evening で日々の記録案内を表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'evening' })} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByText(
          '記録状況の詳細はダッシュボードの「日々の記録」カードから確認できます。',
        ),
      ).toBeInTheDocument();
    });
  });

  // ── タイムライン見出し ──────────────────────────────
  describe('タイムライン見出し', () => {
    it('mode=morning で「申し送りタイムライン（昨日）」を表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'morning' })} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByText('申し送りタイムライン（昨日）'),
      ).toBeInTheDocument();
    });

    it('mode=evening で「申し送りタイムライン（今日）」を表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'evening' })} />, {
        wrapper: Wrapper,
      });
      expect(
        screen.getByText('申し送りタイムライン（今日）'),
      ).toBeInTheDocument();
    });
  });

  // ── Chip ラベル ──────────────────────────────────────
  describe('Chip ラベル', () => {
    it('mode=morning で「朝会」チップを表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'morning' })} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText('朝会')).toBeInTheDocument();
    });

    it('mode=evening で「夕会」チップを表示する', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'evening' })} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText('夕会')).toBeInTheDocument();
    });
  });

  // ── 進行ガイド ──────────────────────────────────────
  describe('進行ガイド', () => {
    it('mode=morning で朝会の進行ステップが含まれる', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'morning' })} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText('進行ガイド（チェックリスト）')).toBeInTheDocument();
      // steps の存在確認（AccordionDetails は defaultExpanded=false なので、
      // MUI v5 では内部DOM上は存在するが非表示になりうる。
      // getByText はDOM上に存在すれば通る）
      expect(screen.getByText(/安全指標の確認/)).toBeInTheDocument();
    });

    it('mode=evening で夕会の進行ステップが含まれる', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'evening' })} />, {
        wrapper: Wrapper,
      });
      expect(screen.getByText(/本日の記録・対応状況の確認/)).toBeInTheDocument();
    });
  });

  // ── TodayHandoffTimelineList の dayScope ─────────────
  describe('Timeline dayScope', () => {
    it('mode=morning で dayScope="yesterday" を渡す', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'morning' })} />, {
        wrapper: Wrapper,
      });
      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute('data-day-scope', 'yesterday');
    });

    it('mode=evening で dayScope="today" を渡す', () => {
      render(<MeetingTabContent {...buildProps({ mode: 'evening' })} />, {
        wrapper: Wrapper,
      });
      const timeline = screen.getByTestId('mock-timeline');
      expect(timeline).toHaveAttribute('data-day-scope', 'today');
    });
  });

  // ── 今日の要点サマリ ────────────────────────────────
  describe('要点サマリ', () => {
    it('hasSummaryInfo=false だと要点セクションが表示されない', () => {
      render(
        <MeetingTabContent {...buildProps({ hasSummaryInfo: false })} />,
        { wrapper: Wrapper },
      );
      expect(screen.queryByText('今日の要点')).not.toBeInTheDocument();
    });

    it('hasSummaryInfo=true で要点セクションが表示される', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            hasSummaryInfo: true,
            total: 5,
            criticalCount: 0,
            byStatus: {},
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByText('今日の要点')).toBeInTheDocument();
      expect(screen.getByText('合計 5')).toBeInTheDocument();
    });

    it('criticalCount > 0 で注意チップが表示される', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            hasSummaryInfo: true,
            total: 3,
            criticalCount: 2,
            byStatus: {},
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByText('注意 2')).toBeInTheDocument();
    });

    it('byStatus.未対応 > 0 で未対応チップが表示される', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            hasSummaryInfo: true,
            total: 4,
            criticalCount: 0,
            byStatus: { '未対応': 3 },
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByText('未対応 3')).toBeInTheDocument();
    });

    it('criticalCount=0 & 未対応=0 だと注意/未対応チップが出ない', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            hasSummaryInfo: true,
            total: 2,
            criticalCount: 0,
            byStatus: {},
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.queryByText(/^注意 \d+$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/^未対応 \d+$/)).not.toBeInTheDocument();
      expect(screen.getByText('合計 2')).toBeInTheDocument();
    });
  });

  // ── 「もっと見る」ボタン ────────────────────────────
  describe('もっと見るボタン', () => {
    it('handoffStats.total > previewLimit で表示される', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            handoffStats: { total: 10, completed: 2, inProgress: 3, pending: 5 },
            previewLimit: 6,
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.getByText('申し送りをもっと見る')).toBeInTheDocument();
    });

    it('handoffStats.total <= previewLimit で非表示', () => {
      render(
        <MeetingTabContent
          {...buildProps({
            handoffStats: { total: 3, completed: 1, inProgress: 1, pending: 1 },
            previewLimit: 6,
          })}
        />,
        { wrapper: Wrapper },
      );
      expect(screen.queryByText('申し送りをもっと見る')).not.toBeInTheDocument();
    });

    it('handoffStats=null で非表示', () => {
      render(
        <MeetingTabContent {...buildProps({ handoffStats: null })} />,
        { wrapper: Wrapper },
      );
      expect(screen.queryByText('申し送りをもっと見る')).not.toBeInTheDocument();
    });
  });

  // ── data-testid 検証 ────────────────────────────────
  describe('data-testid', () => {
    it('mode=morning で morning 用の testid が付与される', () => {
      const { container } = render(
        <MeetingTabContent
          {...buildProps({ mode: 'morning', hasSummaryInfo: true, total: 1 })}
        />,
        { wrapper: Wrapper },
      );
      expect(container.querySelector('[data-testid="dashboard-briefing-summary-morning"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="dashboard-briefing-guide-morning"]')).toBeInTheDocument();
    });

    it('mode=evening で evening 用の testid が付与される', () => {
      const { container } = render(
        <MeetingTabContent
          {...buildProps({ mode: 'evening', hasSummaryInfo: true, total: 1 })}
        />,
        { wrapper: Wrapper },
      );
      expect(container.querySelector('[data-testid="dashboard-briefing-summary-evening"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="dashboard-briefing-guide-evening"]')).toBeInTheDocument();
    });
  });
});
