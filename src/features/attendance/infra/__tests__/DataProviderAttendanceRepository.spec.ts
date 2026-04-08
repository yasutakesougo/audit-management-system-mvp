import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DataProviderAttendanceRepository } from '../DataProviderAttendanceRepository';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { auditLog } from '@/lib/debugLogger';

vi.mock('@/lib/debugLogger', () => ({
  auditLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/data/dataProviderObservabilityStore', () => ({
  reportResourceResolution: vi.fn(),
}));

describe('DataProviderAttendanceRepository - Regression / Hardening', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockProvider: any;
  let repository: DataProviderAttendanceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      getResourceNames: vi.fn().mockResolvedValue(['Users_Master', 'Daily_Attendance']),
      getFieldInternalNames: vi.fn(),
      listItems: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      ensureListExists: vi.fn().mockResolvedValue(undefined),
    };
    repository = new DataProviderAttendanceRepository({ provider: mockProvider as unknown as IDataProvider });
  });

  describe('Field Resolution Resilience', () => {
    it('resolves UserID when UserCode is missing (AttendanceUsers)', async () => {
      // Setup: Field names in SP are 'UserID' and 'FullName' (candidates for userCode and title)
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserID', 'FullName', 'IsActive']));
      
      mockProvider.listItems.mockResolvedValue([
        { Id: 1, UserID: 'U001', FullName: 'Test User', IsActive: true }
      ]);

      const users = await repository.getActiveUsers();

      expect(users.length).toBe(1);
      expect(users[0].UserCode).toBe('U001');
      expect(users[0].Title).toBe('Test User');
      // Verify listItems was called with resolved field names
      expect(mockProvider.listItems).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          select: expect.arrayContaining(['UserID']),
        }),
      );
      const callOptions = mockProvider.listItems.mock.calls[0][1];
      expect(callOptions.select).toContain('Id');
      expect(callOptions.select).toContain('UserID');
      expect(callOptions.select).toContain('FullName');
    });

    it('handles missing optional fields gracefullly (AttendanceUsers)', async () => {
      // Setup: Only essential fields exist. Optional ones (StandardMinutes, IsTransportTarget) are missing in SP.
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserCode', 'Title', 'IsActive']));
      
      mockProvider.listItems.mockResolvedValue([
        { Id: 1, UserCode: 'U001', Title: 'Test User', IsActive: true }
      ]);

      const users = await repository.getActiveUsers();

      expect(users.length).toBe(1);
      expect(users[0].StandardMinutes).toBe(0); // Default value
      expect(users[0].IsTransportTarget).toBe(false); // Default value
      
      // Verify $select does NOT include missing optional fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const call = mockProvider.listItems.mock.calls[0][1] as any;
      expect(call.select).not.toContain('StandardMinutes');
      expect(call.select).not.toContain('IsTransportTarget');
    });

    it('fails gracefully when essential fields are missing (AttendanceDaily)', async () => {
      // Setup: 'Status' (essential) is missing in SP
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserCode', 'RecordDate', 'Title'])); 
      
      const daily = await repository.getDailyByDate({ recordDate: '2024-03-01' });

      expect(daily).toEqual([]);
      expect(auditLog.warn).toHaveBeenCalledWith(
        'attendance:repo',
        expect.stringContaining('AttendanceDaily list not found in catalog or essentials are missing'),
        expect.any(Object),
      );
    });

    it('skips unresolved optional fields on write (AttendanceDaily)', async () => {
      mockProvider.getResourceNames.mockResolvedValue(['AttendanceDaily']);
      mockProvider.getFieldInternalNames.mockResolvedValue(
        new Set(['Id', 'Title', 'UserCode', 'RecordDate', 'Status', 'CheckInAt']),
      );
      mockProvider.listItems.mockResolvedValue([]);

      await repository.upsertDailyByKey({
        Key: 'U001_2026-04-05',
        UserCode: 'U001',
        RecordDate: '2026-04-05',
        Status: 'present',
        CheckInAt: '2026-04-05T09:00:00+09:00',
        CheckOutAt: '2026-04-05T15:00:00+09:00',
      });

      expect(mockProvider.createItem).toHaveBeenCalledTimes(1);
      const payload = mockProvider.createItem.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).toHaveProperty('CheckInAt');
      expect(payload).not.toHaveProperty('CheckOutAt');
      expect(payload).toMatchObject({
        Title: 'U001_2026-04-05',
        UserCode: 'U001',
        RecordDate: '2026-04-05',
        Status: 'present',
      });
    });
  });

  describe('Mapping Logic (toAttendanceUser / toAttendanceDaily)', () => {
    it('maps minimal data with only ID and Title/UserCode', async () => {
       mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserCode', 'Title']));
       mockProvider.listItems.mockResolvedValue([{ Id: 10, UserCode: 'MIN-01', Title: 'Minimal User' }]);

       const users = await repository.getActiveUsers();
       expect(users[0]).toMatchObject({
         Id: 10,
         UserCode: 'MIN-01',
         Title: 'Minimal User',
         IsActive: true // Defaulted
       });
    });

    it('filters out invalid rows (missing core data)', async () => {
       mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserCode', 'Title']));
       mockProvider.listItems.mockResolvedValue([
         { Id: 1, UserCode: '', Title: 'No Code' }, // Should be filtered out
         { Id: 2, UserCode: 'U02', Title: '' },      // Should be filtered out
         { Id: 3, UserCode: 'U03', Title: 'Valid' }  // Should remain
       ]);

       const users = await repository.getActiveUsers();
       expect(users.length).toBe(1);
       expect(users[0].UserCode).toBe('U03');
    });
  });

  describe('Observation Temperature Resilience', () => {
    it('handles various temperature field name variations', async () => {
      // Setup: Temp field is 'Temp', User field is 'UserLookupId'
      mockProvider.getFieldInternalNames.mockResolvedValue(new Set(['Id', 'UserLookupId', 'ObservedAt', 'Temp']));
      mockProvider.listItems.mockResolvedValue([
        { Id: 1, UserLookupId: 50, ObservedAt: '2024-03-01', Temp: 36.5 }
      ]);

      const obs = await repository.getObservationsByDate('2024-03-01');
      expect(obs.length).toBe(1);
      expect(obs[0].temperature).toBe(36.5);
      expect(obs[0].userLookupId).toBe(50);
    });
  });
});
