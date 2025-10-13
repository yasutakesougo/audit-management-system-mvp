import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefaultActiveFilter, useUsersApi } from '../../src/features/users/api';
import { FIELD_MAP, type IUserMaster, type IUserMasterCreateDto } from '../../src/sharepoint/fields';

const spFetch = vi.fn();
const getListItemsByTitle = vi.fn();
const addListItemByTitle = vi.fn();
const pushAuditMock = vi.fn();

vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({
    spFetch,
    getListItemsByTitle,
    addListItemByTitle,
  }),
}));

vi.mock('../../src/lib/audit', () => ({
  pushAudit: (...args: unknown[]) => pushAuditMock(...args),
}));

describe('users api', () => {
  beforeEach(() => {
    spFetch.mockReset();
    getListItemsByTitle.mockReset();
    addListItemByTitle.mockReset();
    pushAuditMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('buildDefaultActiveFilter caches computed filter and accepts manual now', () => {
    const first = buildDefaultActiveFilter();
    const second = buildDefaultActiveFilter();
    const manual = buildDefaultActiveFilter('2025-01-01T00:00:00Z');

    expect(first).toBe(second);
    expect(manual).toContain("2025-01-01T00:00:00Z");
  });

  it('getUsers returns items and falls back to default filter', async () => {
    const rowsMock: IUserMaster[] = [{ Id: 1, UserID: '1', FullName: 'User A' } as IUserMaster];
    getListItemsByTitle.mockResolvedValueOnce(rowsMock);
    const { result } = renderHook(() => useUsersApi());

  const rows = await result.current.getUsers(undefined, { top: 25 });

  expect(rows).toEqual(rowsMock);
    expect(getListItemsByTitle).toHaveBeenCalledWith(
      'Users_Master',
      expect.any(Array),
      expect.stringContaining('ServiceEndDate'),
      undefined,
      25
    );
  });

  it('getUsers respects explicit filter and default page size', async () => {
    getListItemsByTitle.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useUsersApi());

    await result.current.getUsers('Custom eq 1');

    expect(getListItemsByTitle).toHaveBeenCalledWith(
      'Users_Master',
      expect.any(Array),
      'Custom eq 1',
      undefined,
      50
    );
  });

  it('getUserById returns null when SharePoint yields no rows', async () => {
    getListItemsByTitle.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useUsersApi());

    const user = await result.current.getUserById(42);

    expect(user).toBeNull();
    expect(getListItemsByTitle).toHaveBeenCalledWith(
      'Users_Master',
      expect.any(Array),
      'Id eq 42',
      undefined,
      1
    );
  });

  it('createUser sends payload and emits audit', async () => {
    addListItemByTitle.mockResolvedValueOnce({ Id: 9, FullName: 'Created User' });
    const { result } = renderHook(() => useUsersApi());

    const dto: IUserMasterCreateDto = {
      UserID: '1001',
      FullName: 'Created User',
      ContractDate: '2025-01-01',
      IsHighIntensitySupportTarget: true,
      ServiceStartDate: '2025-01-02',
      ServiceEndDate: undefined,
    };

    const created = await result.current.createUser(dto);

    expect(addListItemByTitle).toHaveBeenCalledWith('Users_Master', expect.objectContaining({ UserID: '1001' }));
    expect(pushAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'create', entity: 'Users_Master' }));
    expect(created).toEqual({ Id: 9, FullName: 'Created User' });
  });

  it('createUser omits entity_id when SharePoint response lacks Id', async () => {
    addListItemByTitle.mockResolvedValueOnce({ FullName: 'No Id' });
    const { result } = renderHook(() => useUsersApi());

    await result.current.createUser({
      UserID: '1002',
      FullName: 'No Id',
      ContractDate: '2025-02-01',
      IsHighIntensitySupportTarget: false,
      ServiceStartDate: '2025-02-02',
      ServiceEndDate: null,
    });

    const auditArgs = pushAuditMock.mock.calls[0][0];
    expect(auditArgs.entity_id).toBeUndefined();
  });

  it('updateUser patches fields, reloads item, and audits change', async () => {
    spFetch.mockResolvedValueOnce(undefined);
    getListItemsByTitle.mockResolvedValueOnce([{ Id: 5, FullName: 'Updated' }]);
    const { result } = renderHook(() => useUsersApi());

  const patch: Partial<IUserMasterCreateDto> = {
      UserID: '2001',
      FullName: 'Updated',
      ContractDate: '2025-03-01',
      IsHighIntensitySupportTarget: false,
      ServiceStartDate: '2025-03-05',
      ServiceEndDate: null,
    };
    const updated = await result.current.updateUser(5, patch);

    expect(spFetch).toHaveBeenCalledWith(
      "/_api/web/lists/getbytitle('Users_Master')/items(5)",
      expect.objectContaining({ method: 'PATCH' })
    );
    const payload = JSON.parse(spFetch.mock.calls[0][1].body as string);
    expect(payload).toMatchObject({
      [FIELD_MAP.Users_Master.userId]: '2001',
      [FIELD_MAP.Users_Master.fullName]: 'Updated',
      [FIELD_MAP.Users_Master.contractDate]: '2025-03-01',
      [FIELD_MAP.Users_Master.isHighIntensitySupportTarget]: false,
      [FIELD_MAP.Users_Master.serviceStartDate]: '2025-03-05',
      [FIELD_MAP.Users_Master.serviceEndDate]: null,
    });
    expect(pushAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'update', entity_id: '5' }));
    expect(updated).toEqual({ Id: 5, FullName: 'Updated' });
  });

  it('deleteUser issues DELETE request and audits removal', async () => {
    spFetch.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useUsersApi());

    await result.current.deleteUser(12);

    expect(spFetch).toHaveBeenCalledWith(
      "/_api/web/lists/getbytitle('Users_Master')/items(12)",
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(pushAuditMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'delete', entity_id: '12' }));
  });
});
