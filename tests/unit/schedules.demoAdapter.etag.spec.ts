import { demoSchedulesPort } from '@/features/schedules/data/demoAdapter';
import { describe, expect, test } from 'vitest';

describe('demoAdapter etag', () => {
  test('list items always include etag', async () => {
    const items = await demoSchedulesPort.list({
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(typeof it.etag).toBe('string');
      expect(it.etag.length).toBeGreaterThan(0);
      // Phase 2-0: etag should follow the pattern: "..." (quoted)
      expect(it.etag).toMatch(/^"[^"]*"$/);
    }
  });

  test('created items include etag', async () => {
    const result = await demoSchedulesPort.create!({
      title: 'Test Event',
      category: 'Org',
      startLocal: '2026-01-28T10:00',
      endLocal: '2026-01-28T11:00',
      serviceType: undefined,
    });

    expect(result.isOk).toBe(true);
    if (!result.isOk) return;

    const created = result.value;
    expect(typeof created.etag).toBe('string');
    expect(created.etag.length).toBeGreaterThan(0);
    expect(created.etag).toMatch(/^"[^"]*"$/);
  });

  test('updated items bump etag', async () => {
    // Create an item
    const createResult = await demoSchedulesPort.create!({
      title: 'Test Event',
      category: 'Org',
      startLocal: '2026-01-28T10:00',
      endLocal: '2026-01-28T11:00',
      serviceType: undefined,
    });

    expect(createResult.isOk).toBe(true);
    if (!createResult.isOk) return;

    const created = createResult.value;
    const etagBefore = created.etag;

    // Wait a small moment to ensure time changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update it
    const updateResult = await demoSchedulesPort.update!({
      id: created.id,
      title: 'Updated Event',
      category: 'Org',
      startLocal: '2026-01-28T10:00',
      endLocal: '2026-01-28T11:00',
      serviceType: undefined,
    });

    expect(updateResult.isOk).toBe(true);
    if (!updateResult.isOk) return;

    const updated = updateResult.value;
    const etagAfter = updated.etag;

    // etag should change on update (different timestamp)
    expect(etagAfter).not.toBe(etagBefore);
    expect(typeof etagAfter).toBe('string');
    expect(etagAfter).toMatch(/^"[^"]*"$/);
  });
});
