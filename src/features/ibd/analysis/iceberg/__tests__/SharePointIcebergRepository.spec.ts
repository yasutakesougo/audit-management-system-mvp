import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIcebergRepository } from '../SharePointIcebergRepository';
import { type IcebergSnapshot } from '../icebergTypes';

// Mock getAppConfig
vi.mock('@/lib/env', () => ({
  getAppConfig: () => ({
    VITE_AUDIT_DEBUG: '0',
    VITE_SP_SITE_URL: 'https://contoso.sharepoint.com/sites/wf',
  }),
}));

// Mock spClient logic
const mockSpFetch = vi.fn();
vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  return {
    ...actual,
    createSpClient: () => ({
      spFetch: mockSpFetch,
    }),
  };
});

describe('SharePointIcebergRepository Logs Persistence', () => {
  const baseUrl = 'https://contoso.sharepoint.com/sites/wf';
  const acquireToken = async () => 'mock-token';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validSnapshot: IcebergSnapshot = {
    schemaVersion: 1,
    sessionId: 'sess-123',
    userId: 'user-456',
    title: 'Test Session',
    updatedAt: '2026-04-08T16:00:00Z',
    nodes: [],
    links: [],
    logs: [
      {
        id: 'ev-1',
        type: 'node_added',
        timestamp: '2026-04-08T16:05:00Z',
        message: 'added node x',
      }
    ],
    status: 'active',
  };

  describe('upsertSnapshot', () => {
    it('includes logs in the PayloadJson when creating a new item', async () => {
      // 1. Existing check (not found)
      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));
      // 2. Post new item
      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ Id: 101 }), { status: 201 }));

      const repo = await createIcebergRepository(acquireToken, baseUrl);
      await repo.upsertSnapshot({
        entryHash: 'hash-abc',
        snapshot: validSnapshot,
      });

      // Verify POST body
      const postCall = mockSpFetch.mock.calls.find(call => call[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string);
      
      expect(body.PayloadJson).toBeDefined();
      const payload = JSON.parse(body.PayloadJson);
      expect(payload.logs).toHaveLength(1);
      expect(payload.logs[0].id).toBe('ev-1');
    });

    it('includes logs in the PayloadJson when updating an existing item', async () => {
      // 1. Existing check (found)
      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ 
        value: [{ Id: 101, EntryHash: 'hash-abc' }] 
      }), { status: 200 }));
      // 2. Patch existing item
      mockSpFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

      const repo = await createIcebergRepository(acquireToken, baseUrl);
      await repo.upsertSnapshot({
        entryHash: 'hash-abc',
        snapshot: validSnapshot,
      });

      // Verify MERGE body
      const patchCall = mockSpFetch.mock.calls.find(call => call[1]?.method === 'MERGE');
      expect(patchCall).toBeDefined();
      const body = JSON.parse(patchCall![1].body as string);
      
      const payload = JSON.parse(body.PayloadJson);
      expect(payload.logs).toHaveLength(1);
    });
  });

  describe('getLatestByUser', () => {
    it('sets empty logs array if logs field is missing in JSON (backward compatibility)', async () => {
      const legacyPayload = JSON.stringify({
        schemaVersion: 1,
        sessionId: 'sess-old',
        userId: 'user-456',
        title: 'Old Session',
        updatedAt: '2026-04-01T12:00:00Z',
        nodes: [],
        links: [],
        // logs is missing
      });

      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ 
        value: [{ 
          Id: 99, 
          PayloadJson: legacyPayload,
          UserId: 'user-456',
          UpdatedAt: '2026-04-01T12:00:00Z'
        }] 
      }), { status: 200 }));

      const repo = await createIcebergRepository(acquireToken, baseUrl);
      const result = await repo.getLatestByUser('user-456');

      expect(result).not.toBeNull();
      expect(result?.logs).toBeDefined();
      expect(result?.logs).toEqual([]); // Default value from Zod
    });

    it('faithfully recreates logs if present in JSON', async () => {
      const payloadWithLogs = JSON.stringify(validSnapshot);

      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ 
        value: [{ 
          Id: 101, 
          PayloadJson: payloadWithLogs,
          UserId: 'user-456',
          UpdatedAt: '2026-04-08T16:00:00Z'
        }] 
      }), { status: 200 }));

      const repo = await createIcebergRepository(acquireToken, baseUrl);
      const result = await repo.getLatestByUser('user-456');

      expect(result?.logs).toHaveLength(1);
      expect(result?.logs[0].message).toBe('added node x');
    });
  });

  describe('Conflict Handling', () => {
    it('throws ConflictError correctly on 412 status', async () => {
      // 1. Existing check
      mockSpFetch.mockResolvedValueOnce(new Response(JSON.stringify({ 
        value: [{ Id: 101 }] 
      }), { status: 200 }));
      // 2. Patch conflict
      mockSpFetch.mockResolvedValueOnce(new Response(null, { status: 412 }));

      const repo = await createIcebergRepository(acquireToken, baseUrl);
      
      await expect(repo.upsertSnapshot({
        entryHash: 'hash-abc',
        snapshot: validSnapshot,
      })).rejects.toThrow(); // We use the re-exported ConflictError
    });
  });
});
