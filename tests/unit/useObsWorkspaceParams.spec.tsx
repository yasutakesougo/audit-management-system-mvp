import { useObsWorkspaceParams } from '@/features/nurse/observation/useObsWorkspaceParams';
import { NURSE_USERS } from '@/features/nurse/users';
import { renderHook } from '@testing-library/react';
import React, { type PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

const createWrapper = (initialEntry: string) => {
  const Wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );
  return Wrapper;
};

describe('useObsWorkspaceParams', () => {
  const firstActive = NURSE_USERS.find((user) => user.isActive) ?? NURSE_USERS[0];

  if (!firstActive) {
    throw new Error('NURSE_USERS is empty; hook tests require at least one entry.');
  }

  it('normalizes missing params', () => {
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() => useObsWorkspaceParams(), {
      wrapper: createWrapper('/nurse/observation'),
    });

    expect(result.current.user).toBe(firstActive.id);
    expect(result.current.date).toBe(today);
  });

  it('repairs invalid inputs', () => {
    const today = new Date().toISOString().slice(0, 10);
    const { result } = renderHook(() => useObsWorkspaceParams(), {
      wrapper: createWrapper('/nurse/observation?user=XYZ&date=2025-99-99'),
    });

    expect(result.current.user).toBe(firstActive.id);
    expect(result.current.date).toBe(today);
  });

  it('repairs 29 Feb on non-leap years', () => {
    const { result } = renderHook(() => useObsWorkspaceParams(), {
      wrapper: createWrapper('/nurse/observation?date=2025-02-29'),
    });

    expect(/^\d{4}-\d{2}-\d{2}$/.test(result.current.date)).toBe(true);
  });

  it('accepts valid leap day', () => {
    const { result } = renderHook(() => useObsWorkspaceParams(), {
      wrapper: createWrapper('/nurse/observation?date=2024-02-29'),
    });

    expect(result.current.date).toBe('2024-02-29');
  });
});
