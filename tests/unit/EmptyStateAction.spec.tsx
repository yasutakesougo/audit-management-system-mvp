/**
 * EmptyStateAction — Unit Tests
 *
 * @see src/components/ui/EmptyStateAction.tsx
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyStateAction } from '../../src/components/ui/EmptyStateAction';

describe('EmptyStateAction', () => {
  // ─── Rendering ─────────────────────────────────────────────

  it('renders title and description', () => {
    render(
      <EmptyStateAction
        title="データがありません"
        description="新しいデータを追加してください"
      />,
    );
    expect(screen.getByText('データがありません')).toBeInTheDocument();
    expect(screen.getByText('新しいデータを追加してください')).toBeInTheDocument();
  });

  it('renders with default info variant when no variant specified', () => {
    render(<EmptyStateAction title="テスト" />);
    const container = screen.getByTestId('empty-state-action');
    expect(container).toBeInTheDocument();
    // Default icon for info variant is 📋
    expect(screen.getByRole('img', { name: 'テスト' })).toHaveTextContent('📋');
  });

  // ─── Variants ──────────────────────────────────────────────

  it('renders success variant with default icon', () => {
    render(<EmptyStateAction title="完了" variant="success" />);
    expect(screen.getByRole('img', { name: '完了' })).toHaveTextContent('🎉');
  });

  it('renders warning variant with default icon', () => {
    render(<EmptyStateAction title="注意" variant="warning" />);
    expect(screen.getByRole('img', { name: '注意' })).toHaveTextContent('⚠️');
  });

  it('uses custom icon when provided', () => {
    render(<EmptyStateAction title="カスタム" icon="🚀" />);
    expect(screen.getByRole('img', { name: 'カスタム' })).toHaveTextContent('🚀');
  });

  // ─── Action Button ────────────────────────────────────────

  it('renders action button when actionLabel and onAction are provided', () => {
    const handleAction = vi.fn();
    render(
      <EmptyStateAction
        title="空の状態"
        actionLabel="追加する"
        onAction={handleAction}
      />,
    );
    const button = screen.getByRole('button', { name: '追加する' });
    expect(button).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', () => {
    const handleAction = vi.fn();
    render(
      <EmptyStateAction
        title="空の状態"
        actionLabel="記録を開始"
        onAction={handleAction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '記録を開始' }));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel is missing', () => {
    const handleAction = vi.fn();
    render(
      <EmptyStateAction
        title="空の状態"
        onAction={handleAction}
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when onAction is missing', () => {
    render(
      <EmptyStateAction
        title="空の状態"
        actionLabel="ボタン"
      />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // ─── Optional Props ───────────────────────────────────────

  it('renders without description', () => {
    render(<EmptyStateAction title="タイトルのみ" />);
    expect(screen.getByText('タイトルのみ')).toBeInTheDocument();
  });

  it('respects custom testId', () => {
    render(<EmptyStateAction title="テスト" testId="custom-empty" />);
    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });
});
