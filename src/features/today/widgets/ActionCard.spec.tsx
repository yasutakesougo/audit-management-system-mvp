import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionCard } from './ActionCard';
import type { ActionCard as IActionCard } from '../domain/models/queue.types';
import { ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('ActionCard', () => {
  const baseAction: IActionCard = {
    id: 'act-1',
    title: 'Test Action',
    priority: 'P1',
    contextMessage: 'This is a test context message',
    actionType: 'NAVIGATE',
    requiresAttention: false,
    isOverdue: false,
    payload: { path: '/test' }
  };

  it('renders correctly with given priority', () => {
    renderWithTheme(<ActionCard action={baseAction} />);
    expect(screen.getByText('Test Action')).toBeInTheDocument();
    expect(screen.getByText('This is a test context message')).toBeInTheDocument();
    expect(screen.getByText('高優先 (P1)')).toBeInTheDocument();
  });

  it('displays attention elements for P0 urgency', () => {
    const p0Action = { ...baseAction, priority: 'P0' as const };
    renderWithTheme(<ActionCard action={p0Action} />);
    expect(screen.getByText('最優先 (P0)')).toBeInTheDocument();
    
    // MUI components with background colors
    const cardElement = screen.getByTestId('action-card-act-1');
    expect(cardElement).toBeInTheDocument();
  });

  it('displays overdue chip when isOverdue is true', () => {
    const overdueAction = { ...baseAction, isOverdue: true };
    renderWithTheme(<ActionCard action={overdueAction} />);
    expect(screen.getByText('超過')).toBeInTheDocument();
  });

  it('calls onClick when clicking the card itself', () => {
    const handleClick = vi.fn();
    renderWithTheme(<ActionCard action={baseAction} onClick={handleClick} />);
    const card = screen.getByTestId('action-card-act-1');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledWith(baseAction);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when clicking the action icon button', () => {
    const handleClick = vi.fn();
    renderWithTheme(<ActionCard action={baseAction} onClick={handleClick} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledWith(baseAction);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
