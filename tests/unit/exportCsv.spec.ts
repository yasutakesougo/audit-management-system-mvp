import { describe, it, expect } from 'vitest';
import { buildAuditCsv } from '../../src/features/audit/exportCsv';

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
    // details は JSON 文字列（ダブルクォートを含むため引用される）
  // JSON inside details should be fully quoted and inner quotes doubled
  expect(csv).toMatch(/,\"\{""ok"":true\}"$/m);
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
});
