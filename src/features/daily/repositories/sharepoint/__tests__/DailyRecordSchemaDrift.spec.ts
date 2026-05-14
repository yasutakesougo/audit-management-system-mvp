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
});
