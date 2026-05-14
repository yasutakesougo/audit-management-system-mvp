import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('@/auth/MsalProvider', () => ({
  useMsalContext: vi.fn(),
}));
vi.mock('@/lib/spClient', () => ({
  useSP: vi.fn(),
}));
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    isDemoModeEnabled: vi.fn(() => false),
    isE2eMsalMockEnabled: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
    readBool: vi.fn((key: string, fallback: boolean) => fallback),
    getAppConfig: vi.fn(() => ({ isDev: true })),
  };
});

import { useAuth } from '@/auth/useAuth';
import { useMsalContext } from '@/auth/MsalProvider';
import { useSP } from '@/lib/spClient';

describe('ConnectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accountあり/tokenなしのとき SP Connected を表示しない', async () => {
    vi.mocked(useAuth).mockReturnValue({
      tokenReady: false,
      loading: false,
    } as never);
    vi.mocked(useMsalContext).mockReturnValue({
      accounts: [{ homeAccountId: 'acc-1' }],
    } as never);
    vi.mocked(useSP).mockReturnValue({
      spFetch: vi.fn().mockResolvedValue({ ok: true }),
    } as never);

    render(<ConnectionStatus />);

    await waitFor(() => {
      expect(screen.getByTestId('sp-connection-status')).toBeInTheDocument();
    });

    expect(screen.queryByText('SP Connected')).not.toBeInTheDocument();
    expect(screen.getByText('SP Sign-In')).toBeInTheDocument();
  });
});
