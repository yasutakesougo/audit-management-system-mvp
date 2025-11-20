import SchedulesGate from '@/app/SchedulesGate';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseFeatureFlags = vi.fn();
const mockUseLocation = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/config/featureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

vi.mock('@/env', () => ({
  isE2E: false, // E2Eモードを無効にしてテスト環境で正常動作させる
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
    Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
      mockNavigate({ to, replace });
      return <div data-testid="navigate" data-to={to} data-replace={String(!!replace)} />;
    },
  };
});

beforeEach(() => {
  mockUseFeatureFlags.mockReset();
  mockUseLocation.mockReset();
  mockNavigate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SchedulesGate', () => {
  it('redirects when schedules feature is disabled and path matches schedule routes', () => {
    mockUseFeatureFlags.mockReturnValue({ schedules: false });
    mockUseLocation.mockReturnValue({ pathname: '/schedule' });

    render(
      <SchedulesGate>
        <div data-testid="child">child</div>
      </SchedulesGate>
    );

    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('redirects when nested schedules route is accessed without flag', () => {
    mockUseFeatureFlags.mockReturnValue({ schedules: false });
    mockUseLocation.mockReturnValue({ pathname: '/schedules/list' });

    render(
      <SchedulesGate>
        <div data-testid="child">child</div>
      </SchedulesGate>
    );

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true });
  });

  it('renders children when schedules flag is enabled', () => {
    mockUseFeatureFlags.mockReturnValue({ schedules: true });
    mockUseLocation.mockReturnValue({ pathname: '/schedules/list' });

    render(
      <SchedulesGate>
        <div data-testid="child">allowed</div>
      </SchedulesGate>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('allowed');
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('renders children when schedules flag is disabled but route does not match', () => {
    mockUseFeatureFlags.mockReturnValue({ schedules: false });
    mockUseLocation.mockReturnValue({ pathname: '/reports' });

    render(
      <SchedulesGate>
        <div data-testid="child">report</div>
      </SchedulesGate>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('report');
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});
