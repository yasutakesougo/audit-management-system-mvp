import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuditCsv, downloadCsv } from '../../src/features/audit/exportCsv';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildAuditCsv', () => {
  it('builds csv with headers and basic row', () => {
    const csv = buildAuditCsv([
      {
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'user@example.com',
        action: 'create',
        entity: 'SupportRecord_Daily',
        entity_id: 1,
        details: { ok: true }
      }
    ]);
    expect(csv).toMatch(/ts,actor,action,entity,entity_id,details/);
    expect(csv).toMatch(/2025-01-01T00:00:00.000Z,user@example.com,create,SupportRecord_Daily,1/);
  // JSON inside details should be fully quoted and inner quotes doubled
  expect(csv).toContain(',"{""ok"":true}"');
  });

  it('quotes values containing comma, quote, or newline', () => {
    const csv = buildAuditCsv([
      {
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'last, first',
        action: 'note "quoted"',
        entity: 'X\nY', // 改行
        entity_id: 'A,B',
        details: { text: 'line1\nline2, "quoted"' }
      }
    ]);
    // Header present
    expect(csv.startsWith('ts,actor,action,entity,entity_id,details')).toBe(true);
    // Actor with comma quoted
    expect(csv).toMatch(/,"last, first",/);
    // Action with internal quotes doubled
    expect(csv).toMatch(/,"note ""quoted""",/);
    // Entity with newline quoted as a single CSV field spanning newline
    expect(csv).toMatch(/,"X\nY",/);
    // entity_id with comma quoted
    expect(csv).toMatch(/,"A,B",/);
    // details JSON quoted (we just assert key and newline marker presence, escaping can vary)
    expect(csv).toMatch(/"text"/);
    expect(csv).toMatch(/line1\\nline2/);
  });

  it('treats null and undefined values as empty cells', () => {
    const csv = buildAuditCsv([
      {
        ts: null as unknown as string,
        actor: undefined as unknown as string,
        action: 'view',
        entity: 'Checklist',
        entity_id: undefined,
        details: undefined
      }
    ]);

    const [, row] = csv.split('\n');
    expect(row).toBe(',,view,Checklist,,');
  });
});

describe('downloadCsv', () => {
  it('creates an object URL, triggers click, and revokes the URL', () => {
    const anchor = document.createElement('a');
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createUrlSpy = vi.fn().mockReturnValue('blob:test');
    const revokeSpy = vi.fn();
    (URL as unknown as { createObjectURL: typeof createUrlSpy }).createObjectURL = createUrlSpy;
    (URL as unknown as { revokeObjectURL: typeof revokeSpy }).revokeObjectURL = revokeSpy;

    try {
      downloadCsv('audit.csv', 'some,csv');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createUrlSpy).toHaveBeenCalledTimes(1);
      const blobArg = createUrlSpy.mock.calls[0][0] as Blob;
      expect(blobArg.type).toBe('text/csv;charset=utf-8');
      expect(anchor.download).toBe('audit.csv');
      expect(anchor.href).toBe('blob:test');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith('blob:test');
    } finally {
      if (originalCreate) {
        (URL as unknown as { createObjectURL: typeof originalCreate }).createObjectURL = originalCreate;
      } else {
        delete (URL as unknown as { createObjectURL?: typeof createUrlSpy }).createObjectURL;
      }
      if (originalRevoke) {
        (URL as unknown as { revokeObjectURL: typeof originalRevoke }).revokeObjectURL = originalRevoke;
      } else {
        delete (URL as unknown as { revokeObjectURL?: typeof revokeSpy }).revokeObjectURL;
      }
    }
  });
});
