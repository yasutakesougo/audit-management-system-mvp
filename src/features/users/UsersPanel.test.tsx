import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersPanel from './UsersPanel';

const useUsersMock = vi.fn();

vi.mock('./useUsers', () => ({
  useUsers: () => useUsersMock(),
}));

describe('UsersPanel accessibility', () => {
  beforeEach(() => {
    useUsersMock.mockReturnValue({
      data: [],
      status: 'success',
      error: null,
      refresh: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    });
  });

  it('exposes localized inputs via label and role accessible names', () => {
    render(<UsersPanel />);
    expect(screen.getByLabelText('氏名')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '氏名' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'User ID' })).toBeInTheDocument();
  });

  it('passes axe against the creation form', async () => {
    const { container } = render(<UsersPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
