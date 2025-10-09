import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const spFetchMock = vi.fn(async () => ({ ok: true }));
const signInMock = vi.fn(async () => undefined);
const signOutMock = vi.fn(async () => undefined);

vi.mock('../../src/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/spClient')>('../../src/lib/spClient');
  return {
    ...actual,
    useSP: () => ({ spFetch: spFetchMock }),
  };
});

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => ({
    signIn: signInMock,
    signOut: signOutMock,
    isAuthenticated: false,
    account: null,
  }),
}));

vi.mock('../../src/features/records/RecordList', () => ({
  __esModule: true,
  default: () => <h1>記録管理トップ</h1>,
}));

vi.mock('../../src/features/compliance-checklist/ChecklistPage', () => ({
  __esModule: true,
  default: () => <h1>自己点検ビュー</h1>,
}));

vi.mock('../../src/features/audit/AuditPanel', () => ({
  __esModule: true,
  default: () => <h1>監査ログビュー</h1>,
}));

vi.mock('../../src/features/users', () => ({
  __esModule: true,
  UsersPanel: () => <h1>利用者ビュー</h1>,
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    shouldSkipLogin: () => true,
  };
});

vi.mock('@/pages/DailyPage', () => ({
  __esModule: true,
  default: () => <h1>日次記録ビュー</h1>,
}));

vi.mock('@/stores/useUsers', () => ({
  useUsers: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({ data: [], error: null, loading: false, reload: vi.fn() }),
}));

vi.mock('@/features/schedule/useSchedulesToday', () => ({
  useSchedulesToday: () => ({
    data: [],
    loading: false,
    error: null,
    dateISO: '2024-01-01',
  }),
}));

import App from '../../src/App';

describe('router future flags smoke', () => {
  beforeEach(() => {
    spFetchMock.mockClear();
  });

  it('navigates across primary routes with v7 flags enabled', async () => {
    render(<App />);

  expect(await screen.findByRole('heading', { name: 'Audit Management – ホーム' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('link', { name: '監査ログ' })[1]);
    expect(await screen.findByText('監査ログビュー')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: '日次記録' }));
  expect(await screen.findByText('日次記録ビュー')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: '自己点検' }));
    expect(await screen.findByText('自己点検ビュー')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'ホーム' }));
    expect(await screen.findByRole('heading', { name: 'Audit Management – ホーム' })).toBeInTheDocument();
  });
});
