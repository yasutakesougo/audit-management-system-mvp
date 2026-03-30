import { describe, expect, it, vi } from 'vitest';
import { mapSpRowToSchedule, parseSpScheduleRows, type SpScheduleRow } from './spRowSchema';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';

vi.mock('@/lib/telemetry/spTelemetry', () => ({
  trackSpEvent: vi.fn(),
}));

describe('spRowSchema - Robust Mapping', () => {
  describe('mapSpRowToSchedule', () => {
    it('handles Japanese categories and statuses', () => {
      const row = {
        Id: 1,
        Title: 'テスト予定',
        EventDate: '2024-03-01T10:00:00Z',
        EndDate: '2024-03-01T11:00:00Z',
        Category: '利用者',
        Status: '予定どおり'
      } as unknown as SpScheduleRow;
      const mapped = mapSpRowToSchedule(row);
      expect(mapped).not.toBeNull();
      expect(mapped?.category).toBe('User');
      expect(mapped?.status).toBe('Planned');
    });

    it('handles legacy Outlook format (Subject, StartDate, EndDate)', () => {
      const row = {
        Id: 2,
        Subject: '古い予定課題',
        StartDate: '2024-03-01T12:00:00Z',
        EndDate: '2024-03-01T13:00:00Z'
      } as unknown as SpScheduleRow;
      const mapped = mapSpRowToSchedule(row);
      expect(mapped).not.toBeNull();
      expect(mapped?.title).toBe('古い予定課題');
      expect(mapped?.start).toBe('2024-03-01T12:00:00.000Z');
    });

    it('handles mixed userId formats (Lookup ID vs raw string)', () => {
      // Case 1: Raw String Code
      const row1 = {
        Id: 3,
        Start: '2024-03-01T14:00:00Z',
        End: '2024-03-01T15:00:00Z',
        UserCode: 'U-001'
      } as unknown as SpScheduleRow;
      const mapped1 = mapSpRowToSchedule(row1);
      expect(mapped1?.userId).toBe('U001');

      // Case 2: SharePoint Lookup Object
      const row2 = {
        Id: 4,
        EventDate: '2024-03-01T14:00:00Z',
        EndDate: '2024-03-01T15:00:00Z',
        TargetUserId: { Id: 101, Title: 'User 101' }
      } as unknown as SpScheduleRow;
      const mapped2 = mapSpRowToSchedule(row2);
      expect(mapped2?.userId).toBe('101');
    });

    it('skips item if core dates are missing (null start/end)', () => {
      const row = {
        Id: 5,
        Title: '壊れたデータ'
        // Missing start/end
      } as unknown as SpScheduleRow;
      const mapped = mapSpRowToSchedule(row);
      expect(mapped).toBeNull();
    });

    it('absorbs partial metadata corruption', () => {
      const row = {
          Id: 6,
          Start: '2024-03-01T16:00:00Z',
          End: '2024-03-01T17:00:00Z',
          __metadata: null // Should not crash
      } as unknown as SpScheduleRow;
      const mapped = mapSpRowToSchedule(row);
      expect(mapped).not.toBeNull();
      expect(mapped?.id).toBe('6');
    });
  });

  describe('parseSpScheduleRows', () => {
    it('absorbs field-level corruption in an array', () => {
      const rows = [
        { Id: 1, Start: '2024-03-01T10:00:00Z', End: '2024-03-01T11:00:00Z' }, // Valid
        { Id: 'ID_VALUE', Start: null, End: null }, // safeParse succeeds but map will fail
        { ID_MISSING: 100 } // Will fail safeParse (missing Id)
      ] as unknown as SpScheduleRow[];
      
      const results = parseSpScheduleRows(rows);
      expect(results.length).toBe(2); 
    });

    it('emits telemetry when a row is skipped', () => {
      const rows = [
        { ID_MISSING: 100 } // Will fail safeParse
      ] as unknown as SpScheduleRow[];
      
      parseSpScheduleRows(rows);
      expect(trackSpEvent).toHaveBeenCalledWith('sp:row_skipped', expect.objectContaining({
        key: 'unknown'
      }));
    });

    it('handles various OData wrapper formats', () => {
        const odataV2 = { d: { results: [{ Id: 1, Start: '2024-01-01', End: '2024-01-01' }] } };
        const odataV4 = { value: [{ Id: 2, Start: '2024-01-01', End: '2024-01-01' }] };
        
        expect(parseSpScheduleRows(odataV2).length).toBe(1);
        expect(parseSpScheduleRows(odataV4).length).toBe(1);
    });
  });
});
