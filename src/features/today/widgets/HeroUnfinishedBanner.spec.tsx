import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeroUnfinishedBanner } from './HeroUnfinishedBanner';

describe('HeroUnfinishedBanner', () => {
  it('renders complete state when counts are 0', () => {
    render(
      <HeroUnfinishedBanner
        unfilledCount={0}
        approvalPendingCount={0}
        onClickPrimary={() => {}}
      />
    );

    // ✅ 本日完了 のテキストが表示されること
    expect(screen.getByText(/本日完了/)).toBeInTheDocument();

    // 今すぐ入力 ボタンが表示されないこと
    expect(screen.queryByRole('button', { name: /今すぐ入力/ })).not.toBeInTheDocument();
  });

  it('renders unfilled state warning with 0 approvals', () => {
    render(
      <HeroUnfinishedBanner
        unfilledCount={3}
        onClickPrimary={() => {}}
      />
    );

    // 未記録件数が表示されること
    expect(screen.getByText(/未記録 3件/)).toBeInTheDocument();
    // 承認待ちのテキストは出ないこと
    expect(screen.queryByText(/承認待ち/)).not.toBeInTheDocument();

    // ボタンが表示されていること
    expect(screen.getByRole('button', { name: /今すぐ入力/ })).toBeInTheDocument();
  });

  it('renders unfilled state warning with approvals', () => {
    render(
      <HeroUnfinishedBanner
        unfilledCount={2}
        approvalPendingCount={1}
        onClickPrimary={() => {}}
      />
    );

    // 未記録件数と承認待ちが両方表示されること
    expect(screen.getByText(/未記録 2件/)).toBeInTheDocument();
    expect(screen.getByText(/承認待ち 1件/)).toBeInTheDocument();
  });

  it('calls onClickPrimary when the action button is clicked', () => {
    const handleClick = vi.fn();
    render(
      <HeroUnfinishedBanner
        unfilledCount={1}
        onClickPrimary={handleClick}
      />
    );

    const button = screen.getByRole('button', { name: /今すぐ入力/ });
    fireEvent.click(button);

    // 関数が正しく呼び出されたか
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary button when onClickSecondary is provided', () => {
    const handleSecondary = vi.fn();
    render(
      <HeroUnfinishedBanner
        unfilledCount={2}
        onClickPrimary={() => {}}
        onClickSecondary={handleSecondary}
      />
    );

    const menuBtn = screen.getByRole('button', { name: /記録メニュー/ });
    expect(menuBtn).toBeInTheDocument();

    fireEvent.click(menuBtn);
    expect(handleSecondary).toHaveBeenCalledTimes(1);
  });

  it('does not render secondary button when onClickSecondary is omitted (backward compat)', () => {
    render(
      <HeroUnfinishedBanner
        unfilledCount={2}
        onClickPrimary={() => {}}
      />
    );

    expect(screen.queryByRole('button', { name: /記録メニュー/ })).not.toBeInTheDocument();
  });
});
