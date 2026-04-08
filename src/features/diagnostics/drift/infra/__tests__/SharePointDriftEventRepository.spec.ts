import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SharePointDriftEventRepository } from '../SharePointDriftEventRepository';

vi.mock('@/sharepoint/spListRegistry', () => ({
  findListEntry: vi.fn(() => ({
    key: 'drift_events_log',
    resolve: () => 'DriftEventsLog',
  })),
}));

describe('SharePointDriftEventRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits optional fields missing from schema when logging', async () => {
    const createItem = vi.fn(async (_listTitle: string, _payload: Record<string, unknown>) => ({}));
    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
      getSchema: vi.fn(async () => [
        'ListName',
        'FieldName',
        'DetectedAt',
        'Severity',
        'ResolutionType',
        'Resolved',
      ]),
    });

    await repo.logEvent({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-04-05T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fallback',
      driftType: 'suffix_mismatch',
      resolved: false,
    });

    expect(createItem).toHaveBeenCalledTimes(1);
    const [, payload] = createItem.mock.calls[0];
    expect(payload).toMatchObject({
      Title: 'Daily_Attendance:Status',
      ListName: 'Daily_Attendance',
      FieldName: 'Status',
      DetectedAt: '2026-04-05T00:00:00.000Z',
      Severity: 'warn',
      ResolutionType: 'fallback',
      Resolved: false,
    });
    expect(payload).not.toHaveProperty('DriftType');
  });

  it('retries create after removing missing field returned by 400 error', async () => {
    const badRequest = Object.assign(
      new Error("フィールドまたはプロパティ 'DriftType' は存在しません。"),
      { status: 400 },
    );
    const createItem = vi
      .fn()
      .mockRejectedValueOnce(badRequest)
      .mockResolvedValueOnce({});

    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
    });

    await repo.logEvent({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-04-05T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fallback',
      driftType: 'suffix_mismatch',
      resolved: false,
    });

    expect(createItem).toHaveBeenCalledTimes(2);
    const firstPayload = createItem.mock.calls[0][1];
    const secondPayload = createItem.mock.calls[1][1];
    expect(firstPayload).toHaveProperty('DriftType', 'suffix_mismatch');
    expect(secondPayload).not.toHaveProperty('DriftType');
  });

  it('retries once with minimal payload when 400 does not identify a field', async () => {
    const badRequest = Object.assign(
      new Error("JSON リーダーから読み取り中に予期しない 'StartObject' ノードが見つかりました。"),
      { status: 400 },
    );
    const createItem = vi
      .fn()
      .mockRejectedValueOnce(badRequest)
      .mockResolvedValueOnce({});

    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
    });

    await repo.logEvent({
      listName: 'Daily_Attendance',
      fieldName: 'Status',
      detectedAt: '2026-04-05T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fallback',
      driftType: 'suffix_mismatch',
      resolved: false,
    });

    expect(createItem).toHaveBeenCalledTimes(2);
    const secondPayload = createItem.mock.calls[1][1];
    expect(secondPayload).toEqual({
      Title: 'Daily_Attendance:Status',
      ListName: 'Daily_Attendance',
      FieldName: 'Status',
      DetectedAt: '2026-04-05T00:00:00.000Z',
    });
  });

  it('applies since/resolved/list filters and maps drifted physical names', async () => {
    const getListItemsByTitle = vi.fn(async () => [
      {
        ID: 11,
        NameOfList: 'Daily_Attendance',
        InternalName: 'Status0',
        OccurredAt: '2026-04-04T01:00:00.000Z',
        Resolution: 'fallback',
        Category: 'suffix_mismatch',
        IsResolved: false,
        Level: 'warn',
      },
    ]);

    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle: vi.fn(async () => ({})),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getListItemsByTitle: getListItemsByTitle as any,
      getSchema: vi.fn(async () => [
        'NameOfList',
        'InternalName',
        'OccurredAt',
        'Level',
        'Resolution',
        'Category',
        'IsResolved',
      ]),
    });

    const since = '2026-04-04T00:00:00.000Z';
    const events = await repo.getEvents({
      listName: 'Daily_Attendance',
      resolved: false,
      since,
    });

    expect(getListItemsByTitle).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [listTitle, select, filter, orderby] = (getListItemsByTitle as any).mock.calls[0];
    expect(listTitle).toBe('DriftEventsLog');
    expect(select).toEqual(
      expect.arrayContaining(['NameOfList', 'InternalName', 'OccurredAt', 'IsResolved']),
    );
    expect(filter).toContain("NameOfList eq 'Daily_Attendance'");
    expect(filter).toContain('IsResolved eq false');
    expect(filter).toContain(`OccurredAt ge datetime'${since}'`);
    expect(orderby).toBe('OccurredAt desc');

    expect(events).toEqual([
      {
        id: '11',
        listName: 'Daily_Attendance',
        fieldName: 'Status0',
        detectedAt: '2026-04-04T01:00:00.000Z',
        severity: 'warn',
        resolutionType: 'fallback',
        driftType: 'suffix_mismatch',
        resolved: false,
      },
    ]);
  });

  it('returns empty array on fetch failure (fail-open)', async () => {
    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => {
        throw new Error('boom');
      }),
      getSchema: vi.fn(async () => ['ListName', 'FieldName', 'DetectedAt', 'Resolved']),
    });

    await expect(repo.getEvents()).resolves.toEqual([]);
  });

  it('uses resolved physical field when marking resolved', async () => {
    const updateItemByTitle = vi.fn(async () => ({}));

    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle,
      getListItemsByTitle: vi.fn(async () => []),
      getSchema: vi.fn(async () => ['IsResolved']),
    });

    await repo.markResolved('42');

    expect(updateItemByTitle).toHaveBeenCalledWith('DriftEventsLog', 42, {
      IsResolved: true,
    });
  });
});
