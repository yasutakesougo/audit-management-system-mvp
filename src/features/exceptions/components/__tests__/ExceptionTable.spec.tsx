import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ExceptionItem } from '../../domain/exceptionLogic';
import { ExceptionTable } from '../ExceptionTable';

const makeException = (overrides: Partial<ExceptionItem> = {}): ExceptionItem => ({
  id: 'ae-1',
  category: 'corrective-action',
  severity: 'high',
  title: '提案A',
  description: 'evidence A',
  targetUser: '山田 花子',
  targetUserId: 'U-001',
  targetDate: '2026-03-20',
  updatedAt: '2026-03-20T09:00:00.000Z',
  actionLabel: '改善アクションを実行',
  actionPath: '/users/U-001',
  stableId: 'stable-1',
  ...overrides,
});

const renderTable = (
  items: ExceptionItem[],
  suggestionActions?: {
    onDismiss: (stableId: string) => void;
    onSnooze: (stableId: string, preset: 'tomorrow' | 'three-days' | 'end-of-week') => void;
    onCtaClick?: (
      stableId: string,
      targetUrl: string,
      ctaSurface?: 'table' | 'priority-top3',
    ) => void;
    onPriorityTopShown?: (stableIds: string[]) => void;
  },
) => {
  render(
    <MemoryRouter>
      <ExceptionTable items={items} suggestionActions={suggestionActions} />
    </MemoryRouter>,
  );
};

