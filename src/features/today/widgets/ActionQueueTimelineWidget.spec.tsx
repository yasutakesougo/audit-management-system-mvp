import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionQueueTimelineWidget } from './ActionQueueTimelineWidget';
import type { ActionCard as IActionCard } from '../domain/models/queue.types';

describe('ActionQueueTimelineWidget', () => {
  const dummyActions: IActionCard[] = [
    {
      id: 'act-1',
      title: 'Action 1',
      priority: 'P1',
      contextMessage: 'Message 1',
      actionType: 'NAVIGATE',
      requiresAttention: false,
      isOverdue: false,
      payload: null,
    },
    {
      id: 'act-2',
      title: 'Action 2',
      priority: 'P2',
      contextMessage: 'Message 2',
      actionType: 'OPEN_DRAWER',
      requiresAttention: false,
      isOverdue: false,
      payload: null,
    },
  ];

  it('displays loading skeletons when isLoading is true', () => {
    const { container } = render(<ActionQueueTimelineWidget actionQueue={[]} isLoading={true} />);
    // Check if skeletons are rendered (mui skeleton uses MuiSkeleton-root class)
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(3);
  });

  it('displays empty state when actionQueue is empty and not loading', () => {
    render(<ActionQueueTimelineWidget actionQueue={[]} isLoading={false} />);
    expect(screen.getByText('現在の待機アクションはありません')).toBeInTheDocument();
    expect(screen.getByText('すべての業務が完了しているか、直近のタスクがありません')).toBeInTheDocument();
  });

  it('displays the list of ActionCards when actionQueue has items', () => {
    const handleActionClick = vi.fn();
    render(
      <ActionQueueTimelineWidget
        actionQueue={dummyActions}
        isLoading={false}
        onActionClick={handleActionClick}
      />
    );
    
    // Test that the cards are rendered
    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();
    
    // The empty state should not be present
    expect(screen.queryByText('現在の待機アクションはありません')).not.toBeInTheDocument();
  });

  it('renders ActionCards in the exact order provided by the engine without re-sorting', () => {
    const handleActionClick = vi.fn();
    const unorderedActions: IActionCard[] = [
      { id: 'a1', title: 'Action P2', priority: 'P2', contextMessage: '', actionType: 'NAVIGATE', requiresAttention: false, isOverdue: false, payload: null },
      { id: 'a2', title: 'Action P0', priority: 'P0', contextMessage: '', actionType: 'NAVIGATE', requiresAttention: true, isOverdue: false, payload: null },
      { id: 'a3', title: 'Action P3', priority: 'P3', contextMessage: '', actionType: 'NAVIGATE', requiresAttention: false, isOverdue: false, payload: null },
    ];
    
    render(
      <ActionQueueTimelineWidget
        actionQueue={unorderedActions}
        isLoading={false}
        onActionClick={handleActionClick}
      />
    );
    
    // Find all titles
    const titles = screen.getAllByText(/Action P/);
    expect(titles.length).toBe(3);
    // Elements should appear in DOM in same order as they are in the array
    expect(titles[0]).toHaveTextContent('Action P2');
    expect(titles[1]).toHaveTextContent('Action P0');
    expect(titles[2]).toHaveTextContent('Action P3');
  });
});
