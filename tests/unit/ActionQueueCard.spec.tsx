/**
 * ActionQueueCard — Unit Tests
 *
 * Tests cover:
 *  - Pure logic: buildQueueCategories, isAllDone
 *  - Component rendering: categories, counts, navigation, empty state
 *
 * @see src/features/today/widgets/ActionQueueCard.tsx
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActionQueueCard,
  buildQueueCategories,
  isAllDone,
} from '../../src/features/today/widgets/ActionQueueCard';
import type { TodayTask } from '../../src/domain/todayEngine';

// ─── Test Helpers ────────────────────────────────────────────

function createTask(overrides: Partial<TodayTask> = {}): TodayTask {
  return {
    id: 'test-1',
    userId: 'u1',
    label: 'テストタスク',
    source: 'unrecorded',
    priority: 100,
    actionType: 'quickRecord',
    completed: false,
    ...overrides,
  };
}

// ─── Pure Logic Tests ────────────────────────────────────────

describe('buildQueueCategories', () => {
  it('counts unrecorded tasks correctly', () => {
    const tasks = [
      createTask({ id: 't1', source: 'unrecorded' }),
      createTask({ id: 't2', source: 'unrecorded' }),
      createTask({ id: 't3', source: 'handoff' }),
    ];
    const categories = buildQueueCategories(tasks);
    expect(categories.find((c) => c.key === 'unrecorded')?.count).toBe(2);
    expect(categories.find((c) => c.key === 'handoff')?.count).toBe(1);
    expect(categories.find((c) => c.key === 'other')?.count).toBe(0);
  });

  it('groups briefing, deadline, schedule as other', () => {
    const tasks = [
      createTask({ id: 't1', source: 'briefing' }),
      createTask({ id: 't2', source: 'deadline' }),
      createTask({ id: 't3', source: 'schedule' }),
    ];
    const categories = buildQueueCategories(tasks);
    expect(categories.find((c) => c.key === 'other')?.count).toBe(3);
  });

  it('excludes completed tasks from counts', () => {
    const tasks = [
      createTask({ id: 't1', source: 'unrecorded', completed: false }),
      createTask({ id: 't2', source: 'unrecorded', completed: true }),
    ];
    const categories = buildQueueCategories(tasks);
    expect(categories.find((c) => c.key === 'unrecorded')?.count).toBe(1);
  });

  it('returns zero counts for empty task list', () => {
    const categories = buildQueueCategories([]);
    expect(categories.every((c) => c.count === 0)).toBe(true);
  });

  it('assigns error color to unrecorded when count > 0', () => {
    const tasks = [createTask({ source: 'unrecorded' })];
    const categories = buildQueueCategories(tasks);
    expect(categories.find((c) => c.key === 'unrecorded')?.color).toBe('error');
  });

  it('assigns info color when count is 0', () => {
    const categories = buildQueueCategories([]);
    expect(categories.find((c) => c.key === 'unrecorded')?.color).toBe('info');
  });
});

describe('isAllDone', () => {
  it('returns true for empty array', () => {
    expect(isAllDone([])).toBe(true);
  });

  it('returns true when all completed', () => {
    const tasks = [
      createTask({ completed: true }),
      createTask({ id: 't2', completed: true }),
    ];
    expect(isAllDone(tasks)).toBe(true);
  });

  it('returns false when some incomplete', () => {
    const tasks = [
      createTask({ completed: true }),
      createTask({ id: 't2', completed: false }),
    ];
    expect(isAllDone(tasks)).toBe(false);
  });
});

// ─── Component Tests ─────────────────────────────────────────

describe('ActionQueueCard', () => {
  it('renders 3 category buttons when tasks exist', () => {
    const tasks = [createTask()];
    render(<ActionQueueCard tasks={tasks} onNavigate={vi.fn()} />);
    expect(screen.getByTestId('action-queue-unrecorded')).toBeInTheDocument();
    expect(screen.getByTestId('action-queue-handoff')).toBeInTheDocument();
    expect(screen.getByTestId('action-queue-other')).toBeInTheDocument();
  });

  it('navigates to correct route on category click', () => {
    const onNavigate = vi.fn();
    const tasks = [createTask({ source: 'unrecorded' })];
    render(<ActionQueueCard tasks={tasks} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('action-queue-unrecorded'));
    expect(onNavigate).toHaveBeenCalledWith('/dailysupport');
  });

  it('navigates to handoff on handoff click', () => {
    const onNavigate = vi.fn();
    const tasks = [createTask({ source: 'handoff' })];
    render(<ActionQueueCard tasks={tasks} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('action-queue-handoff'));
    expect(onNavigate).toHaveBeenCalledWith('/handoff-timeline');
  });

  it('shows success state when all done', () => {
    render(<ActionQueueCard tasks={[]} onNavigate={vi.fn()} />);
    expect(screen.getByTestId('action-queue-all-done')).toBeInTheDocument();
    expect(screen.getByText('すべて完了！')).toBeInTheDocument();
  });

  it('shows empty action button when onEmptyAction provided', () => {
    const onEmpty = vi.fn();
    render(<ActionQueueCard tasks={[]} onNavigate={vi.fn()} onEmptyAction={onEmpty} />);
    fireEvent.click(screen.getByRole('button', { name: '記録メニューを開く' }));
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it('displays remaining count in header chip', () => {
    const tasks = [
      createTask({ id: 't1', source: 'unrecorded' }),
      createTask({ id: 't2', source: 'handoff' }),
    ];
    render(<ActionQueueCard tasks={tasks} onNavigate={vi.fn()} />);
    expect(screen.getByText('残り 2 件')).toBeInTheDocument();
  });
});
