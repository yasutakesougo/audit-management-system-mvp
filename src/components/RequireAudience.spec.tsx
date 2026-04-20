import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RequireAudience from './RequireAudience';

// Dependencies to mock
import * as useUserAuthzModule from '@/auth/useUserAuthz';
import * as useAuthModule from '@/auth/useAuth';
import * as guardResolutionModule from '@/lib/auth/guardResolution';
import { readOptionalEnv } from '@/lib/env';
import { createMockAuthState, mockAuthenticatedReadyUser } from '../../tests/unit/_helpers/authMocks';

vi.mock('@/auth/useUserAuthz');
vi.mock('@/auth/useAuth');
vi.mock('@/lib/auth/guardResolution');
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return {
    ...actual,
    readOptionalEnv: vi.fn(),
  };
});

describe('RequireAudience Component', () => {
  const mockChildren = <div data-testid="children">Protected Content</div>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Default implementations for standard flow (not bypassed, viewer role)
    vi.spyOn(guardResolutionModule, 'shouldBypassAuthGuard').mockReturnValue(false);
    vi.mocked(readOptionalEnv).mockReturnValue('0');

    vi.spyOn(useUserAuthzModule, 'useUserAuthz').mockReturnValue({
      role: 'viewer',
      ready: true,
    });

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(createMockAuthState());
  });

  it('1. 通常未ログイン: webdriver=false, authReady=false -> "ログインを確認中..." となり、(外部のProtectedRouteが誘導するのを待機する)', () => {
    // Normal unauthenticated state:
    // ProtectedRoute does NOT bypass -> handles redirect.
    // RequireAudience waits internally (though usually unmounted by ProtectedRoute)
    vi.spyOn(guardResolutionModule, 'shouldBypassAuthGuard').mockReturnValue(false);

    render(
      <RequireAudience requiredRole="viewer">
        {mockChildren}
      </RequireAudience>
    );

    // It should NOT render children
    expect(screen.queryByTestId('children')).not.toBeInTheDocument();
    // It SHOULD render "ログインを確認中..."
    expect(screen.getByText('ログインを確認中...')).toBeInTheDocument();
  });

  it('2. 自動化バイパス時: webdriver=true 等なら、未ログインでも通す (デッドロック回避)', () => {
    // Both guards use `shouldBypassAuthGuard` returning true
    vi.spyOn(guardResolutionModule, 'shouldBypassAuthGuard').mockReturnValue(true);

    render(
      <RequireAudience requiredRole="viewer">
        {mockChildren}
      </RequireAudience>
    );

    // It MUST render children immediately, bypassing MSAL wait
    expect(screen.getByTestId('children')).toBeInTheDocument();
    expect(screen.queryByText('ログインを確認中...')).not.toBeInTheDocument();
  });

  it('3. ログイン済み通常環境: authReady=true -> 通す', () => {
    vi.spyOn(guardResolutionModule, 'shouldBypassAuthGuard').mockReturnValue(false);
    
    // User is fully authenticated
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue(mockAuthenticatedReadyUser());

    render(
      <RequireAudience requiredRole="viewer">
        {mockChildren}
      </RequireAudience>
    );

    // It SHOULD render children
    expect(screen.getByTestId('children')).toBeInTheDocument();
  });
});
