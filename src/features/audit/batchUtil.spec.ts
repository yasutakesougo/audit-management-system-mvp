import { describe, it, expect } from 'vitest';
import { buildBatchInsertBody } from './batchUtil';

describe('buildBatchInsertBody', () => {
  it('creates boundaries and includes all items', () => {
    const base = {
      ts: new Date().toISOString(),
      actor: 'user',
      action: 'CREATE',
      entity: 'Thing',
      entity_id: null,
      channel: 'UI' as const,
      after_json: null,
      entry_hash: 'hash'
    };
    const items = [ { Title: 'A', ...base }, { Title: 'B', ...base } ];
    const { body, boundary } = buildBatchInsertBody('ListName', items, '/sites/demo');
    expect(boundary).toMatch(/^batch_/);
    // Boundary present
    expect(body).toContain(`--${boundary}`);
    // changeset boundary exists
    const match = body.match(/multipart\/mixed; boundary=(changeset_[A-Za-z0-9-]+)/);
    expect(match).not.toBeNull();
    const changesetBoundary = match![1];
    // Each item appears once
    items.forEach(it => {
      expect(body).toContain(JSON.stringify(it));
    });
    // Closing markers
    expect(body).toContain(`--${changesetBoundary}--`);
    expect(body.trim().endsWith(`--${boundary}--`)).toBe(true);
  });
});
