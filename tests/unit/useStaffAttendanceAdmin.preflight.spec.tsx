import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { preflightStaffAttendanceList } from '@/features/staff/attendance/preflight';

function makeProvider(getMetadata: IDataProvider['getMetadata']): IDataProvider {
  return { getMetadata } as unknown as IDataProvider;
}

describe('staff attendance preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets read-only when SharePoint returns 401', async () => {
    const provider = makeProvider(vi.fn().mockRejectedValueOnce({ status: 401 }));

    const result = await preflightStaffAttendanceList({
      provider,
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/401|認証/i);
  });

  it('sets read-only when SharePoint returns 403', async () => {
    const provider = makeProvider(vi.fn().mockRejectedValueOnce({ response: { status: 403 } }));

    const result = await preflightStaffAttendanceList({
      provider,
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/403|権限/i);
  });

  it('sets read-only when list is missing', async () => {
    const provider = makeProvider(vi.fn().mockResolvedValueOnce(null));

    const result = await preflightStaffAttendanceList({
      provider,
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/見つかりません|list/i);
  });

  it('becomes SharePoint-ready when preflight succeeds', async () => {
    const provider = makeProvider(vi.fn().mockResolvedValueOnce({ Id: 'list-id', Title: 'Staff_Attendance' }));

    const result = await preflightStaffAttendanceList({
      provider,
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('connected');
    expect(result.reason ?? '').toBe('');
  });
});
