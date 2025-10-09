import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createUserCare, getUserCareById, getUserCareSchedules, updateUserCare } from '../spClient.schedule';
import type { ScheduleUserCare } from '../types';
import type { UseSP } from '@/lib/spClient';

const buildSharePointItem = (overrides: Partial<Record<string, unknown>> = {}) => ({
  Id: 1,
  Title: '外部ケア',
  EventDate: '2025-10-03T01:00:00.000Z',
  EndDate: '2025-10-03T04:00:00.000Z',
  AllDay: false,
  Location: '応接室',
  Status: '草稿',
  Notes: '備考メモ',
  RecurrenceJson: null,
  RecurrenceData: null,
  RRule: null,
  StaffIdId: null,
  UserIdId: null,
  cr014_category: 'User',
  cr014_serviceType: '一時ケア',
  cr014_personType: 'External',
  cr014_externalPersonName: '山本 さくら',
  cr014_externalPersonOrg: 'つぐみ会',
  cr014_externalPersonContact: '080-1111-2222',
  cr014_staffIds: JSON.stringify(['101']),
  cr014_staffNames: JSON.stringify(['坂元']),
  cr014_dayKey: '20251003',
  cr014_fiscalYear: '2025',
  '@odata.etag': 'W/"2"',
  ...overrides,
});

describe('schedule SharePoint client (user-care)', () => {
  let spFetchMock: ReturnType<typeof vi.fn>;
  let sp: UseSP;

  beforeEach(() => {
    spFetchMock = vi.fn();
    sp = { spFetch: spFetchMock } as unknown as UseSP;
  });

  test('create → get → update flow', async () => {
    let storedNotes = '備考メモ';
    spFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      const url = String(path);
      if (init?.method === 'POST') {
        storedNotes = '備考メモ';
        return new Response(JSON.stringify(buildSharePointItem({ '@odata.etag': 'W/"1"' })), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (init?.method === 'PATCH') {
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
        if (typeof body.Notes === 'string') {
          storedNotes = body.Notes;
        }
        return new Response(null, { status: 204 });
      }
      if (url.includes('/items(1)')) {
        return new Response(JSON.stringify(buildSharePointItem({ Notes: storedNotes })), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const draft: ScheduleUserCare = {
      id: '',
      etag: '',
      category: 'User',
      title: '外部ケア',
      start: '2025-10-03T01:00:00.000Z',
      end: '2025-10-03T04:00:00.000Z',
      allDay: false,
      status: '下書き',
      serviceType: '一時ケア',
      personType: 'External',
      staffIds: ['101'],
      staffNames: undefined,
      personId: undefined,
      personName: undefined,
      externalPersonName: '山本 さくら',
      externalPersonOrg: undefined,
      externalPersonContact: undefined,
      notes: '備考メモ',
      location: undefined,
      recurrenceRule: undefined,
      dayKey: undefined,
      fiscalYear: undefined,
    };

    const created = await createUserCare(sp, draft);

    expect(created.id).toBe('1');
    expect(created.externalPersonName).toBe('山本 さくら');

    const fetched = await getUserCareById(sp, created.id);
    expect(fetched.notes).toBe('備考メモ');

    const updated = await updateUserCare(sp, { ...fetched, notes: 'メモ追記' });
    expect(updated.notes).toBe('メモ追記');

    const patchCall = spFetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
    expect(patchCall).toBeTruthy();
    const getCalls = spFetchMock.mock.calls.filter(([, init]) => !(init as RequestInit | undefined)?.method);
    expect(getCalls.length).toBeGreaterThan(0);
  });

  test('range search builds overlap filter', async () => {
    const item = buildSharePointItem();
    spFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: [item] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const results = await getUserCareSchedules(sp, {
      start: '2025-10-03T00:00:00.000Z',
      end: '2025-10-04T00:00:00.000Z',
      keyword: '外部',
      personType: 'External',
      serviceType: '一時ケア',
    });

    expect(results).toHaveLength(1);
    const [path] = spFetchMock.mock.calls[0] as [string];
    const url = new URL(path, 'https://example.contoso.sharepoint.com');
    const filter = url.searchParams.get('$filter') ?? '';

    expect(filter).not.toEqual('');
    expect(filter).toContain("EventDate lt datetime'2025-10-04T00:00:00.000Z'");
  expect(filter).toContain("(cr014_personType eq 'External')");
  });
});
