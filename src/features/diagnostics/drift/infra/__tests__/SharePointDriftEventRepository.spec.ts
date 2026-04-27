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
        'LoggedAt',
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
      LoggedAt: expect.any(String),
      Severity: 'warn',
      ResolutionType: 'fallback',
      Resolved: false,
    });
    expect(payload).not.toHaveProperty('DriftType');
  });

  it('records field as blocked and retries once with required-only payload on 400 error', async () => {
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
      getSchema: vi.fn(async () => [
        'ListName',
        'FieldName',
        'DetectedAt',
        'LoggedAt',
        'Severity',
        'ResolutionType',
        'DriftType',
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

    expect(createItem).toHaveBeenCalledTimes(2);
    const initialPayload = createItem.mock.calls[0][1];
    const fallbackPayload = createItem.mock.calls[1][1];
    expect(initialPayload).toHaveProperty('DriftType', 'suffix_mismatch');
    expect(fallbackPayload).not.toHaveProperty('DriftType');
    expect(fallbackPayload).toHaveProperty('LoggedAt');
  });

  it('uses stable required duplicate keys when schema fetch is unavailable and optional write fails', async () => {
    const badRequest = Object.assign(
      new Error("フィールドまたはプロパティ 'Severity' は存在しません。"),
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
      getSchema: vi.fn(async () => []),
      getListFieldInternalNames: vi.fn(async () => new Set<string>()),
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
    const initialPayload = createItem.mock.calls[0][1];
    const fallbackPayload = createItem.mock.calls[1][1];
    expect(initialPayload).toHaveProperty('List_x0020_Name', 'Daily_Attendance');
    expect(initialPayload).toHaveProperty('ListName', 'Daily_Attendance');
    expect(initialPayload).toHaveProperty('Field_x0020_Name', 'Status');
    expect(initialPayload).toHaveProperty('FieldName', 'Status');
    expect(initialPayload).toHaveProperty('Detected_x0020_At', '2026-04-05T00:00:00.000Z');
    expect(initialPayload).toHaveProperty('DetectedAt', '2026-04-05T00:00:00.000Z');
    expect(initialPayload).toHaveProperty('Logged_x0020_At');
    expect(initialPayload).not.toHaveProperty('NameOfList');
    expect(initialPayload).toHaveProperty('Severity', 'warn');

    expect(fallbackPayload).not.toHaveProperty('Severity');
    expect(fallbackPayload).toHaveProperty('List_x0020_Name', 'Daily_Attendance');
    expect(fallbackPayload).toHaveProperty('ListName', 'Daily_Attendance');
    expect(fallbackPayload).toHaveProperty('Field_x0020_Name', 'Status');
    expect(fallbackPayload).toHaveProperty('FieldName', 'Status');
    expect(fallbackPayload).toHaveProperty('Detected_x0020_At', '2026-04-05T00:00:00.000Z');
    expect(fallbackPayload).toHaveProperty('DetectedAt', '2026-04-05T00:00:00.000Z');
    expect(fallbackPayload).toHaveProperty('Logged_x0020_At');
    expect(fallbackPayload).not.toHaveProperty('NameOfList');
  });

  it('fails fast without retry when 400 does not identify a field', async () => {
    const badRequest = Object.assign(
      new Error("JSON リーダーから読み取り中に予期しない 'StartObject' ノードが見つかりました。"),
      { status: 400 },
    );
    const createItem = vi.fn().mockRejectedValueOnce(badRequest);

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

    expect(createItem).toHaveBeenCalledTimes(1);
  });

  it('writes duplicate required encoded/plain fields when both exist in list schema', async () => {
    const createItem = vi.fn(async (_listTitle: string, _payload: Record<string, unknown>) => ({}));
    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
      getSchema: vi.fn(async () => [
        'List_x0020_Name',
        'ListName',
        'Field_x0020_Name',
        'FieldName',
        'Detected_x0020_At',
        'DetectedAt',
        'Logged_x0020_At',
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
      List_x0020_Name: 'Daily_Attendance',
      ListName: 'Daily_Attendance',
      Field_x0020_Name: 'Status',
      FieldName: 'Status',
      Detected_x0020_At: '2026-04-05T00:00:00.000Z',
      DetectedAt: '2026-04-05T00:00:00.000Z',
      Logged_x0020_At: expect.any(String),
    });
    expect(payload).not.toHaveProperty('Severity');
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
    expect(filter).not.toContain(`OccurredAt ge datetime'${since}'`);
    expect(orderby).toBe('Id desc');

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

  it('falls back to Id-desc scan when filtered query hits list view threshold', async () => {
    const thresholdError = Object.assign(
      new Error('The attempted operation is prohibited because it exceeds the list view threshold.'),
      { status: 500 },
    );
    const getListItemsByTitle = vi
      .fn()
      .mockRejectedValueOnce(thresholdError)
      .mockResolvedValueOnce([
        {
          ID: 21,
          NameOfList: 'Daily_Attendance',
          InternalName: 'Status0',
          OccurredAt: '2026-04-10T10:00:00.000Z',
          Resolution: 'fallback',
          Category: 'suffix_mismatch',
          IsResolved: false,
          Level: 'warn',
        },
        {
          ID: 20,
          NameOfList: 'Other_List',
          InternalName: 'Unused',
          OccurredAt: '2026-04-01T10:00:00.000Z',
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

    const since = '2026-04-03T00:00:00.000Z';
    const events = await repo.getEvents({
      listName: 'Daily_Attendance',
      resolved: false,
      since,
    });

    expect(getListItemsByTitle).toHaveBeenCalledTimes(2);
    expect(getListItemsByTitle.mock.calls[0][2]).not.toContain(`OccurredAt ge datetime'${since}'`);
    expect(getListItemsByTitle.mock.calls[0][3]).toBe('Id desc');
    expect(getListItemsByTitle.mock.calls[1][2]).toBeUndefined();
    expect(getListItemsByTitle.mock.calls[1][3]).toBe('Id desc');
    expect(getListItemsByTitle.mock.calls[1][4]).toBe(200);
    expect(events).toEqual([
      {
        id: '21',
        listName: 'Daily_Attendance',
        fieldName: 'Status0',
        detectedAt: '2026-04-10T10:00:00.000Z',
        severity: 'warn',
        resolutionType: 'fallback',
        driftType: 'suffix_mismatch',
        resolved: false,
      },
    ]);
  });

  it('falls back to Id-desc scan when threshold error is reported in Japanese locale', async () => {
    const thresholdError = Object.assign(
      new Error('この操作は、リストビューのしきい値を超えているため実行できません。'),
      { status: 500 },
    );
    const getListItemsByTitle = vi
      .fn()
      .mockRejectedValueOnce(thresholdError)
      .mockResolvedValueOnce([
        {
          ID: 31,
          NameOfList: 'Daily_Attendance',
          InternalName: 'Status0',
          OccurredAt: '2026-04-12T10:00:00.000Z',
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

    const events = await repo.getEvents({ listName: 'Daily_Attendance' });

    expect(getListItemsByTitle).toHaveBeenCalledTimes(2);
    expect(getListItemsByTitle.mock.calls[1][2]).toBeUndefined();
    expect(getListItemsByTitle.mock.calls[1][3]).toBe('Id desc');
    expect(getListItemsByTitle.mock.calls[1][4]).toBe(200);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('31');
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
