import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HandoffQuickNoteCard } from '../../HandoffQuickNoteCard';

const mockCreateHandoff = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/users/hooks/useUsersQuery', () => ({
  useUsersQuery: () => ({
    data: [
      {
        UserID: 1,
        FullName: '佐藤 太郎',
      },
    ],
  }),
}));

vi.mock('../../useCurrentTimeBand', () => ({
  useCurrentTimeBand: () => '朝',
  getTimeBandPlaceholder: () => '例）朝の来所時の様子や、前日から気になっていることなど',
}));

vi.mock('../../useHandoffTimeline', () => ({
  useHandoffTimeline: () => ({
    createHandoff: mockCreateHandoff,
    allHandoffs: [
      {
        id: 11,
        title: 'テストタイトル',
        userCode: 'U001',
        userDisplayName: '佐藤 太郎',
        category: '体調',
        severity: '通常',
        status: '未対応',
        timeBand: '朝',
        message: 'バイタル確認のサイン。前日より食事摂取が少なめです。',
        createdAt: '2026-06-16T08:15:00+09:00',
        createdByName: '記録者A',
        isDraft: false,
      },
    ],
    loading: false,
    error: null,
  }),
}));

describe('HandoffQuickNoteCard', () => {
  beforeEach(() => {
    mockCreateHandoff.mockClear();
  });

  it('基本文言と主要導線が表示される', () => {
    render(<HandoffQuickNoteCard />);

    expect(screen.getByText('📝 今すぐ申し送り')).toBeInTheDocument();
    expect(screen.getByText('気になったこと・良かったこと・明日につなげたいことを、短くメモしてください')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '対象' })).toBeInTheDocument();
    expect(screen.getByText('カテゴリ')).toBeInTheDocument();
    expect(screen.getByText('重要度')).toBeInTheDocument();
    expect(screen.getByText('最近の申し送り')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '詳細を見る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この内容で登録' })).toBeDisabled();
    expect(screen.getByLabelText('申し送り内容')).toBeInTheDocument();
    expect(screen.getByText('佐藤 太郎')).toBeInTheDocument();
    expect(screen.getByText('バイタル確認のサイン。前日より食事摂取が少なめです。')).toBeInTheDocument();
  });

  it('本文を入力した後に quick note の作成フローが起動する', async () => {
    render(<HandoffQuickNoteCard />);

    const textarea = screen.getByLabelText('申し送り内容');
    fireEvent.change(textarea, { target: { value: '夜間に起きがちだった件を共有' } });

    expect(screen.getByRole('button', { name: 'この内容で登録' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'この内容で登録' }));

    await waitFor(() => {
      expect(mockCreateHandoff).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        userCode: 'ALL',
        userDisplayName: '全体',
        category: '体調',
        severity: '通常',
        timeBand: '朝',
        message: '夜間に起きがちだった件を共有',
        title: '全体 / 体調',
      }),
    );
  });
});
