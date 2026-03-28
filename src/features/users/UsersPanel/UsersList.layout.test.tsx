import { TESTIDS } from '@/testids';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import UsersList from './UsersList';

describe('UsersList layout contract', () => {
  it('keeps table horizontally scrollable with non-wrapping critical headers', () => {
    render(
      <MemoryRouter>
        <UsersList
          users={[]}
          status="success"
          busyId={null}
          selectedUserKey={null}
          detailUser={null}
          detailSectionRef={createRef<HTMLDivElement>()}
          errorMessage={null}
          onRefresh={() => undefined}
          onSelectDetail={() => undefined}
          onCloseDetail={() => undefined}
          integrityErrors={[]}
        />
      </MemoryRouter>
    );

    const tableContainer = screen.getByTestId(TESTIDS['users-list-table']);
    expect(window.getComputedStyle(tableContainer).overflowX).toBe('auto');

    const userIdHeader = screen.getByRole('columnheader', { name: 'ユーザーID' });
    const nameHeader = screen.getByRole('columnheader', { name: '氏名' });
    const actionHeader = screen.getByRole('columnheader', { name: '操作' });

    const userIdStyle = window.getComputedStyle(userIdHeader);
    const nameStyle = window.getComputedStyle(nameHeader);
    const actionStyle = window.getComputedStyle(actionHeader);

    expect(userIdStyle.whiteSpace).toBe('nowrap');
    expect(nameStyle.whiteSpace).toBe('nowrap');
    expect(actionStyle.whiteSpace).toBe('nowrap');

    expect(userIdStyle.minWidth).toBe('96px');
    expect(nameStyle.minWidth).toBe('120px');
    expect(actionStyle.minWidth).toBe('120px');
  });
});
