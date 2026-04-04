import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SharePointDailyRecordRepository } from '../SharePointDailyRecordRepository';
import { auditLog } from '../../../../../lib/debugLogger';
import { createDriftMock } from '@/test-utils/sp/createDriftMock';

describe('SharePointDailyRecordRepository Drift Immunity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves drifted internal names (e.g. RecordDate0) correctly', async () => {
    const auditSpy = vi.spyOn(auditLog, 'info');

    const spFetch = createDriftMock({
      listTitle: 'DailyRecords',
      fields: [
        { InternalName: 'Id' },
        { InternalName: 'Title' },
        { InternalName: 'RecordDate0' }, // Drifted
        { InternalName: 'UserRowsJSON' },
        { InternalName: 'Created' },
        { InternalName: 'Modified' },
      ],
      items: [{
        Id: 1,
        Title: '2026-04-04',
        RecordDate0: '2026-04-04',
        UserRowsJSON: JSON.stringify([{ userId: 'U1', specialNotes: 'test' }]),
      }],
    });

    const repo = new SharePointDailyRecordRepository({ spFetch, listTitle: 'DailyRecords' });
    const item = await repo.load('2026-04-04');

    expect(item).toBeTruthy();
    expect(item?.date).toBe('2026-04-04');
    expect(auditSpy).toHaveBeenCalledWith('sp', 'sp:fetch_fallback_success', expect.objectContaining({
      field: 'recordDate',
      driftType: 'fuzzy_match'
    }));
  });

  it('succeeds despite missing optional fields (ReporterName)', async () => {
    const auditSpy = vi.spyOn(auditLog, 'warn');
    const spFetch = createDriftMock({
      listTitle: 'DailyRecords',
      fields: [
        { InternalName: 'Id' },
        { InternalName: 'Title' },
        { InternalName: 'RecordDate' },
        { InternalName: 'UserRowsJSON' },
        // ReporterName is missing
      ],
      items: [{
        Id: 1,
        Title: '2026-04-04',
        RecordDate: '2026-04-04',
        UserRowsJSON: JSON.stringify([]),
      }],
    });

    const repo = new SharePointDailyRecordRepository({ spFetch, listTitle: 'DailyRecords' });
    const item = await repo.load('2026-04-04');

    expect(item).toBeTruthy(); // Should succeed because ReporterName is optional
    expect(auditSpy).toHaveBeenCalledWith('sp', 'sp:field_missing_optional', expect.objectContaining({
      field: 'reporterName'
    }));
  });

  it('fails if essential fields (UserRowsJSON) are missing', async () => {
    const auditSpy = vi.spyOn(auditLog, 'error');
    const spFetch = createDriftMock({
      listTitle: 'DailyRecords',
      fields: [
        { InternalName: 'Id' },
        { InternalName: 'Title' },
        { InternalName: 'RecordDate' },
        // UserRowsJSON is missing
      ],
    });

    const repo = new SharePointDailyRecordRepository({ spFetch, listTitle: 'DailyRecords' });
    const item = await repo.load('2026-04-04');

    expect(item).toBeNull(); // Should fail
    expect(auditSpy).toHaveBeenCalledWith('sp', 'sp:field_missing_essential', expect.objectContaining({
      list: 'DailyProbe',
      missingFields: expect.arrayContaining(['userRowsJSON'])
    }));
  });

  it('sends only resolved fields during write (Saver fail-open)', async () => {
    const auditSpy = vi.spyOn(auditLog, 'warn');
    const spFetch = createDriftMock({
      listTitle: 'DailyRecords',
      fields: [
        { InternalName: 'Id' },
        { InternalName: 'Title' },
        { InternalName: 'Record_x0020_Date' }, // Different name
        { InternalName: 'UserRowsJSON' },
        // ReporterName is missing
      ],
      saveResponse: { Id: 99 },
    });

    const repo = new SharePointDailyRecordRepository({ spFetch, listTitle: 'DailyRecords' });

    await repo.save({
      date: '2026-04-04',
      userRows: [],
      userCount: 0,
      reporter: {
        name: 'Somebody',
        role: 'Role',
      }
    });

    const mainPostCall = spFetch.mock.calls.find(c => 
      c[0].includes("lists/getbytitle('DailyRecords')/items") && 
      !c[0].includes("items(") && // Not specific item update
      c[1]?.method === 'POST'
    );
    
    expect(mainPostCall).toBeDefined();
    const payload = JSON.parse(mainPostCall![1]!.body as string);

    // Verify only resolved fields are present
    expect(payload).toHaveProperty('Title');
    expect(payload).toHaveProperty('Record_x0020_Date');
    expect(payload).not.toHaveProperty('ReporterName'); // Because unmapped

    expect(auditSpy).toHaveBeenCalledWith('sp', 'sp:field_missing_optional', expect.objectContaining({
      field: 'reporterName'
    }));
  });
});
