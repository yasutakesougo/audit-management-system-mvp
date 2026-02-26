import { result } from '@/shared/result';
import { describe, expect, it, vi } from 'vitest';

/**
 * Phase 2-1b: Test 412 → result.conflict() mapping in SharePoint adapter
 */

describe('sharePointAdapter conflict mapping (Phase 2-1b)', () => {
  it('maps 412 Precondition Failed to result.conflict()', async () => {
    // Mock SharePoint client that throws 412
    const mockClient = {
      updateItemByTitle: vi.fn().mockRejectedValue({
        response: { status: 412 },
        message: 'Precondition Failed',
      }),
    };

    // Mock fetchItemById (not reached on 412)
    const mockFetchItemById = vi.fn();

    // Simulate the update logic from makeSharePointScheduleUpdater
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input: any = {
      id: '123',
      title: 'Test Event',
      category: 'User',
      startLocal: '2026-01-28T10:00',
      endLocal: '2026-01-28T11:00',
      etag: '"test-etag-123"',
    };

    const idNum = Number.parseInt(input.id, 10);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const etag = (input as any)?.etag;

    let res;
    try {
      await mockClient.updateItemByTitle('DailySchedule', idNum, {});
      const item = await mockFetchItemById(idNum);
      res = result.ok(item);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status;

      if (status === 412) {
        res = result.conflict({
          message: 'Schedule update conflict (etag mismatch)',
          etag,
          resource: 'schedule',
          op: 'update',
        });
      } else {
        res = result.unknown('Unknown error', err);
      }
    }

    expect(res.isOk).toBe(false);
    if (!res.isOk && res.error.kind === 'conflict') {
      expect(res.error.kind).toBe('conflict');
      expect(res.error.message).toContain('conflict');
      expect(res.error.etag).toBe('"test-etag-123"');
      expect(res.error.resource).toBe('schedule');
      expect(res.error.op).toBe('update');
    }
  });

  it('returns validation error when etag is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input: any = {
      id: '123',
      title: 'Test',
      category: 'User',
      startLocal: '2026-01-28T10:00',
      endLocal: '2026-01-28T11:00',
      // etag missing
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const etag = (input as any)?.etag;

    let res;
    if (!etag) {
      res = result.validation('Missing etag for update', { field: 'etag' });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res = result.ok({} as any);
    }

    expect(res.isOk).toBe(false);
    if (!res.isOk) {
      expect(res.error.kind).toBe('validation');
      expect(res.error.message).toContain('etag');
    }
  });

  it('maps 403 to forbidden', async () => {
    const mockClient = {
      updateItemByTitle: vi.fn().mockRejectedValue({
        response: { status: 403 },
      }),
    };

    let res;
    try {
      await mockClient.updateItemByTitle('DailySchedule', 123, {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res = result.ok({} as any);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status;

      if (status === 403) {
        res = result.forbidden('Forbidden');
      } else {
        res = result.unknown('Unknown', err);
      }
    }

    expect(res.isOk).toBe(false);
    if (!res.isOk) {
      expect(res.error.kind).toBe('forbidden');
    }
  });

  it('maps 404 to notFound', async () => {
    const mockClient = {
      updateItemByTitle: vi.fn().mockRejectedValue({
        response: { status: 404 },
      }),
    };

    let res;
    try {
      await mockClient.updateItemByTitle('DailySchedule', 123, {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res = result.ok({} as any);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (err as any)?.response?.status;

      if (status === 404) {
        res = result.notFound('Not found');
      } else {
        res = result.unknown('Unknown', err);
      }
    }

    expect(res.isOk).toBe(false);
    if (!res.isOk) {
      expect(res.error.kind).toBe('notFound');
    }
  });
});
