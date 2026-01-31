import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preflightStaffAttendanceList } from '@/features/staff/attendance/preflight';

const spClientMocks = vi.hoisted(() => ({
  tryGetListMetadata: vi.fn(),
  ensureConfig: vi.fn(() => ({ baseUrl: 'https://contoso.sharepoint.com/sites/demo/_api/web' })),
}));

vi.mock('@/lib/spClient', () => ({
  ensureConfig: spClientMocks.ensureConfig,
  createSpClient: vi.fn(() => ({
    tryGetListMetadata: spClientMocks.tryGetListMetadata,
  })),
}));

describe('staff attendance preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spClientMocks.ensureConfig.mockReturnValue({ baseUrl: 'https://contoso.sharepoint.com/sites/demo/_api/web' });
  });

  it('sets read-only when SharePoint returns 401', async () => {
    spClientMocks.tryGetListMetadata.mockRejectedValueOnce({ status: 401 });

    const result = await preflightStaffAttendanceList({
      acquireToken: async () => 'token',
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/401|認証/i);
  });

  it('sets read-only when SharePoint returns 403', async () => {
    spClientMocks.tryGetListMetadata.mockRejectedValueOnce({ response: { status: 403 } });

    const result = await preflightStaffAttendanceList({
      acquireToken: async () => 'token',
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/403|権限/i);
  });

  it('sets read-only when list is missing', async () => {
    spClientMocks.tryGetListMetadata.mockResolvedValueOnce(null);

    const result = await preflightStaffAttendanceList({
      acquireToken: async () => 'token',
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('blocked');
    expect(result.reason ?? '').toMatch(/見つかりません|list/i);
  });

  it('becomes SharePoint-ready when preflight succeeds', async () => {
    spClientMocks.tryGetListMetadata.mockResolvedValueOnce({ listId: 'list-id', title: 'Staff_Attendance' });

    const result = await preflightStaffAttendanceList({
      acquireToken: async () => 'token',
      listTitle: 'Staff_Attendance',
    });

    expect(result.status).toBe('connected');
    expect(result.reason ?? '').toBe('');
  });
});
