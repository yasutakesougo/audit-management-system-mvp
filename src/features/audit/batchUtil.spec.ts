import { describe, expect, it } from 'vitest';
import { buildBatchInsertBody } from './batchUtil';

describe('buildBatchInsertBody', () => {
  it('creates valid batch body with all items', () => {
    const base = {
      ts: new Date().toISOString(),
      actor: 'user',
      action: 'CREATE',
      entity: 'Thing',
      entity_id: null,
      channel: 'UI' as const,
      after_json: null,
      entry_hash: 'hash',
    };
    const items = [{ Title: 'A', ...base }, { Title: 'B', ...base }];

    const { body, boundary, idMap } = buildBatchInsertBody('ListName', items, '/sites/demo');

    // Batch boundary
    expect(boundary).toMatch(/^batch_/);
    expect(body).toContain(`--${boundary}`);

    // Changeset boundary
    const match = body.match(/multipart\/mixed; boundary=(changeset_[A-Za-z0-9-]+)/);
    expect(match).not.toBeNull();
    const changesetBoundary = match![1];

    // HTTP parts count should match items.length
    const httpParts = body.match(/Content-Type: application\/http/g) ?? [];
    expect(httpParts.length).toBe(items.length);

    // Each item JSON appears exactly once
    items.forEach((it, index) => {
      const json = JSON.stringify(it);
      const count = body.split(json).length - 1;
      expect(count).toBe(1);

      // Content-ID should be sequential starting from 1
      expect(body).toContain(`Content-ID: ${index + 1}`);
    });

    // URL and method should be correct (with encodeURIComponent for list title)
    expect(body).toContain(
      `POST /sites/demo/_api/web/lists/getbytitle('ListName')/items HTTP/1.1`,
    );

    // Required headers
    expect(body).toContain('Content-Type: application/json;odata=nometadata');

    // idMap should contain sequential Content-IDs
    expect(idMap).toEqual([1, 2]);

    // Closing markers
    expect(body).toContain(`--${changesetBoundary}--`);
    expect(body.trim().endsWith(`--${boundary}--`)).toBe(true);
  });

  it('handles special characters in list title with proper encoding', () => {
    const base = {
      ts: new Date().toISOString(),
      actor: 'user',
      action: 'CREATE',
      entity: 'Thing',
      entity_id: null,
      channel: 'UI' as const,
      after_json: null,
      entry_hash: 'hash',
    };
    const items = [{ Title: 'Test', ...base }];
    const listTitleWithSpaces = 'My List & More';

    const { body } = buildBatchInsertBody(listTitleWithSpaces, items, '/sites/demo');

    // Should encode the list title properly in the URL
    expect(body).toContain(
      `POST /sites/demo/_api/web/lists/getbytitle('My%20List%20%26%20More')/items HTTP/1.1`,
    );
  });

  it('handles empty items array', () => {
    const items: never[] = [];

    const { body, boundary, idMap } = buildBatchInsertBody('ListName', items, '/sites/demo');

    // Should still have proper structure
    expect(boundary).toMatch(/^batch_/);
    expect(body).toContain(`--${boundary}`);

    // No HTTP parts for empty items
    const httpParts = body.match(/Content-Type: application\/http/g) ?? [];
    expect(httpParts.length).toBe(0);

    // Empty idMap
    expect(idMap).toEqual([]);

    // Still has closing markers
    expect(body.trim().endsWith(`--${boundary}--`)).toBe(true);
  });

  it('generates unique boundaries for multiple calls', () => {
    const base = {
      ts: new Date().toISOString(),
      actor: 'user',
      action: 'CREATE',
      entity: 'Thing',
      entity_id: null,
      channel: 'UI' as const,
      after_json: null,
      entry_hash: 'hash',
    };
    const items = [{ Title: 'Test', ...base }];

    const result1 = buildBatchInsertBody('ListName', items, '/sites/demo');
    const result2 = buildBatchInsertBody('ListName', items, '/sites/demo');

    // Boundaries should be different
    expect(result1.boundary).not.toBe(result2.boundary);

    // Both should have valid changeset boundaries
    const match1 = result1.body.match(/multipart\/mixed; boundary=(changeset_[A-Za-z0-9-]+)/);
    const match2 = result2.body.match(/multipart\/mixed; boundary=(changeset_[A-Za-z0-9-]+)/);

    expect(match1).not.toBeNull();
    expect(match2).not.toBeNull();
    expect(match1![1]).not.toBe(match2![1]);
  });
});
