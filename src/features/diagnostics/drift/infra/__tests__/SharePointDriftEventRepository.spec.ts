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
    const [, payload, options] = createItem.mock.calls[0];
    expect(options).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    expect(payload).toMatchObject({
      Title: 'Daily_Attendance:Status',
      ListName: 'Daily_Attendance',
      FieldName: 'Status',
      DetectedAt: '2026-04-05',
      LoggedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
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
    expect(createItem.mock.calls[0][2]).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    expect(createItem.mock.calls[1][2]).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    const initialPayload = createItem.mock.calls[0][1];
    const fallbackPayload = createItem.mock.calls[1][1];
    expect(initialPayload).toHaveProperty('DriftType', 'suffix_mismatch');
    expect(fallbackPayload).not.toHaveProperty('DriftType');
    expect(fallbackPayload).toHaveProperty('LoggedAt');
  });

  it('sends only Title when schema fetch is unavailable (strict pre-flight to avoid 400)', async () => {
    const createItem = vi.fn().mockResolvedValueOnce({});

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

    expect(createItem).toHaveBeenCalledTimes(1);
    const [, payload] = createItem.mock.calls[0];
    expect(payload).toEqual({ Title: 'Daily_Attendance:Status' });
  });

  it('retries once with required-only payload when 400 does not identify a field', async () => {
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
      getSchema: vi.fn(async () => ['Severity', 'ListName', 'FieldName', 'DetectedAt', 'LoggedAt']),
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
    expect(createItem.mock.calls[0][2]).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    expect(createItem.mock.calls[1][2]).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    const initialPayload = createItem.mock.calls[0][1];
    const fallbackPayload = createItem.mock.calls[1][1];
    expect(initialPayload).toHaveProperty('Severity', 'warn');
    expect(fallbackPayload).not.toHaveProperty('Severity');
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
    const [, payload, options] = createItem.mock.calls[0];
    expect(options).toMatchObject({ spOptions: { quietStatuses: [400], silent: true } });
    expect(payload).toMatchObject({
      Title: 'Daily_Attendance:Status',
      List_x0020_Name: 'Daily_Attendance',
      ListName: 'Daily_Attendance',
      Field_x0020_Name: 'Status',
      FieldName: 'Status',
      Detected_x0020_At: '2026-04-05',
      DetectedAt: '2026-04-05',
      Logged_x0020_At: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(payload).not.toHaveProperty('Severity');
  });

  it('suppresses subsequent writes after required-only fallback also returns 400', async () => {
    const badRequest = Object.assign(
      new Error('無効な日付です。'),
      { status: 400 },
    );
    const createItem = vi
      .fn()
      .mockRejectedValueOnce(badRequest)
      .mockRejectedValueOnce(badRequest);

    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
      getSchema: vi.fn(async () => [
        'List_x0020_Name',
        'Field_x0020_Name',
        'Detected_x0020_At',
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

    await repo.logEvent({
      listName: 'Daily_Attendance',
      fieldName: 'Status2',
      detectedAt: '2026-04-05T00:00:00.000Z',
      severity: 'warn',
      resolutionType: 'fallback',
      driftType: 'suffix_mismatch',
      resolved: false,
    });

    // first event: optional payload + required-only fallback (2 calls)
    // second event: writeDisabled=true で送信抑制
    expect(createItem).toHaveBeenCalledTimes(2);
  });

  it('skips POST when required drift-log columns cannot be resolved from schema', async () => {
    const createItem = vi.fn(async () => ({}));
    const repo = new SharePointDriftEventRepository({
      createItem,
      updateItemByTitle: vi.fn(async () => ({})),
      getListItemsByTitle: vi.fn(async () => []),
      getSchema: vi.fn(async () => ['Title', 'Severity', 'DriftType']),
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

    expect(createItem).not.toHaveBeenCalled();
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

  it('falls back to minimum (Id,Title) select when 400 field name cannot be extracted', async () => {
    const unparseable400 = Object.assign(
      new Error('Bad Request'),
      { status: 400 },
    );
    const getListItemsByTitle = vi
      .fn()
      .mockRejectedValueOnce(unparseable400)
      .mockResolvedValueOnce([
        { ID: 51, Title: 'Daily_Attendance:Status' },
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

    const events = await repo.getEvents();

    expect(getListItemsByTitle).toHaveBeenCalledTimes(2);
    const fallbackSelect = getListItemsByTitle.mock.calls[1][1];
    expect(fallbackSelect).toEqual(['Id', 'Title']);
    expect(events).toEqual([
      {
        id: '51',
        listName: '',
        fieldName: '',
        detectedAt: '',
        severity: 'info',
        resolutionType: 'fuzzy_match',
        driftType: 'unknown',
        resolved: false,
      },
    ]);
  });

  it('falls back to minimum (Id,Title) select when 400 names a field absent from the select', async () => {
    const phantom400 = Object.assign(
      new Error("フィールドまたはプロパティ '_Level' は存在しません。"),
      { status: 400 },
    );
    const getListItemsByTitle = vi
      .fn()
      .mockRejectedValueOnce(phantom400)
      .mockResolvedValueOnce([{ ID: 61, Title: 'Daily:Status' }]);

    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle: vi.fn(async () => ({})),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getListItemsByTitle: getListItemsByTitle as any,
      // schema does NOT contain `_Level`, so the initial select cannot include it,
      // yet SharePoint still complains about it (e.g. evaluated through computed columns).
      getSchema: vi.fn(async () => [
        'ListName',
        'FieldName',
        'DetectedAt',
        'Severity',
        'Resolved',
      ]),
    });

    const events = await repo.getEvents();

    expect(getListItemsByTitle).toHaveBeenCalledTimes(2);
    expect(getListItemsByTitle.mock.calls[1][1]).toEqual(['Id', 'Title']);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('61');
  });

  it('returns empty array when even the minimum (Id,Title) fallback fails', async () => {
    const unparseable400 = Object.assign(new Error('Bad Request'), { status: 400 });
    const getListItemsByTitle = vi
      .fn()
      .mockRejectedValueOnce(unparseable400)
      .mockRejectedValueOnce(new Error('still broken'));

    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle: vi.fn(async () => ({})),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getListItemsByTitle: getListItemsByTitle as any,
      getSchema: vi.fn(async () => ['ListName', 'FieldName', 'DetectedAt']),
    });

    await expect(repo.getEvents()).resolves.toEqual([]);
    expect(getListItemsByTitle).toHaveBeenCalledTimes(2);
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

  it('excludes underscore-prefixed system fields (e.g. _Level) from $select even when present in schema', async () => {
    const getListItemsByTitle = vi.fn(async () => [] as Record<string, unknown>[]);

    const repo = new SharePointDriftEventRepository({
      createItem: vi.fn(async () => ({})),
      updateItemByTitle: vi.fn(async () => ({})),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getListItemsByTitle: getListItemsByTitle as any,
      // SP の DriftEventsLog_v2 では Severity 列は存在せず、組み込み hidden 列の
      // `_Level` (OData__Level) のみが返ってくる。これを $select に乗せると 400 になる。
      getSchema: vi.fn(async () => [
        'List_x0020_Name',
        'Field_x0020_Name',
        'Detected_x0020_At',
        'DriftType',
        '_Level',
        '_ModerationStatus',
      ]),
    });

    await repo.getEvents();

    expect(getListItemsByTitle).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const select = (getListItemsByTitle as any).mock.calls[0][1] as string[];
    expect(select).not.toContain('_Level');
    expect(select).not.toContain('_ModerationStatus');
    expect(select).toEqual(expect.arrayContaining(['Id', 'Title']));
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
    }, { spOptions: { quietStatuses: [400], silent: true } });
  });
});
