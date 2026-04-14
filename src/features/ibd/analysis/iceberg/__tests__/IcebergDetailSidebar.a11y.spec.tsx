import { render, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { IcebergDetailSidebar } from '../IcebergDetailSidebar';
import type { IcebergNode, IcebergEvent } from '../icebergTypes';

// Silent theme to suppress animations and ripples
const theme = createTheme({
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiTab: { defaultProps: { disableRipple: true } },
    MuiTransitions: { styleOverrides: { root: { transition: 'none !important' } } },
  },
});

describe('IcebergDetailSidebar A11y', () => {
  const user = userEvent.setup();

  const mockNode: IcebergNode = {
    id: 'node-1',
    type: 'behavior',
    label: 'テスト行動',
    details: '詳細な説明です',
    position: { x: 100, y: 100 },
    status: 'hypothesis',
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

  const renderWithTheme = (ui: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
  };

  it('has no accessibility violations in Initial (Info) tab', async () => {
    const { container, findByText } = renderWithTheme(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    // ヘッダーが表示されるのを待つ
    await findByText('項目の詳細設定');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in History tab', async () => {
    const { container, getByRole, findByText } = renderWithTheme(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    const historyTab = getByRole('tab', { name: /履歴/ });
    
    // UI反映を確実にするため act で包む
    await act(async () => {
      await user.click(historyTab);
    });

    // 履歴タブのコンテンツが表示されるのを待つ
    await findByText('セッション開始');
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders correct ARIA roles for tabs and tabpanels', async () => {
    const { getByRole, getAllByRole, findByText } = renderWithTheme(
      <IcebergDetailSidebar 
        node={mockNode} 
        onClose={vi.fn()} 
        logs={mockLogs}
      />
    );

    await findByText('項目の詳細設定');

    expect(getByRole('tablist')).toBeDefined();
    const tabs = getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
  });
});
