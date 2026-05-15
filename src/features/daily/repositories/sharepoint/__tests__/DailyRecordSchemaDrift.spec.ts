import { describe, expect, it, vi } from 'vitest';
import { DailyRecordSchemaResolver } from '../modules/SchemaResolver';
import { SharePointDailyRecordRepository } from '../SharePointDailyRecordRepository';
import type { TableDailyRecord } from '../../../domain/types';

const jsonResponse = (value: unknown): Response =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('DailyRecord Schema Drift & Dynamic Resolution', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_E2E', '0');
  });

  it('SchemaResolver successfully resolves parent fields when date column is Date instead of RecordDate', async () => {
    const spFetch = vi.fn(async (path: string) => {
      if (path.includes('lists?$select=Title')) {
        return jsonResponse({ value: [{ Title: 'SupportRecord_Daily' }] });
      }
      if (path.includes('fields')) {
        return jsonResponse({
          value: [
            { InternalName: 'Id' },
            { InternalName: 'Title' },
            { InternalName: 'Date' }, // Drifting column
            { InternalName: 'ReporterName' },
            { InternalName: 'UserCount' },
            { InternalName: 'UserRowsJSON' },
          ],
        });
      }
      return jsonResponse({ value: [] });
    });

    const resolver = new DailyRecordSchemaResolver(spFetch);
    const resolved = await resolver.resolveParentFields("lists/getbytitle('SupportRecord_Daily')");

    expect(resolved.recordDate).toBe('Date');
    expect(resolved.title).toBe('Title');
    expect(resolved.userRowsJSON).toBe('UserRowsJSON');
  });

  it('Saver / DailyRecord repository uses resolvedParentFields.recordDate in save payload instead of hardcoded RecordDate', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    const spFetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('lists?$select=Title')) {
        return jsonResponse({ value: [{ Title: 'SupportRecord_Daily' }] });
      }
      if (path.includes('fields')) {
        return jsonResponse({
          value: [
            { InternalName: 'Id' },
            { InternalName: 'Title' },
            { InternalName: 'Date' }, // Drifting column
            { InternalName: 'ReporterName' },
            { InternalName: 'UserCount' },
            { InternalName: 'UserRowsJSON' },
            { InternalName: 'LatestVersion' },
          ],
        });
      }
      if (path.includes('items?$filter=')) {
        return jsonResponse({ value: [] }); // No existing item -> POST create
      }
      if (path.endsWith('/items') && init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
        return jsonResponse({ d: { Id: 100 } });
      }
      if (path.includes('items(')) {
        return jsonResponse({ d: { Id: 100 } });
      }
      return jsonResponse({ value: [] });
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    const record: TableDailyRecord = {
      id: '2026-05-14',
      date: '2026-05-14',
      reporter: { name: 'Test Reporter', role: 'Staff' },
      userRows: [],
      userCount: 0,
      status: 'draft',
    };

    await repo.save(record);

    expect(capturedBody).toBeDefined();
    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.Date).toContain('2026-05-14');
    expect(capturedBody!.RecordDate).toBeUndefined();
  });

  it('persists recordDate to DailyRecordRows child payload via resolved rows date field', async () => {
    const childBodies: Record<string, unknown>[] = [];

    const spFetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes('lists?$select=Title')) {
        return jsonResponse({
          value: [
            { Title: 'SupportRecord_Daily' },
            { Title: 'DailyRecordRows' },
          ],
        });
      }
      if (path.includes("lists/getbytitle('SupportRecord_Daily')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'Title' },
            { InternalName: 'Date' },
            { InternalName: 'ReporterName' },
            { InternalName: 'ReporterRole' },
            { InternalName: 'UserRowsJSON' },
            { InternalName: 'UserCount' },
          ],
        });
      }
      if (path.includes("lists/getbytitle('DailyRecordRows')/fields")) {
        return jsonResponse({
          value: [
            { InternalName: 'ParentID' },
            { InternalName: 'UserID' },
            { InternalName: 'Date' },
            { InternalName: 'Status' },
            { InternalName: 'Observation' },
            { InternalName: 'Recorded_x0020_At' },
          ],
        });
      }
      if (path.includes("lists/getbytitle('SupportRecord_Daily')/items?$filter=")) {
        return jsonResponse({ value: [] });
      }
      if (path.includes("lists/getbytitle('SupportRecord_Daily')/items") && init?.method === 'POST' && !path.includes('items(')) {
        return jsonResponse({ Id: 9001 });
      }
      if (path.includes("lists/getbytitle('SupportRecord_Daily')/items(") && init?.method === 'POST') {
        return new Response(null, { status: 204 });
      }
      if (path.includes("lists/getbytitle('DailyRecordRows')/items?$filter=")) {
        return jsonResponse({ value: [] });
      }
      if (path.includes("lists/getbytitle('DailyRecordRows')/items") && init?.method === 'POST') {
        childBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({ Id: 10001 });
      }
      return jsonResponse({ value: [] });
    });

    const repo = new SharePointDailyRecordRepository({
      spFetch,
      listTitle: 'SupportRecord_Daily',
    });

    await repo.save({
      id: '2026-05-15',
      date: '2026-05-15',
      reporter: { name: 'Reporter', role: 'Staff' },
      userRows: [
        {
          userId: 'I005',
          userName: '石渡',
          amActivity: '活動',
          pmActivity: '',
          lunchAmount: '',
          problemBehavior: {
            selfHarm: false,
            otherInjury: false,
            loudVoice: false,
            pica: false,
            other: false,
          },
          specialNotes: '',
          behaviorTags: [],
        },
      ],
      userCount: 1,
      status: 'draft',
    });

    expect(childBodies.length).toBeGreaterThan(0);
    expect(childBodies[0].Date).toContain('2026-05-15');
    expect(childBodies[0].UserID).toBe('I005');
  });
});
