import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useWeekPageRouteState } from '@/features/schedules/useWeekPageRouteState';

const Harness = () => {
  const route = useWeekPageRouteState();
  const location = useLocation();
  return (
    <div>
      <span data-testid="search">{location.search}</span>
      <span data-testid="category">{route.filter.category}</span>
      <span data-testid="query">{route.filter.query}</span>
      <button type="button" data-testid="noop-query" onClick={() => route.setFilter({ query: route.filter.query })}>
        noop-query
      </button>
      <button type="button" data-testid="clear-filter" onClick={() => route.setFilter({ category: 'All', query: '' })}>
        clear-filter
      </button>
    </div>
  );
};

const renderWithRoute = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/schedules/week" element={<Harness />} />
      </Routes>
    </MemoryRouter>
  );

describe('useWeekPageRouteState', () => {
  it('falls back to All when cat is unknown', () => {
    renderWithRoute('/schedules/week?date=2026-02-09&cat=hoge');
    expect(screen.getByTestId('category')).toHaveTextContent('All');
  });

  it('normalizes invalid date to yyyy-mm-dd', async () => {
    renderWithRoute('/schedules/week?date=invalid');
    await waitFor(() => {
      const search = screen.getByTestId('search').textContent ?? '';
      expect(search).toMatch(/date=\d{4}-\d{2}-\d{2}/);
      expect(search).not.toContain('date=invalid');
    });
  });

  it('does not update URL when filter values are unchanged', async () => {
    const user = userEvent.setup();
    renderWithRoute('/schedules/week?date=2026-02-09&cat=User&q=foo');
    const before = screen.getByTestId('search').textContent;
    await user.click(screen.getByTestId('noop-query'));
    await waitFor(() => {
      const after = screen.getByTestId('search').textContent;
      expect(after).toBe(before);
    });
  });

  it('clears q/cat params when filter is reset', async () => {
    const user = userEvent.setup();
    renderWithRoute('/schedules/week?date=2026-02-09&cat=User&q=foo');
    await user.click(screen.getByTestId('clear-filter'));
    await waitFor(() => {
      const search = screen.getByTestId('search').textContent ?? '';
      expect(search).toBe('?date=2026-02-09');
    });
  });
});
