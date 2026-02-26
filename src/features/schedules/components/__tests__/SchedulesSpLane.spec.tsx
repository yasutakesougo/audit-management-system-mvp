import type { SpLaneModel } from '@/features/dashboard/types/hub';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SchedulesSpLane } from '../SchedulesSpLane';

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

    expect(screen.getByText('SharePoint 同期')).toBeInTheDocument();
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

  it('renders error state with error classification', async () => {
    const node = renderLane({
      version: 1,
      state: 'error',
      title: 'SharePoint 外部連携',
      reason: '認証エラーが発生しました',
      canRetry: true,
      details: {
        state: 'error',
        errorKind: 'auth',
        hint: 'ログインし直してください',
      },
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'error');
    expect(node).toHaveAttribute('data-error-kind', 'auth');

    expect(screen.getByText('同期エラー')).toBeInTheDocument();
    expect(screen.getByText('認証エラーが発生しました')).toBeInTheDocument();

    // Verify hint in dialog
    const infoButton = screen.getByRole('button', { name: /同期ステータス詳細を表示/i });
    fireEvent.click(infoButton);

    expect(await screen.findByText('同期ステータス詳細')).toBeInTheDocument();
    expect(await screen.findByText('AUTH')).toBeInTheDocument();
    expect(await screen.findByText('ログインし直してください')).toBeInTheDocument();
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
      canRetry: false,
      busy: true,
      onRetry: vi.fn(),
    });

    expect(node).toHaveAttribute('data-busy', '1');
    const button = screen.getByRole('button', { name: '同期中' });
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
    expect(await screen.findByText('SharePoint 同期')).toBeInTheDocument();
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

  it('respects cooldownUntil by disabling retry button', () => {
    const now = 10000;
    vi.setSystemTime(now);

    const node = renderLane({
      version: 1,
      state: 'error',
      title: 'SP Lane',
      canRetry: false, // buildSpLaneModel would set this to false if cooldown is active
      cooldownUntil: now + 5000,
      onRetry: vi.fn(),
    });

    expect(node).toHaveAttribute('data-can-retry', '0');
    expect(node).toHaveAttribute('data-cooldown-until', '15000');

    const button = screen.getByRole('button', { name: '今すぐ同期' });
    expect(button).toBeDisabled();
    expect(screen.getByText('待機中...')).toBeInTheDocument();
  });
});
