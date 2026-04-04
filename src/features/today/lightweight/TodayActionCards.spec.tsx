import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodayActionCards, type TodayActionCardItem } from './TodayActionCards';

describe('TodayActionCards', () => {
  it('業務順に並べ替えたうえで最大4カードまで表示する', () => {
    const cards: TodayActionCardItem[] = [
      { key: 'record', title: '記録入力', count: 2, primaryLabel: '記録を入力する', onPrimaryClick: vi.fn() },
      { key: 'custom', title: 'カスタム', count: 9, primaryLabel: '開く', onPrimaryClick: vi.fn() },
      { key: 'handoff', title: '申し送り', count: 1, primaryLabel: '申し送りを見る', onPrimaryClick: vi.fn() },
      { key: 'meeting', title: '会議記録', count: 1, primaryLabel: '会議記録を開く', onPrimaryClick: vi.fn() },
      { key: 'attendance', title: '出欠確認', count: 4, primaryLabel: '出欠を確認する', onPrimaryClick: vi.fn() },
    ];

    render(<TodayActionCards cards={cards} />);

    const renderedCards = screen.getAllByTestId(/^today-lite-action-card-/);
    expect(renderedCards).toHaveLength(4);
    expect(renderedCards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'today-lite-action-card-attendance',
      'today-lite-action-card-record',
      'today-lite-action-card-handoff',
      'today-lite-action-card-meeting',
    ]);
    expect(screen.queryByTestId('today-lite-action-card-custom')).not.toBeInTheDocument();
  });

  it('各カードに主ボタンを1つだけ表示する', () => {
    const cards: TodayActionCardItem[] = [
      { key: 'attendance', title: '出欠確認', count: 0, primaryLabel: '出欠を確認する', onPrimaryClick: vi.fn() },
      { key: 'record', title: '記録入力', count: 1, primaryLabel: '記録を入力する', onPrimaryClick: vi.fn() },
    ];

    render(<TodayActionCards cards={cards} />);

    const renderedCards = screen.getAllByTestId(/^today-lite-action-card-/);
    renderedCards.forEach((card) => {
      expect(within(card).getAllByRole('button')).toHaveLength(1);
    });
  });
});
