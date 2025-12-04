import EmptyState from '@/ui/components/EmptyState';
import ErrorState from '@/ui/components/ErrorState';
import { FormField } from '@/ui/components/FormField';
import SignInButton from '@/ui/components/SignInButton';
import { useMsalContext } from '@/auth/MsalProvider';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/auth/MsalProvider', () => ({
  useMsalContext: vi.fn(),
}));

const mockUseMsalContext = useMsalContext as unknown as vi.Mock;

vi.mock('@mui/material/Button', () => ({
  __esModule: true,
  default: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

vi.mock('@mui/material/Tooltip', () => ({
  __esModule: true,
  default: ({ title, children }: { title: React.ReactNode; children: React.ReactElement }) => (
    <div data-testid="tooltip" data-title={String(title)}>
      {children}
    </div>
  ),
}));

describe('UI components', () => {
  beforeEach(() => {
    mockUseMsalContext.mockReset();
  });

  it('renders EmptyState with defaults and overrides', () => {
    render(<EmptyState />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('表示できる項目がありません');

    render(<EmptyState title="データなし" description="別条件を試してください" data-testid="custom-empty" />);
    const custom = screen.getByTestId('custom-empty');
    expect(custom).toHaveTextContent('データなし');
    expect(custom).toHaveTextContent('別条件を試してください');
  });

  it('renders ErrorState message when provided', () => {
    render(<ErrorState />);
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();

    render(<ErrorState message="通信エラー" />);
    expect(screen.getByText('通信エラー')).toBeInTheDocument();
  });

  it('links label and hint in FormField', () => {
    const renderControl = vi.fn((id: string) => <input id={id} aria-label="input" />);

    render(
      <FormField label="名前" required hint="全角で入力してください">
        {renderControl}
      </FormField>
    );

    expect(renderControl).toHaveBeenCalled();
    const input = screen.getByLabelText('input');
    expect(input).toBeInTheDocument();
    expect(screen.getByText('（必須）')).toHaveClass('sr-only');
    expect(screen.getByText('全角で入力してください')).toBeInTheDocument();
  });

  it('renders sign-in button when no MSAL accounts exist', async () => {
    const loginPopup = vi.fn().mockResolvedValue({ account: { homeAccountId: 'abc' } });
    mockUseMsalContext.mockReturnValue({
      accounts: [],
      instance: {
        loginPopup,
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        logoutPopup: vi.fn(),
        acquireTokenSilent: vi.fn(),
        acquireTokenRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => null),
        getAllAccounts: vi.fn(() => []),
        setActiveAccount: vi.fn(),
      },
    });

    render(<SignInButton />);

    const button = screen.getByRole('button', { name: 'サインイン' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(loginPopup).toHaveBeenCalled();
    });
  });

  // Sign-out tooltip tests for legacy UI are intentionally omitted until the component reintroduces
  // authenticated states or alternative affordances. This keeps the suite focused on currently
  // rendered behaviors.
});
