import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SchedulesSpLane, type SpLaneModel } from '../SchedulesSpLane';

const renderLane = (model: SpLaneModel) => {
  render(<SchedulesSpLane model={model} />);
  return screen.getByTestId('schedules-sp-lane');
};

describe('SchedulesSpLane', () => {
  it('renders a constant frame (always present) with disabled state', () => {
    const node = renderLane({
      version: 1,
      state: 'disabled',
      title: 'SharePoint 外部連携',
      reason: '機能フラグがオフです',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'disabled');
    expect(node).not.toHaveAttribute('data-busy');

    // Key copy
    expect(screen.getByText('SharePoint 外部連携')).toBeInTheDocument();
    expect(screen.getByText('連携オフ')).toBeInTheDocument();
    expect(screen.getByText('機能フラグがオフです')).toBeInTheDocument();

    // No interactive elements in disabled state
    expect(screen.queryByRole('button', { name: /今すぐ同期/i })).not.toBeInTheDocument();
  });

  it('renders idle state with loading message', () => {
    const node = renderLane({
      version: 1,
      state: 'idle',
      title: 'SharePoint 外部連携',
      subtitle: '接続待機中...',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'idle');

    expect(screen.getByText('SharePoint 外部連携')).toBeInTheDocument();
    expect(screen.getByText('接続待機中...')).toBeInTheDocument();
  });

  it('renders active state with sync info (count)', () => {
    const node = renderLane({
      version: 1,
      state: 'active',
      title: 'SharePoint 外部連携',
      lastSyncAt: '2024-01-01T09:00:00Z',
      itemCount: 3,
      subtitle: 'テスト用サブタイトル',
      source: 'sp',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'active');
    expect(node).toHaveAttribute('data-source', 'sp');

    expect(screen.getByText('最新同期済み')).toBeInTheDocument();
    expect(screen.getByText('SP連携スケジュール')).toBeInTheDocument();
    expect(screen.getByText('3 件の項目を同期中')).toBeInTheDocument();
    expect(screen.getByText('テスト用サブタイトル')).toBeInTheDocument();
  });

  it('active state shows empty fallback when itemCount is undefined', () => {
    render(<SchedulesSpLane model={{ version: 1, state: 'active', title: 'SharePoint 外部連携' }} />);

    const node = screen.getByTestId('schedules-sp-lane');
    expect(node).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('表示する項目はありません')).toBeInTheDocument();
  });

  it('renders error state with error message', () => {
    const node = renderLane({
      version: 1,
      state: 'error',
      title: 'SharePoint 外部連携',
      reason: '認証エラーが発生しました',
      canRetry: true,
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'error');

    expect(screen.getByText('同期エラー')).toBeInTheDocument();
    expect(screen.getByText('認証エラーが発生しました')).toBeInTheDocument();

    // Retry button should be present in error state
    expect(screen.getByRole('button', { name: /今すぐ同期/i })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    renderLane({
      version: 1,
      state: 'error',
      title: 'SP Lane',
      canRetry: true,
      onRetry,
    });

    const button = screen.getByRole('button', { name: /今すぐ同期/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('disables retry button and shows busy state', () => {
    const node = renderLane({
      version: 1,
      state: 'idle',
      title: 'SP Lane',
      canRetry: true,
      busy: true,
    });

    expect(node).toHaveAttribute('data-busy', '1');
    const button = screen.getByRole('button', { name: /同期中/i });
    expect(button).toBeDisabled();
  });

  it('opens details dialog when info button is clicked', async () => {
    renderLane({
      version: 1,
      state: 'active',
      title: 'SP Lane',
      canRetry: true,
      details: {
        state: 'active',
        source: 'sp',
        itemCount: 5,
      },
    });

    const infoButton = screen.getByRole('button', { name: /同期ステータス詳細を表示/i });
    fireEvent.click(infoButton);

    expect(await screen.findByText('同期ステータス詳細')).toBeInTheDocument();
    expect(await screen.findByText('ACTIVE')).toBeInTheDocument();
    expect(await screen.findByText('sp')).toBeInTheDocument();
    expect(await screen.findByText('5 件')).toBeInTheDocument();
  });

  it('exposes contract version for drift detection', () => {
    const node = renderLane({
      version: 99,
      state: 'idle',
      title: 'Drift Test',
    });
    expect(node).toHaveAttribute('data-version', '99');
  });
});
