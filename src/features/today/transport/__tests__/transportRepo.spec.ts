/**
 * Transport Repository — Unit Tests
 *
 * Tests the SP repository layer for transport logs.
 * Uses mocked spClient to verify:
 * - loadTransportLogs: read + graceful 404
 * - saveTransportLog: upsert (create vs update) + write gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadTransportLogs, saveTransportLog, type SaveTransportLogInput } from '../transportRepo';
import { TRANSPORT_LOG_FIELDS } from '@/sharepoint/fields/transportFields';

// ─── Mock spClient ──────────────────────────────────────────────────────────

function createMockClient() {
  return {
    listItems: vi.fn().mockResolvedValue([]),
    addListItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
    updateItem: vi.fn().mockResolvedValue({}),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    getItemById: vi.fn(),
    getItemByIdWithEtag: vi.fn(),
  } as unknown as ReturnType<typeof import('@/lib/spClient').useSP>;
}

// ─── Mock env ───────────────────────────────────────────────────────────────

vi.mock('@/env', () => ({
  isWriteEnabled: true,
  isDev: false,
  isE2E: false,
  isDemo: false,
  get: vi.fn(() => ''),
  getFlag: vi.fn(() => false),
  getRuntimeEnv: vi.fn(() => ({})),
}));

describe('transportRepo', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    client = createMockClient();
    vi.clearAllMocks();
  });

  // ─── loadTransportLogs ──────────────────────────────────────────────────

  describe('loadTransportLogs', () => {
    it('should return mapped log entries for a given date', async () => {
      const mockRows = [
        {
          Id: 1,
          Title: 'U001_2026-03-13_to',
          [TRANSPORT_LOG_FIELDS.userCode]: 'U001',
          [TRANSPORT_LOG_FIELDS.direction]: 'to',
          [TRANSPORT_LOG_FIELDS.status]: 'arrived',
          [TRANSPORT_LOG_FIELDS.actualTime]: '09:15',
          [TRANSPORT_LOG_FIELDS.driverName]: '田中',
          [TRANSPORT_LOG_FIELDS.notes]: undefined,
        },
        {
          Id: 2,
          Title: 'U002_2026-03-13_to',
          [TRANSPORT_LOG_FIELDS.userCode]: 'U002',
          [TRANSPORT_LOG_FIELDS.direction]: 'to',
          [TRANSPORT_LOG_FIELDS.status]: 'pending',
        },
      ];

      (client.listItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockRows);

      const result = await loadTransportLogs(client, '2026-03-13');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        userId: 'U001',
        direction: 'to',
        status: 'arrived',
        actualTime: '09:15',
        driverName: '田中',
        notes: undefined,
      });
      expect(result[1]).toEqual({
        userId: 'U002',
        direction: 'to',
        status: 'pending',
        actualTime: undefined,
        driverName: undefined,
        notes: undefined,
      });

      // Verify correct filter was used
      expect(client.listItems).toHaveBeenCalledWith(
        'Transport_Log',
        expect.objectContaining({
          filter: "RecordDate eq '2026-03-13'",
        }),
      );
    });

    it('should return empty array when list does not exist (404)', async () => {
      const error404 = new Error('List does not exist');
      Object.assign(error404, { status: 404 });
      (client.listItems as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error404);

      const result = await loadTransportLogs(client, '2026-03-13');

      expect(result).toEqual([]);
    });

    it('should return empty array when list name error occurs', async () => {
      const error = new Error('List "Transport_Log" does not exist at site');
      (client.listItems as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const result = await loadTransportLogs(client, '2026-03-13');

      expect(result).toEqual([]);
    });

    it('should rethrow non-404 errors', async () => {
      const error500 = new Error('Internal Server Error');
      Object.assign(error500, { status: 500 });
      (client.listItems as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error500);

      await expect(loadTransportLogs(client, '2026-03-13')).rejects.toThrow('Internal Server Error');
    });
  });

  // ─── saveTransportLog ───────────────────────────────────────────────────

  describe('saveTransportLog', () => {
    const baseInput: SaveTransportLogInput = {
      userCode: 'U001',
      recordDate: '2026-03-13',
      direction: 'to',
      status: 'in-progress',
    };

    it('should create a new item when no existing item found', async () => {
      (client.listItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]); // no existing

      await saveTransportLog(client, baseInput);

      expect(client.addListItemByTitle).toHaveBeenCalledWith(
        'Transport_Log',
        expect.objectContaining({
          Title: 'U001_2026-03-13_to',
          UserCode: 'U001',
          RecordDate: '2026-03-13',
          Direction: 'to',
          Status: 'in-progress',
        }),
      );
      expect(client.updateItem).not.toHaveBeenCalled();
    });

    it('should update existing item when found', async () => {
      (client.listItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ Id: 42 }]);

      await saveTransportLog(client, baseInput);

      expect(client.updateItem).toHaveBeenCalledWith(
        'Transport_Log',
        42,
        expect.objectContaining({
          Status: 'in-progress',
        }),
      );
      expect(client.addListItemByTitle).not.toHaveBeenCalled();
    });

    it('should include optional fields when provided', async () => {
      (client.listItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      await saveTransportLog(client, {
        ...baseInput,
        method: 'office_shuttle',
        actualTime: '09:15',
        driverName: '田中',
        notes: 'テスト',
        updatedBy: 'staff@example.com',
      });

      expect(client.addListItemByTitle).toHaveBeenCalledWith(
        'Transport_Log',
        expect.objectContaining({
          Method: 'office_shuttle',
          ActualTime: '09:15',
          DriverName: '田中',
          Notes: 'テスト',
          UpdatedBy: 'staff@example.com',
        }),
      );
    });

    it('should silently skip when list does not exist (404)', async () => {
      const error404 = new Error('List does not exist');
      Object.assign(error404, { status: 404 });
      (client.listItems as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error404);

      // Should not throw
      await expect(saveTransportLog(client, baseInput)).resolves.toBeUndefined();
    });

    it('should always set UpdatedAt timestamp', async () => {
      (client.listItems as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      await saveTransportLog(client, baseInput);

      const savedBody = (client.addListItemByTitle as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedBody.UpdatedAt).toBeDefined();
      // Should be a valid ISO timestamp
      expect(() => new Date(savedBody.UpdatedAt as string)).not.toThrow();
    });
  });

  // ─── Write gate ─────────────────────────────────────────────────────────

  describe('write gate', () => {
    it('should throw WriteDisabledError when writes are disabled', async () => {
      // Override the mock for this test
      const envModule = await import('@/env');
      Object.defineProperty(envModule, 'isWriteEnabled', { value: false, writable: true });

      await expect(saveTransportLog(client, {
        userCode: 'U001',
        recordDate: '2026-03-13',
        direction: 'to',
        status: 'in-progress',
      })).rejects.toThrow('Write operation');

      // Restore
      Object.defineProperty(envModule, 'isWriteEnabled', { value: true, writable: true });
    });
  });
});