describe('ExceptionTable', () => {
  it('デフォルトはフラット表示で、グループボタンを押すことですべての例外を利用者単位で集約できる', () => {
    const items: ExceptionItem[] = [
      makeException({ id: 'ae-1', stableId: 'stable-1', title: '提案A', description: 'evidence A', severity: 'high' }),
      makeException({ id: 'ae-2', stableId: 'stable-2', title: '提案B', description: 'evidence B', severity: 'medium' }),
      makeException({ id: 'ae-3', stableId: 'stable-3', title: '提案C', targetUser: '佐藤 次郎', targetUserId: 'U-002' }),
      makeException({
        id: 'missing-1',
        category: 'missing-record',
        severity: 'high',
        title: '記録未入力',
        description: '日次記録が未入力です',
        targetUser: '高橋 三郎',
        targetUserId: 'U-003',
        actionLabel: '記録を作成',
        actionPath: '/daily/activity?userId=U-003',
        stableId: undefined,
      }),
    ];

    renderTable(items);

    // デフォルトはフラット表示なので全アイテムがそのまま出ている
    expect(screen.getByText('提案A')).toBeInTheDocument();
    expect(screen.getByText('提案B')).toBeInTheDocument();
    expect(screen.getByText('提案C')).toBeInTheDocument();
    expect(screen.getByText('記録未入力')).toBeInTheDocument();

    // グループ表示へ切り替え
    fireEvent.click(screen.getByTestId('exception-mode-grouped'));

    // U-001とその他のグループ行が表示される (タイトルは出ないでグループ名が出る)
    expect(screen.getByText('山田 花子 の例外 (2件)')).toBeInTheDocument();
    expect(screen.getByText('高橋 三郎 の例外 (1件)')).toBeInTheDocument();


    const toggle = screen.getByTestId('exception-group-toggle-U-001');
    expect(screen.queryByTestId('exception-group-details-U-001')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    const details = screen.getByTestId('exception-group-details-U-001');
    expect(within(details).getByText('提案A')).toBeInTheDocument();
    expect(within(details).getByText('提案B')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByTestId('exception-group-details-U-001')).not.toBeInTheDocument();
  });

  it('集約行の代表提案は highest priority を使う', () => {
    const items: ExceptionItem[] = [
      makeException({ id: 'ae-medium', stableId: 'stable-medium', severity: 'medium', title: '観察提案', description: 'medium evidence' }),
      makeException({ id: 'ae-critical', stableId: 'stable-critical', severity: 'critical', title: '即対応提案', description: 'critical evidence' }),
    ];

    renderTable(items);
    fireEvent.click(screen.getByTestId('exception-mode-grouped'));

    // representative が critical なのでデータ行のIDがそれになる
    expect(screen.getByTestId('exception-row-ae-critical')).toBeInTheDocument();
    expect(screen.getByText('山田 花子 の例外 (2件)')).toBeInTheDocument();
    expect(screen.getByText(/critical evidence/)).toBeInTheDocument();
  });

  it('default ソートでは Top3 サマリーは表示しない', () => {
    renderTable([
      makeException({ id: 'a-1', title: '提案A' }),
      makeException({ id: 'a-2', title: '提案B' }),
    ]);

    expect(screen.queryByTestId('exception-priority-top3')).not.toBeInTheDocument();
  });

  it('initialSortMode=priority のときは初期表示で Top3 サマリーを表示する', () => {
    render(
      <MemoryRouter>
        <ExceptionTable
          items={[
            makeException({ id: 'a-1', title: '提案A', severity: 'critical' }),
            makeException({ id: 'a-2', title: '提案B', severity: 'high' }),
          ]}
          initialSortMode="priority"
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('exception-priority-top3')).toBeInTheDocument();
  });

  it('priority モードでは親子構造を維持したまま高優先グループが先頭に来る', async () => {
    const items: ExceptionItem[] = [
      makeException({
        id: 'parent-normal',
        category: 'missing-record',
        severity: 'critical',
        title: '通常の緊急例外',
        description: '通常の重要例外',
      }),
      makeException({
        id: 'child-normal',
        category: 'missing-record',
        severity: 'medium',
        parentId: 'parent-normal',
        title: '通常の個別例外',
      }),
      makeException({
        id: 'parent-sync',
        category: 'transport-alert',
        severity: 'low',
        title: '送迎の個別同期障害',
        description: '同期失敗ユーザー 5件',
      }),
      makeException({
        id: 'child-sync',
        category: 'transport-alert',
        severity: 'critical',
        parentId: 'parent-sync',
        title: '送迎実績の同期に失敗があります',
        description: '移動中のまま 90 分停滞',
      }),
    ];

    renderTable(items);

    const sortMode = screen.getByTestId('exception-sort-mode');
    fireEvent.mouseDown(within(sortMode).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: '優先度順' }));

    expect(screen.getByTestId('exception-priority-top3')).toBeInTheDocument();
    expect(screen.getByTestId('exception-priority-top3-item-1')).toHaveTextContent('送迎の個別同期障害');
    expect(screen.getByTestId('exception-priority-top3-item-2')).toHaveTextContent('通常の緊急例外');

    const rowOrder = Array.from(
      document.querySelectorAll('tr[data-testid^="exception-row-"]'),
    ).map((el) => el.getAttribute('data-testid'));

    expect(rowOrder.slice(0, 3)).toEqual([
      'exception-row-parent-sync',
      'exception-row-child-sync',
      'exception-row-parent-normal',
    ]);
  });

  it('priority Top3 の shown/click は suggestionActions に surface 付きで通知する', async () => {
    const onDismiss = vi.fn();
    const onSnooze = vi.fn();
    const onCtaClick = vi.fn();
    const onPriorityTopShown = vi.fn();

    const items: ExceptionItem[] = [
      makeException({
        id: 'p1',
        stableId: 'stable-p1',
        severity: 'critical',
        title: '最優先提案',
        actionPath: '/assessment?u=1',
      }),
      makeException({
        id: 'p2',
        stableId: 'stable-p2',
        severity: 'high',
        title: '次点提案',
        actionPath: '/assessment?u=2',
      }),
      makeException({
        id: 'p3',
        stableId: 'stable-p3',
        severity: 'medium',
        title: '3番目提案',
        actionPath: '/assessment?u=3',
      }),
    ];

    renderTable(items, {
      onDismiss,
      onSnooze,
      onCtaClick,
      onPriorityTopShown,
    });

    const sortMode = screen.getByTestId('exception-sort-mode');
    fireEvent.mouseDown(within(sortMode).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: '優先度順' }));

    expect(onPriorityTopShown).toHaveBeenCalled();
    const shownStableIds = onPriorityTopShown.mock.calls.flatMap((args) => args[0] as string[]);
    expect(shownStableIds).toEqual(expect.arrayContaining(['stable-p1', 'stable-p2', 'stable-p3']));

    fireEvent.click(screen.getByTestId('exception-priority-top3-action-p1'));
    expect(onCtaClick).toHaveBeenCalledWith(
      'stable-p1',
      '/assessment?u=1',
      'priority-top3',
    );
  });

  it('フラット表示から dismiss/snooze が実行できる', async () => {
    const onDismiss = vi.fn();
    const onSnooze = vi.fn();
    const items: ExceptionItem[] = [
      makeException({ id: 'ae-1', stableId: 'stable-1', severity: 'high', title: '提案A' }),
    ];

    renderTable(items, { onDismiss, onSnooze });

    fireEvent.click(screen.getByTestId('suggestion-menu-button-ae-1'));
    fireEvent.click(await screen.findByText('対応済みにする'));
    expect(onDismiss).toHaveBeenCalledWith('stable-1');
  });

  it('グループ表示から dismiss/snooze が実行できる', async () => {
    const onDismiss = vi.fn();
    const onSnooze = vi.fn();
    const items: ExceptionItem[] = [
      makeException({ id: 'ae-1', stableId: 'stable-1', severity: 'high', title: '提案A' }),
      makeException({ id: 'ae-2', stableId: 'stable-2', severity: 'medium', title: '提案B' }),
    ];

    renderTable(items, { onDismiss, onSnooze });

    fireEvent.click(screen.getByTestId('exception-mode-grouped'));

    // U-001 グループを展開
    fireEvent.click(screen.getByTestId('exception-group-toggle-U-001'));

    // 展開内（子項目）の ae-2 のメニューを開いてスヌーズ
    fireEvent.click(screen.getByTestId('suggestion-menu-button-ae-2'));
    fireEvent.click(await screen.findByText('明日まで'));
    expect(onSnooze).toHaveBeenCalledWith('stable-2', 'tomorrow');
  });
});
