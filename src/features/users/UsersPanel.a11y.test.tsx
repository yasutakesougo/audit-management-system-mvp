import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';
import UsersPanel from './UsersPanel';

describe('UsersPanel accessibility smoke', () => {
  beforeEach(() => {
    usersStoreMock.reset();
  });

  it('exposes localized form controls', () => {
    render(<UsersPanel />);
    expect(screen.getByRole('textbox', { name: /ユーザーID/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '氏名' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '簡易作成' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<UsersPanel />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
