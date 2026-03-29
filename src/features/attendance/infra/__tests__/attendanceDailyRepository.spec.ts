import { describe, expect, it, vi } from 'vitest';
import type { createSpClient } from '@/lib/spClient';
import { ATTENDANCE_DAILY_FIELDS } from '@/sharepoint/fields';
import {
  getDailyByDate,
  upsertDailyByKey,
  type AttendanceDailyItem,
} from '../attendanceDailyRepository';

const createMockClient = () => ({
  getListItemsByTitle: vi.fn(),
  getListFieldInternalNames: vi.fn(),
  addListItemByTitle: vi.fn(),
  getItemByIdWithEtag: vi.fn(),
  updateItemByTitle: vi.fn(),
});

describe('attendanceDailyRepository', () => {
  it('queries by RecordDate without selecting legacy Key field', async () => {
    const listTitle = 'AttendanceDaily_Main';
    const client = createMockClient();
    client.getListFieldInternalNames.mockResolvedValue(
      new Set(['Title', 'UserCode', 'RecordDate', 'Status']),
    );
    client.getListItemsByTitle.mockResolvedValue([
      {
        Id: 1,
        Title: 'U001|2026-03-29',
        UserCode: 'U001',
        RecordDate: '2026-03-29',
        Status: 'present',
      },
    ]);

    const rows = await getDailyByDate(
      client as unknown as ReturnType<typeof createSpClient>,
      '2026-03-29',
      listTitle,
    );

    expect(client.getListItemsByTitle).toHaveBeenCalledTimes(1);
    const [calledListTitle, select, filter] = client.getListItemsByTitle.mock.calls[0];
    expect(calledListTitle).toBe(listTitle);
    expect(select).toContain(ATTENDANCE_DAILY_FIELDS.key);
    expect(select).not.toContain(ATTENDANCE_DAILY_FIELDS.legacyKey);
    expect(filter).toBe("RecordDate eq '2026-03-29'");
    expect(rows[0]?.Key).toBe('U001|2026-03-29');
  });

  it('falls back to legacy Key value when Title is missing', async () => {
    const listTitle = 'AttendanceDaily_Legacy';
    const client = createMockClient();
    client.getListFieldInternalNames.mockResolvedValue(
      new Set(['Key', 'UserCode', 'RecordDate', 'Status']),
    );
    client.getListItemsByTitle.mockResolvedValue([
      {
        Id: 1,
        Key: 'U002|2026-03-29',
        UserCode: 'U002',
        RecordDate: '2026-03-29',
        Status: 'present',
      },
    ]);

    const rows = await getDailyByDate(
      client as unknown as ReturnType<typeof createSpClient>,
      '2026-03-29',
      listTitle,
    );

    expect(rows[0]?.Key).toBe('U002|2026-03-29');
  });

  it('upserts using Title as key filter and payload key field', async () => {
    const listTitle = 'AttendanceDaily_Upsert';
    const client = createMockClient();
    client.getListFieldInternalNames.mockResolvedValue(
      new Set(['Title', 'UserCode', 'RecordDate', 'Status']),
    );
    client.getListItemsByTitle.mockResolvedValue([]);
    client.addListItemByTitle.mockResolvedValue({ Id: 99 });

    const item: AttendanceDailyItem = {
      Key: 'U003|2026-03-29',
      UserCode: 'U003',
      RecordDate: '2026-03-29',
      Status: 'present',
      CntAttendIn: 1,
      CntAttendOut: 1,
    };

    await upsertDailyByKey(
      client as unknown as ReturnType<typeof createSpClient>,
      item,
      listTitle,
    );

    const [, , filter] = client.getListItemsByTitle.mock.calls[0];
    expect(filter).toBe("Title eq 'U003|2026-03-29'");
    expect(client.addListItemByTitle).toHaveBeenCalledWith(
      listTitle,
      expect.objectContaining({
        Title: 'U003|2026-03-29',
      }),
    );
    expect(client.addListItemByTitle.mock.calls[0]?.[1]).not.toHaveProperty('Key');
  });

  it('returns empty list when required schema fields are not found', async () => {
    const client = createMockClient();
    client.getListFieldInternalNames.mockResolvedValue(new Set(['Title', 'RecordDate', 'Status']));

    const rows = await getDailyByDate(
      client as unknown as ReturnType<typeof createSpClient>,
      '2026-03-29',
      'AttendanceDaily_BrokenSchema',
    );

    expect(rows).toEqual([]);
    expect(client.getListItemsByTitle).not.toHaveBeenCalled();
  });
});
