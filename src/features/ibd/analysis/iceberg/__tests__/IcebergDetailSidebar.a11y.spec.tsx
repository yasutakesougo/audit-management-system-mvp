import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { IcebergDetailSidebar } from '../IcebergDetailSidebar';
import type { IcebergNode, IcebergEvent } from '../icebergTypes';

describe('IcebergDetailSidebar A11y', () => {
  const mockNode: IcebergNode = {
    id: 'node-1',
    type: 'behavior',
    label: 'テスト行動',
    details: '詳細な説明です',
    position: { x: 100, y: 100 },
  };

  const mockLogs: IcebergEvent[] = [
    {
      id: 'log-1',
      type: 'session_created',
      timestamp: new Date().toISOString(),
      message: 'セッション開始',
    },
    {
      id: 'log-2',
      type: 'node_added',
      timestamp: new Date().toISOString(),
      message: 'ノード追加',
      targetId: 'node-1',
    }
  ];

  it('has no accessibility violations in Initial (Info) tab', async () => {
    const { container } = render(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in History tab', async () => {
    // Note: To test the second tab via axe, we should ideally trigger a click,
    // but we can also just render with tabValue state if it were a prop.
    // Since it's internal state, we use fireEvent or just test the component's ARIA structure.
    const { container, getByRole } = render(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    // Switch to History tab
    const historyTab = getByRole('tab', { name: /履歴/ });
    historyTab.click();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders correct ARIA roles for tabs and tabpanels', () => {
    const { getByRole, getAllByRole } = render(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    expect(getByRole('tablist')).toBeDefined();
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });
});
