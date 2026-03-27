import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKokuhorenMonthlyPreview } from '../useKokuhorenMonthlyPreview';

const {
  listByMonthMock,
  repositoryMock,
  validateMonthlyMock,
  useUsersStoreMock,
} = vi.hoisted(() => ({
  listByMonthMock: vi.fn(),
  repositoryMock: { listByMonth: vi.fn() },
  validateMonthlyMock: vi.fn(),
  useUsersStoreMock: vi.fn(),
}));

vi.mock('@/features/service-provision/repositoryFactory', () => ({
  useServiceProvisionRepository: () => repositoryMock,
}));

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => useUsersStoreMock(),
}));

vi.mock('@/features/kokuhoren-validation/validateMonthly', () => ({
  validateMonthly: (input: unknown) => validateMonthlyMock(input),
}));

describe('useKokuhorenMonthlyPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMock.listByMonth = listByMonthMock;
    listByMonthMock.mockResolvedValue([
      {
        id: 1,
        entryKey: 'U001|2026-03-01',
        userCode: 'U001',
        recordDateISO: '2026-03-01',
        status: '提供',
        startHHMM: 900,
        endHHMM: 1000,
        hasTransport: false,
        hasTransportPickup: false,
        hasTransportDropoff: false,
        hasMeal: true,
        hasBath: false,
        hasExtended: false,
        hasAbsentSupport: false,
      },
    ]);
    useUsersStoreMock.mockReturnValue({
      data: [
        {
          Id: 1,
          UserID: 'U001',
          FullName: '山田 太郎',
          RecipientCertNumber: '1234567890',
        },
      ],
    });
    validateMonthlyMock.mockReturnValue({ ok: true, errors: [], warnings: [] });
  });

  it('fetches monthly records and calls validateMonthly with transformed input', async () => {
    const { result } = renderHook(() => useKokuhorenMonthlyPreview('2026-03'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(listByMonthMock).toHaveBeenCalledWith('2026-03');
    expect(validateMonthlyMock).toHaveBeenCalledTimes(1);

    const input = validateMonthlyMock.mock.calls[0][0] as {
      yearMonth: string;
      users: Array<{ userCode: string; userName: string; recipientCertNumber: string | null }>;
      records: Array<{ userCode: string; recordDateISO: string; status: string }>;
    };
    expect(input.yearMonth).toBe('2026-03');
    expect(input.users[0]).toEqual({
      userCode: 'U001',
      userName: '山田 太郎',
      recipientCertNumber: '1234567890',
    });
    expect(input.records[0]).toMatchObject({
      userCode: 'U001',
      recordDateISO: '2026-03-01',
      status: '提供',
    });

    expect(result.current.result).toEqual({ ok: true, errors: [], warnings: [] });
    expect(result.current.lastInput?.yearMonth).toBe('2026-03');
    expect(result.current.error).toBeNull();
  });

  it('captures repository errors and keeps result null', async () => {
    listByMonthMock.mockRejectedValueOnce(new Error('repo failed'));

    const { result } = renderHook(() => useKokuhorenMonthlyPreview('2026-03'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.result).toBeNull();
    expect(result.current.lastInput).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
