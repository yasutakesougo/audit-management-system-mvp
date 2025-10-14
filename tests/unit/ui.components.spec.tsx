import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '@/ui/components/EmptyState';
import ErrorState from '@/ui/components/ErrorState';
import { FormField } from '@/ui/components/FormField';
import SignInButton from '@/ui/components/SignInButton';

const mockUseAuth = vi.fn();

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

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('UI components', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
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

  it('renders sign-in button when unauthenticated', () => {
    const signIn = vi.fn();
    mockUseAuth.mockReturnValue({ isAuthenticated: false, signIn });

    render(<SignInButton />);

    const button = screen.getByRole('button', { name: 'サインイン' });
    fireEvent.click(button);
    expect(signIn).toHaveBeenCalled();
  });

  it('renders sign-out button with tooltip when authenticated', () => {
    const signOut = vi.fn();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      account: { name: 'テストユーザー' },
      signOut,
    });

    render(<SignInButton />);

    const button = screen.getByRole('button', { name: 'サインアウト' });
    fireEvent.click(button);
    expect(signOut).toHaveBeenCalled();
    expect(screen.getByTestId('tooltip')).toHaveAttribute('data-title', 'テストユーザー');
  });

  it('falls back to username or a generic tooltip when account name is missing', () => {
    const signOut = vi.fn();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      account: { username: 'user@example.com' },
      signOut,
    });

    const { rerender } = render(<SignInButton />);
  let tooltips = screen.getAllByTestId('tooltip');
  const initialTooltip = tooltips[tooltips.length - 1];
  expect(initialTooltip).toHaveAttribute('data-title', 'user@example.com');

    const nextSignOut = vi.fn();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      account: undefined,
      signOut: nextSignOut,
    });
    rerender(<SignInButton />);
  tooltips = screen.getAllByTestId('tooltip');
  const fallbackTooltip = tooltips[tooltips.length - 1];
  expect(fallbackTooltip).toHaveAttribute('data-title', 'Signed in');
  });
});
