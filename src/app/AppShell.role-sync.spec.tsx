import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { SettingsProvider } from '@/features/settings';
import AppShell from './AppShell';

const setCurrentUserRoleMock = vi.fn();
let mockCurrentRole: 'admin' | 'staff' | null = null;

vi.mock('@/features/auth/store', async () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore: (selector: any) =>
      selector({
        get currentUserRole() {
          return mockCurrentRole;
        },
        setCurrentUserRole: (role: 'admin' | 'staff' | null) => {
          mockCurrentRole = role;
          setCurrentUserRoleMock(role);
        },
      }),
  };
});

function makeNavHandle() {
  let nav: (to: string) => void = () => {
    throw new Error('navigate handle not ready');
  };

  function NavDriver() {
    const navigate = useNavigate();
    nav = (to: string) => navigate(to);
    return null;
  }

  return { NavDriver, nav: (to: string) => nav(to) };
}

describe('AppShell role sync', () => {
  beforeEach(() => {
    setCurrentUserRoleMock.mockClear();
    mockCurrentRole = null; // Reset to initial state
  });

  it('sets role only when role changes', () => {
    const { NavDriver, nav } = makeNavHandle();

    render(
      <MemoryRouter initialEntries={['/']}>
        <SettingsProvider>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <NavDriver />
                  <AppShell>
                    <div>Test Content</div>
                  </AppShell>
                </>
              }
            />
          </Routes>
        </SettingsProvider>
      </MemoryRouter>,
    );

    // Initial mount: / → staff (count: 1)
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(1);
    expect(setCurrentUserRoleMock).toHaveBeenLastCalledWith('staff');

    // /admin/dashboard → admin (count: 2)
    act(() => nav('/admin/dashboard'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(2);
    expect(setCurrentUserRoleMock).toHaveBeenLastCalledWith('admin');

    // /dashboard → staff (count: 3)
    act(() => nav('/dashboard'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(3);
    expect(setCurrentUserRoleMock).toHaveBeenLastCalledWith('staff');

    // 同じ /dashboard 再訪問 → 呼ばれない（同値ガードが効く）
    act(() => nav('/dashboard'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(3);

    // role を維持する想定の画面 → 呼ばれない
    act(() => nav('/users'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(3);
  });

  it('does not loop when pathname changes multiple times', () => {
    const { NavDriver, nav } = makeNavHandle();

    render(
      <MemoryRouter initialEntries={['/']}>
        <SettingsProvider>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <NavDriver />
                  <AppShell>
                    <div>Test Content</div>
                  </AppShell>
                </>
              }
            />
          </Routes>
        </SettingsProvider>
      </MemoryRouter>,
    );

    // 連続で同じ role の画面を行き来しても増えない
    act(() => nav('/dashboard'));
    const callCountAfterFirst = setCurrentUserRoleMock.mock.calls.length;
    
    act(() => nav('/'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(callCountAfterFirst);
    
    act(() => nav('/dashboard'));
    expect(setCurrentUserRoleMock).toHaveBeenCalledTimes(callCountAfterFirst);
  });
});
