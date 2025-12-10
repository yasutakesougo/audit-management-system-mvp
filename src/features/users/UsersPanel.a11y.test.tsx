import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { usersStoreMock } from './testUtils/usersStoreMock';
import UsersPanel from './UsersPanel/index';

describe('UsersPanel accessibility smoke', () => {
  beforeEach(() => {
    usersStoreMock.reset();
  });

  it('exposes localized form controls', () => {
    render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('tab', { name: '新規利用者登録' }));
    expect(screen.getByRole('textbox', { name: '氏名' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '簡易作成' })).toBeInTheDocument();
    expect(screen.getByText('利用者コード（U-xxx）は保存後に自動採番されます')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '詳細登録フォーム' })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <UsersPanel />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
