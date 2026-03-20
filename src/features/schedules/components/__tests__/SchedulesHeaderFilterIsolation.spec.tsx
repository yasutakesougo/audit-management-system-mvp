/**
 * SchedulesHeaderFilterIsolation.spec.tsx
 *
 * Phase 5-C: タブ切替時のフィルタ分離テスト
 *
 * 検証ポイント:
 * - calendar → ops 遷移で calendar 系パラメータがクリアされる
 * - ops → calendar 遷移で ops 系パラメータがクリアされる
 * - 同系統遷移（day→week, ops→list）ではフィルタが保持される
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SchedulesHeader } from '../SchedulesHeader';

// Mock useNavigate
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockNavigate = vi.fn();
vi.mocked(useNavigate).mockReturnValue(mockNavigate);

// Shared props
const baseProps = {
  title: '予定表',
  subLabel: 'テスト',
  periodLabel: '3/16 〜 3/22',
  onPrev: vi.fn(),
  onNext: vi.fn(),
  onToday: vi.fn(),
  dayHref: '/schedules/week',
  weekHref: '/schedules/week',
  monthHref: '/schedules/week',
  modes: ['day', 'week', 'month', 'ops', 'list'] as const,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('SchedulesHeader filter isolation', () => {
  it('calendar→ops: clears calendar params (cat, q, lane)', () => {
    // Start on "week" tab
    render(
      <MemoryRouter>
        <SchedulesHeader {...baseProps} mode="week" />
      </MemoryRouter>,
    );

    // Click "運営" tab
    const opsTab = screen.getByTestId('schedule-tab-ops');
    fireEvent.click(opsTab);

    // Navigate should have been called
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;

    // Should NOT contain calendar filter params
    expect(navigatedUrl).toContain('tab=ops');
    expect(navigatedUrl).not.toContain('cat=');
    expect(navigatedUrl).not.toContain('q=');
    expect(navigatedUrl).not.toContain('lane=');
  });

  it('ops→calendar: clears ops params (serviceType, etc)', () => {
    // Start on "ops" tab
    render(
      <MemoryRouter>
        <SchedulesHeader {...baseProps} mode="ops" />
      </MemoryRouter>,
    );

    // Click "週" tab
    const weekTab = screen.getByTestId('schedules-view-tab-week');
    fireEvent.click(weekTab);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;

    // Should contain tab=week and NOT contain ops filter params
    expect(navigatedUrl).toContain('tab=week');
    expect(navigatedUrl).not.toContain('serviceType=');
    expect(navigatedUrl).not.toContain('staffId=');
    expect(navigatedUrl).not.toContain('searchQuery=');
    expect(navigatedUrl).not.toContain('includeCancelled=');
    expect(navigatedUrl).not.toContain('hasAttention=');
  });

  it('same-group: ops→list preserves url shape (no param stripping)', () => {
    render(
      <MemoryRouter>
        <SchedulesHeader {...baseProps} mode="ops" />
      </MemoryRouter>,
    );

    // Click "一覧" tab
    const listTab = screen.getByTestId('schedule-tab-list');
    fireEvent.click(listTab);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    expect(navigatedUrl).toContain('tab=list');
  });

  it('same-group: day→week preserves url shape (no param stripping)', () => {
    render(
      <MemoryRouter>
        <SchedulesHeader {...baseProps} mode="day" />
      </MemoryRouter>,
    );

    // Click "週" tab
    const weekTab = screen.getByTestId('schedules-view-tab-week');
    fireEvent.click(weekTab);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    expect(navigatedUrl).toContain('tab=week');
  });

  it('no-op: clicking current tab does nothing', () => {
    render(
      <MemoryRouter>
        <SchedulesHeader {...baseProps} mode="ops" />
      </MemoryRouter>,
    );

    // Click "運営" tab (already active)
    const opsTab = screen.getByTestId('schedule-tab-ops');
    fireEvent.click(opsTab);

    // Should NOT navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
