import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SchedulesSpLane, type SpLaneModel } from '../SchedulesSpLane';

const renderLane = (model: SpLaneModel) => {
  render(<SchedulesSpLane model={model} />);
  return screen.getByTestId('schedules-sp-lane');
};

describe('SchedulesSpLane', () => {
  it('renders a constant frame (always present) with disabled state', () => {
    const node = renderLane({
      state: 'disabled',
      title: 'SharePoint 外部連携',
      reason: '機能フラグがオフです',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'disabled');

    // Key copy
    expect(screen.getByText('SharePoint 外部連携')).toBeInTheDocument();
    expect(screen.getByText('連携オフ')).toBeInTheDocument();
    expect(screen.getByText('機能フラグがオフです')).toBeInTheDocument();
  });

  it('renders idle state with loading message', () => {
    const node = renderLane({
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
      state: 'active',
      title: 'SharePoint 外部連携',
      lastSyncAt: '2024-01-01T09:00:00Z',
      itemCount: 3,
      subtitle: 'テスト用サブタイトル',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'active');

    expect(screen.getByText('同期済み')).toBeInTheDocument();
    expect(screen.getByText('SP連携スケジュール')).toBeInTheDocument();
    expect(screen.getByText('3 件の項目を同期中')).toBeInTheDocument();
    expect(screen.getByText('テスト用サブタイトル')).toBeInTheDocument();
  });

  it('active state shows empty fallback when itemCount is undefined', () => {
    render(<SchedulesSpLane model={{ state: 'active', title: 'SharePoint 外部連携' }} />);

    const node = screen.getByTestId('schedules-sp-lane');
    expect(node).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('表示する項目はありません')).toBeInTheDocument();
  });

  it('renders error state with error message', () => {
    const node = renderLane({
      state: 'error',
      title: 'SharePoint 外部連携',
      reason: '認証エラーが発生しました',
    });

    expect(node).toBeInTheDocument();
    expect(node).toHaveAttribute('data-state', 'error');

    expect(screen.getByText('同期エラー')).toBeInTheDocument();
    expect(screen.getByText('認証エラーが発生しました')).toBeInTheDocument();
  });
});
