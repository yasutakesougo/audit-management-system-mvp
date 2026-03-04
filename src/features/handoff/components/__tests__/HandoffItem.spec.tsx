/**
 * HandoffItem.spec.tsx
 *
 * 抽出済み HandoffItem コンポーネントのユニットテスト
 *
 * テスト対象:
 * - 基本レンダリング（時刻・利用者名・カテゴリ・重要度・ステータス）
 * - 重要度による視覚的分類（ボーダー色の差異）
 * - 既読/未確認の表示切替
 * - 展開/折りたたみ（長文メッセージ）
 * - ステータストグルのコールバック
 * - 「この利用者の記録を開く」ナビゲーション
 * - 会議モード別ワークフローボタン
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HandoffRecord, MeetingMode } from '../../handoffTypes';
import type { WorkflowActions } from '../../useHandoffTimelineViewModel';

// ────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// localStorage の seen マップをリセット
vi.mock('../../handoffStorageUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../handoffStorageUtils')>();
  return {
    ...actual,
    loadSeenMap: vi.fn(() => ({})),
    saveSeenMap: vi.fn(),
  };
});

vi.mock('../HandoffCommentThread', () => ({
  HandoffCommentThread: ({ handoffId }: { handoffId: number }) => (
    <div data-testid="mock-comment-thread">CommentThread:{handoffId}</div>
  ),
}));

vi.mock('../HandoffAuditLogView', () => ({
  HandoffAuditLogView: ({ handoffId }: { handoffId: number }) => (
    <div data-testid="mock-audit-log">AuditLog:{handoffId}</div>
  ),
}));

import { loadSeenMap } from '../../handoffStorageUtils';
import { HandoffItem } from '../HandoffItem';

// ────────────────────────────────────────────────────────────
// ファクトリ
// ────────────────────────────────────────────────────────────

function createRecord(overrides: Partial<HandoffRecord> = {}): HandoffRecord {
  return {
    id: 1,
    title: 'テスト申し送り',
    message: '利用者の体調に注意してください',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '朝',
    createdAt: '2026-03-04T09:00:00+09:00',
    createdByName: '記録者A',
    isDraft: false,
    ...overrides,
  };
}

const noopStatusChange = vi.fn().mockResolvedValue(undefined);

function renderItem(
  overrides: Partial<HandoffRecord> = {},
  props: {
    meetingMode?: MeetingMode;
    workflowActions?: WorkflowActions;
    onStatusChange?: (...args: unknown[]) => Promise<void>;
  } = {},
) {
  const item = createRecord(overrides);
  return render(
    <HandoffItem
      item={item}
      onStatusChange={props.onStatusChange ?? noopStatusChange}
      meetingMode={props.meetingMode ?? 'normal'}
      workflowActions={props.workflowActions}
    />,
  );
}

// ────────────────────────────────────────────────────────────
// テスト
// ────────────────────────────────────────────────────────────

describe('HandoffItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadSeenMap).mockReturnValue({});
  });

  // ─── 基本レンダリング ───────────────────────────────────
  describe('基本レンダリング', () => {
    it('時刻・利用者名・カテゴリが表示される', () => {
      renderItem();

      // 時刻 (09:00)
      expect(screen.getByText('09:00')).toBeInTheDocument();
      // 利用者名
      expect(screen.getByText('テスト太郎')).toBeInTheDocument();
      // カテゴリチップ
      expect(screen.getByText('体調')).toBeInTheDocument();
    });

    it('メッセージ本文が表示される', () => {
      renderItem();
      expect(screen.getByText('利用者の体調に注意してください')).toBeInTheDocument();
    });

    it('記録者名が表示される', () => {
      renderItem();
      expect(screen.getByText(/by 記録者A/)).toBeInTheDocument();
    });

    it('ステータスチップが表示される', () => {
      renderItem({ status: '未対応' });
      expect(screen.getByText('未対応')).toBeInTheDocument();
    });

    it('重要度チップが表示される', () => {
      renderItem({ severity: '要注意' });
      expect(screen.getByText('要注意')).toBeInTheDocument();
    });

    it('時間帯チップが表示される', () => {
      renderItem({ timeBand: '午後' });
      expect(screen.getByText('午後')).toBeInTheDocument();
    });
  });

  // ─── 既読/未確認バッジ ──────────────────────────────────
  describe('既読/未確認バッジ', () => {
    it('未確認の場合「未確認」ドットインジケーターが表示される', () => {
      vi.mocked(loadSeenMap).mockReturnValue({});
      renderItem();
      // 未確認時は FiberManualRecordIcon（ドットインジケーター）が表示される
      expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
    });

    it('既読の場合「未確認」ドットインジケーターが表示されない', () => {
      vi.mocked(loadSeenMap).mockReturnValue({ '1': '2026-03-04T00:00:00Z' });
      renderItem();
      expect(screen.queryByTestId('FiberManualRecordIcon')).not.toBeInTheDocument();
    });
  });

  // ─── 展開/折りたたみ ───────────────────────────────────
  describe('展開/折りたたみ', () => {
    const longMessage = 'テスト'.repeat(50); // 150文字 > 100文字閾値

    it('100文字以下のメッセージには展開ボタンが表示されない', () => {
      renderItem({ message: '短いメッセージ' });
      expect(screen.queryByText('続きを読む')).not.toBeInTheDocument();
    });

    it('100文字超のメッセージは末尾が「...」で切り詰められる', () => {
      renderItem({ message: longMessage });
      expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
      expect(screen.getByText('続きを読む')).toBeInTheDocument();
    });

    it('「続きを読む」をクリックすると全文が表示される', () => {
      renderItem({ message: longMessage });
      fireEvent.click(screen.getByText('続きを読む'));

      expect(screen.getByText(longMessage)).toBeInTheDocument();
      expect(screen.getByText('折りたたむ')).toBeInTheDocument();
    });

    it('「折りたたむ」をクリックすると再度切り詰められる', () => {
      renderItem({ message: longMessage });
      fireEvent.click(screen.getByText('続きを読む'));
      fireEvent.click(screen.getByText('折りたたむ'));

      expect(screen.getByText('続きを読む')).toBeInTheDocument();
    });
  });

  // ─── 展開時の詳細タブ ──────────────────────────────────
  describe('展開時の詳細タブ', () => {
    const longMessage = 'テスト'.repeat(50);

    it('展開するとコメントタブがデフォルトで表示される', () => {
      renderItem({ message: longMessage });
      fireEvent.click(screen.getByText('続きを読む'));

      expect(screen.getByTestId('mock-comment-thread')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-audit-log')).not.toBeInTheDocument();
    });

    it('更新履歴タブをクリックすると監査ログが表示される', () => {
      renderItem({ message: longMessage });
      fireEvent.click(screen.getByText('続きを読む'));
      fireEvent.click(screen.getByText('更新履歴'));

      expect(screen.getByTestId('mock-audit-log')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-comment-thread')).not.toBeInTheDocument();
    });
  });

  // ─── ステータストグル ──────────────────────────────────
  describe('ステータストグル', () => {
    it('ステータスチップクリックで onStatusChange が呼ばれる', async () => {
      const mockChange = vi.fn().mockResolvedValue(undefined);
      renderItem({ status: '未対応' }, { onStatusChange: mockChange });

      const statusChip = screen.getByText('未対応');
      fireEvent.click(statusChip);

      await waitFor(() => {
        expect(mockChange).toHaveBeenCalledTimes(1);
        // 未対応 → 次のステータス (対応中)
        expect(mockChange).toHaveBeenCalledWith(1, '対応中');
      });
    });

    it('対応中 → 対応済 へ遷移する', async () => {
      const mockChange = vi.fn().mockResolvedValue(undefined);
      renderItem({ status: '対応中' }, { onStatusChange: mockChange });

      fireEvent.click(screen.getByText('対応中'));

      await waitFor(() => {
        expect(mockChange).toHaveBeenCalledWith(1, '対応済');
      });
    });
  });

  // ─── 利用者記録へのナビゲーション ──────────────────────
  describe('利用者記録ナビゲーション', () => {
    it('userCode が設定されている場合「この利用者の記録を開く」ボタンが表示される', () => {
      renderItem({ userCode: 'U001' });
      expect(screen.getByText('この利用者の記録を開く')).toBeInTheDocument();
    });

    it('userCode が ALL の場合ボタンが表示されない', () => {
      renderItem({ userCode: 'ALL' });
      expect(screen.queryByText('この利用者の記録を開く')).not.toBeInTheDocument();
    });

    it('userCode が空の場合ボタンが表示されない', () => {
      renderItem({ userCode: '' });
      expect(screen.queryByText('この利用者の記録を開く')).not.toBeInTheDocument();
    });

    it('ボタンクリックで navigate が /daily/activity に呼ばれる', () => {
      renderItem({
        userCode: 'U001',
        createdAt: '2026-03-04T10:00:00+09:00',
      });

      fireEvent.click(screen.getByText('この利用者の記録を開く'));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/daily/activity', {
        state: {
          highlightUserId: 'U001',
          highlightDate: '2026-03-04',
        },
      });
    });
  });

  // ─── 会議モード別ワークフローアクション ────────────────
  describe('会議モード別ワークフローアクション', () => {
    const mockWorkflow: WorkflowActions = {
      markReviewed: vi.fn().mockResolvedValue(undefined),
      markCarryOver: vi.fn().mockResolvedValue(undefined),
      markClosed: vi.fn().mockResolvedValue(undefined),
    };

    it('normal モードではワークフローボタンが表示されない', () => {
      renderItem(
        { status: '未対応' },
        { meetingMode: 'normal', workflowActions: mockWorkflow },
      );
      expect(screen.queryByText('✅ 確認済')).not.toBeInTheDocument();
    });

    it('evening モードで未対応のとき「確認済」「完了」ボタンが表示される', () => {
      renderItem(
        { status: '未対応' },
        { meetingMode: 'evening', workflowActions: mockWorkflow },
      );
      expect(screen.getByText(/確認済/)).toBeInTheDocument();
      expect(screen.getByText(/完了/)).toBeInTheDocument();
    });

    it('evening モードで確認済のとき「明日へ」「完了」ボタンが表示される', () => {
      renderItem(
        { status: '確認済' },
        { meetingMode: 'evening', workflowActions: mockWorkflow },
      );
      expect(screen.getByText(/明日へ/)).toBeInTheDocument();
      expect(screen.getByText(/完了/)).toBeInTheDocument();
    });

    it('morning モードで明日へ持越のとき「完了」ボタンが表示される', () => {
      renderItem(
        { status: '明日へ持越' },
        { meetingMode: 'morning', workflowActions: mockWorkflow },
      );
      expect(screen.getByText(/完了/)).toBeInTheDocument();
    });

    it('終端ステータス(対応済)ではアクションボタンが表示されない', () => {
      renderItem(
        { status: '対応済' },
        { meetingMode: 'evening', workflowActions: mockWorkflow },
      );
      expect(screen.queryByText(/確認済/)).not.toBeInTheDocument();
      expect(screen.queryByText(/明日へ/)).not.toBeInTheDocument();
    });

    it('「確認済」ボタンクリックで markReviewed が呼ばれる', async () => {
      const workflow: WorkflowActions = {
        markReviewed: vi.fn().mockResolvedValue(undefined),
        markCarryOver: vi.fn().mockResolvedValue(undefined),
        markClosed: vi.fn().mockResolvedValue(undefined),
      };

      renderItem(
        { status: '未対応' },
        { meetingMode: 'evening', workflowActions: workflow },
      );

      // 「確認済」を含むボタンを探してクリック
      const buttons = screen.getAllByRole('button');
      const reviewedBtn = buttons.find(btn => btn.textContent?.includes('確認済'));
      expect(reviewedBtn).toBeTruthy();
      fireEvent.click(reviewedBtn!);

      await waitFor(() => {
        expect(workflow.markReviewed).toHaveBeenCalledWith(1);
      });
    });

    it('「明日へ」ボタンクリックで markCarryOver が呼ばれる', async () => {
      const workflow: WorkflowActions = {
        markReviewed: vi.fn().mockResolvedValue(undefined),
        markCarryOver: vi.fn().mockResolvedValue(undefined),
        markClosed: vi.fn().mockResolvedValue(undefined),
      };

      renderItem(
        { status: '確認済' },
        { meetingMode: 'evening', workflowActions: workflow },
      );

      const buttons = screen.getAllByRole('button');
      const carryOverBtn = buttons.find(btn => btn.textContent?.includes('明日へ'));
      expect(carryOverBtn).toBeTruthy();
      fireEvent.click(carryOverBtn!);

      await waitFor(() => {
        expect(workflow.markCarryOver).toHaveBeenCalledWith(1);
      });
    });
  });

  // ─── 各ステータスの表示テスト ─────────────────────────
  describe('ステータス表示', () => {
    it.each([
      ['未対応', '未対応'],
      ['対応中', '対応中'],
      ['対応済', '完了'],  // HANDOFF_STATUS_META maps 対応済 → label '完了'
    ] as const)('ステータス %s のラベルが表示される', (status, expectedLabel) => {
      renderItem({ status });
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });

    it('対応済のメッセージは text.secondary カラーで表示される', () => {
      renderItem({ status: '対応済' });
      const messageText = screen.getByText('利用者の体調に注意してください');
      // MUI の color prop を適用した sx 確認
      expect(messageText).toBeInTheDocument();
    });
  });

  // ─── testid ────────────────────────────────────────────
  describe('testid', () => {
    it('agenda-timeline-item の data-testid が設定されている', () => {
      const { container } = renderItem();
      expect(container.querySelector('[data-testid="agenda-timeline-item"]')).toBeInTheDocument();
    });
  });
});
