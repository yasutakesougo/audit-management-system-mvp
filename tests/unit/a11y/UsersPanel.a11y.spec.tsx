import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import UsersPanel from '@/features/users/UsersPanel';
import * as usersStore from '@/features/users/store';
import { ToastProvider } from '@/hooks/useToast';

expect.extend(toHaveNoViolations);

const noop = async () => undefined;

/**
 * UsersPanel Accessibility Tests (#340)
 *
 * Verifies UsersPanel component has no axe violations
 * in various states
 */
describe('UsersPanel Accessibility', () => {
  beforeEach(() => {
    // Mock the users store
    vi.spyOn(usersStore, 'useUsersStore').mockReturnValue({
      data: [],
      status: 'idle',
      error: null,
      create: vi.fn(noop),
      remove: vi.fn(noop),
      refresh: vi.fn(noop),
    } as any);
  });

  test('has no a11y violations (menu tab)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <UsersPanel />
        </ToastProvider>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (with demo users)', async () => {
    const mockUsers = [
      {
        Id: 1,
        UserID: 'U-001',
        FullName: 'テスト太郎',
        Furigana: 'てすとたろう',
        FullNameKana: 'テスト太郎',
        IsHighIntensitySupportTarget: false,
      },
      {
        Id: 2,
        UserID: 'U-002',
        FullName: 'テスト次郎',
        Furigana: 'てすとじろう',
        FullNameKana: 'テスト次郎',
        IsHighIntensitySupportTarget: true,
      },
    ];

    vi.spyOn(usersStore, 'useUsersStore').mockReturnValue({
      data: mockUsers,
      status: 'idle',
      error: null,
      create: vi.fn(noop),
      remove: vi.fn(noop),
      refresh: vi.fn(noop),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <UsersPanel />
        </ToastProvider>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (loading state)', async () => {
    vi.spyOn(usersStore, 'useUsersStore').mockReturnValue({
      data: [],
      status: 'loading',
      error: null,
      create: vi.fn(noop),
      remove: vi.fn(noop),
      refresh: vi.fn(noop),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <UsersPanel />
        </ToastProvider>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (error state)', async () => {
    vi.spyOn(usersStore, 'useUsersStore').mockReturnValue({
      data: [],
      status: 'error',
      error: new Error('Failed to load users'),
      create: vi.fn(noop),
      remove: vi.fn(noop),
      refresh: vi.fn(noop),
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <UsersPanel />
        </ToastProvider>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
