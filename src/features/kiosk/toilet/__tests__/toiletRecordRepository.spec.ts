import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageToiletRecordRepository } from '../toiletRecordRepository';
import { SharePointToiletRecordRepository } from '../SharePointToiletRecordRepository';
import { getToiletRepository } from '../toiletRepositoryFactory';
import type { ToiletRecord, ToiletRecordInput } from '../types';
import * as env from '@/lib/env';
import * as factory from '@/lib/createRepositoryFactory';

// Mock list registry
vi.mock('@/sharepoint/spListRegistry', () => ({
  findListEntry: vi.fn(() => ({
    key: 'toilet_records',
    resolve: () => 'ToiletRecords',
  })),
}));

type ToiletRecordCorrectionPatch = Partial<
  Pick<ToiletRecordInput, 'userId' | 'occurredAt' | 'toiletType' | 'amount' | 'memo'>
> & {
  recordDate?: string;
};

type ToiletRecordRepositoryWithUpdate = {
  update(id: string, patch: ToiletRecordCorrectionPatch): Promise<ToiletRecord>;
};

describe('ToiletRecord Repository & Factory Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  // ── 1. LocalStorageToiletRecordRepository ──
  describe('LocalStorageToiletRecordRepository', () => {
    const repo = new LocalStorageToiletRecordRepository();

    it('should create and retrieve records via localStorage', async () => {
      const input: ToiletRecordInput = {
        userId: 'I005',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
        memo: 'test local',
        recorderName: 'kiosk',
      };

      const record = await repo.create(input);
      expect(record.userId).toBe('I005');
      expect(record.memo).toBe('test local');
      expect(record.recordDate).toBe('2026-05-26');

      const records = await repo.listByDate('2026-05-26');
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(record.id);
    });

    it('should sort records by occurredAt desc', async () => {
      await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-26T09:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
      });
      await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'bowel',
        amount: 'large',
      });

      const records = await repo.listByDate('2026-05-26');
      expect(records).toHaveLength(2);
      expect(records[0].toiletType).toBe('bowel'); // 10:00 (latest) first
      expect(records[1].toiletType).toBe('urination'); // 09:00 second
    });

    it('should filter out deleted records and non-matching dates', async () => {
      await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
      });
      
      // Another date
      await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-27T10:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
      });

      // Mark first deleted in localStorage shape
      const STORAGE_KEY = 'kiosk.toiletRecords.v1';
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.records[1].isDeleted = true; // index 1 is occurredAt 10:00
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }

      const records = await repo.listByDate('2026-05-26');
      expect(records).toHaveLength(0); // matching date but deleted
    });

    it('should correct only toiletType, amount, and memo while keeping identity/date fields immutable', async () => {
      const created = await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
        memo: 'original memo',
        recorderName: 'kiosk',
      });

      const updated = await (repo as LocalStorageToiletRecordRepository & ToiletRecordRepositoryWithUpdate).update(
        created.id,
        {
          toiletType: 'bowel',
          amount: 'large',
          memo: 'corrected memo',
          userId: 'I999',
          occurredAt: '2026-05-27T11:00:00.000Z',
          recordDate: '2026-05-27',
        },
      );

      expect(updated).toMatchObject({
        id: created.id,
        userId: 'I005',
        recordDate: '2026-05-26',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'bowel',
        amount: 'large',
        memo: 'corrected memo',
      });
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.recorderName).toBe('kiosk');
      expect(updated.source).toBe('kiosk');
      expect(updated.isDeleted).toBe(false);
      expect(updated.updatedAt).not.toBe(created.updatedAt);

      const originalDateRecords = await repo.listByDate('2026-05-26');
      expect(originalDateRecords).toHaveLength(1);
      expect(originalDateRecords[0]).toMatchObject({
        id: created.id,
        userId: 'I005',
        recordDate: '2026-05-26',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'bowel',
        amount: 'large',
        memo: 'corrected memo',
      });
      expect(originalDateRecords[0].createdAt).toBe(created.createdAt);
      expect(originalDateRecords[0].recorderName).toBe('kiosk');

      const movedDateRecords = await repo.listByDate('2026-05-27');
      expect(movedDateRecords).toHaveLength(0);
    });

    it('should reject correction for a missing record id without changing existing records', async () => {
      const created = await repo.create({
        userId: 'I005',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'urination',
        amount: 'normal',
        memo: 'original memo',
        recorderName: 'kiosk',
      });

      await expect(
        repo.update('toilet-missing', {
          toiletType: 'bowel',
          amount: 'large',
          memo: 'should not apply',
        }),
      ).rejects.toThrow('[ToiletRecordRepo] record not found: toilet-missing');

      const records = await repo.listByDate('2026-05-26');
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(created);
    });
  });

  // ── 2. SharePointToiletRecordRepository ──
  describe('SharePointToiletRecordRepository', () => {
    it('should list records using spFetch and filter by JST local-day UTC range', async () => {
      const mockSpFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          value: [
            {
              Id: 101,
              Title: 'toilet-1',
              UserId: 'I005',
              RecordDate: '2026-05-25T15:00:00Z', // 2026-05-26 00:00:00 JST
              OccurredAt: '2026-05-26T10:00:00Z',
              ToiletType: 'urination',
              Amount: 'normal',
              Memo: 'sp test',
              RecorderName: 'kiosk',
              IsDeleted: false,
              Created: '2026-05-26T10:05:00Z',
              Modified: '2026-05-26T10:05:00Z',
            },
          ],
        }),
      });

      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId', 'RecordDate', 'OccurredAt', 'ToiletType', 'Amount', 'Memo', 'RecorderName', 'Source', 'IsDeleted'
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);
      const records = await repo.listByDate('2026-05-26');

      expect(mockSpFetch).toHaveBeenCalledTimes(1);
      const [url] = mockSpFetch.mock.calls[0];
      expect(url).toContain("/lists/getbytitle('ToiletRecords')/items");
      const decodedUrl = decodeURIComponent(url);

      // 1. Should not use exact date equality filter
      expect(decodedUrl).not.toContain("RecordDate eq '2026-05-26'");

      // 2. Should use YYYY-MM-DD date range query
      expect(decodedUrl).toContain("RecordDate ge '2026-05-26'");
      expect(decodedUrl).toContain("RecordDate lt '2026-05-27'");

      // 4. IsDeleted condition should be eq false or eq null
      expect(decodedUrl).toContain("IsDeleted eq false or IsDeleted eq null");

      // 3. SharePoint '2026-05-25T15:00:00Z' maps back to JST local date '2026-05-26'
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        id: 'toilet-1',
        userId: 'I005',
        recordDate: '2026-05-26',
        toiletType: 'urination',
        amount: 'normal',
        memo: 'sp test',
      });
    });

    it('should create record with POST payload to SharePoint', async () => {
      const mockSpFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          Id: 202,
          Title: 'toilet-new-123',
          UserId: 'I022',
          RecordDate: '2026-05-26T00:00:00Z',
          OccurredAt: '2026-05-26T15:30:00Z',
          ToiletType: 'bowel',
          Amount: 'large',
          Memo: 'new bowel',
          IsDeleted: false,
        }),
      });

      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId', 'RecordDate', 'OccurredAt', 'ToiletType', 'Amount', 'Memo', 'RecorderName', 'Source', 'IsDeleted'
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);
      const input: ToiletRecordInput = {
        userId: 'I022',
        occurredAt: '2026-05-26T01:30:00.000Z',
        toiletType: 'bowel',
        amount: 'large',
        memo: 'new bowel',
      };

      const record = await repo.create(input);

      expect(mockSpFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockSpFetch.mock.calls[0];
      expect(url).toBe("/lists/getbytitle('ToiletRecords')/items");
      expect(init?.method).toBe('POST');
      
      const body = JSON.parse(init?.body as string);
      expect(body).toMatchObject({
        UserId: 'I022',
        RecordDate: '2026-05-26',
        ToiletType: 'bowel',
        Amount: 'large',
        Memo: 'new bowel',
        IsDeleted: false,
      });

      expect(record.id).toBe('toilet-new-123');
      expect(record.userId).toBe('I022');
      expect(record.recordDate).toBe('2026-05-26');
    });

    it('should NOT execute fallback query when primary range query returns items', async () => {
      const mockSpFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          value: [
            {
              Id: 101,
              Title: 'toilet-1',
              UserId: 'I005',
              RecordDate: '2026-05-25T15:00:00Z',
              OccurredAt: '2026-05-26T10:00:00Z',
              ToiletType: 'urination',
              Amount: 'normal',
              Memo: 'sp test',
              RecorderName: 'kiosk',
              IsDeleted: false,
              Created: '2026-05-26T10:05:00Z',
              Modified: '2026-05-26T10:05:00Z',
            },
          ],
        }),
      });

      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId', 'RecordDate', 'OccurredAt', 'ToiletType', 'Amount', 'Memo', 'RecorderName', 'Source', 'IsDeleted'
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);
      const records = await repo.listByDate('2026-05-26');

      expect(mockSpFetch).toHaveBeenCalledTimes(1);
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('toilet-1');
    });

    it('should execute fallback query when primary range query returns 0 items and filter client-side', async () => {
      let callCount = 0;
      const mockSpFetch = vi.fn().mockImplementation(async (_url) => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            json: async () => ({ value: [] })
          };
        }
        return {
          ok: true,
          json: async () => ({
            value: [
              {
                Id: 50,
                Title: 'toilet-fallback-1',
                UserId: 'I005',
                RecordDate: '2026-05-28T15:00:00Z', // 2026-05-29 00:00:00 JST -> target date
                OccurredAt: '2026-05-29T10:00:00Z',
                ToiletType: 'urination',
                Amount: 'normal',
                Memo: 'should match',
                IsDeleted: false,
                Created: '2026-05-29T10:05:00Z',
              },
              {
                Id: 51,
                Title: 'toilet-fallback-2',
                UserId: 'I005',
                RecordDate: '2026-05-27T15:00:00Z', // 2026-05-28 00:00:00 JST -> other date, should filter out
                OccurredAt: '2026-05-28T10:00:00Z',
                ToiletType: 'urination',
                Amount: 'normal',
                Memo: 'other date',
                IsDeleted: false,
                Created: '2026-05-28T10:05:00Z',
              },
              {
                Id: 52,
                Title: 'toilet-fallback-3',
                UserId: 'I005',
                RecordDate: '2026-05-28T15:00:00Z', // 2026-05-29 00:00:00 JST -> target date, but IsDeleted: true, should filter out
                OccurredAt: '2026-05-29T11:00:00Z',
                ToiletType: 'urination',
                Amount: 'normal',
                Memo: 'deleted record',
                IsDeleted: true,
                Created: '2026-05-29T11:05:00Z',
              },
              {
                Id: 53,
                Title: 'toilet-fallback-4',
                UserId: 'I005',
                RecordDate: '2026-05-28T15:00:00Z', // 2026-05-29 00:00:00 JST -> target date, occurredAt: 09:00:00Z (earlier)
                OccurredAt: '2026-05-29T09:00:00Z',
                ToiletType: 'urination',
                Amount: 'normal',
                Memo: 'should match earlier',
                IsDeleted: false,
                Created: '2026-05-29T09:05:00Z',
              }
            ]
          })
        };
      });

      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId', 'RecordDate', 'OccurredAt', 'ToiletType', 'Amount', 'Memo', 'RecorderName', 'Source', 'IsDeleted'
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);
      const records = await repo.listByDate('2026-05-29');

      expect(mockSpFetch).toHaveBeenCalledTimes(2);

      // Verify the URL for the fallback query
      const [firstCallUrl] = mockSpFetch.mock.calls[0];
      const [secondCallUrl] = mockSpFetch.mock.calls[1];
      const decodedFirstUrl = decodeURIComponent(firstCallUrl);
      const decodedSecondUrl = decodeURIComponent(secondCallUrl);
      expect(decodedFirstUrl).toContain('RecordDate ge');
      expect(decodedSecondUrl).not.toContain('RecordDate ge');
      expect(decodedSecondUrl).toContain('orderby=Created desc');
      expect(decodedSecondUrl).toContain('top=500');

      // Verify the filtered & sorted results:
      // - toilet-fallback-1 (10:00:00) and toilet-fallback-4 (09:00:00) match target date '2026-05-29'
      // - toilet-fallback-2 is filtered out (wrong date)
      // - toilet-fallback-3 is filtered out (deleted)
      // - Ordered by occurredAt desc -> fallback-1 (10:00) then fallback-4 (09:00)
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('toilet-fallback-1');
      expect(records[1].id).toBe('toilet-fallback-4');
    });

    it('should send a SharePoint MERGE correction with only toiletType, amount, and memo fields', async () => {
      const mockSpFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('/items?$filter=') && init === undefined) {
          return {
            ok: true,
            json: async () => ({
              value: [
                {
                  Id: 101,
                  Title: 'toilet-1',
                  UserId: 'I005',
                  RecordDate: '2026-05-26',
                  OccurredAt: '2026-05-26T10:00:00.000Z',
                  ToiletType: 'urination',
                  Amount: 'normal',
                  Memo: 'original memo',
                  RecorderName: 'kiosk',
                  Source: 'kiosk',
                  IsDeleted: false,
                  Created: '2026-05-26T10:01:00.000Z',
                  Modified: '2026-05-26T10:01:00.000Z',
                },
              ],
            }),
          };
        }
        if (url.includes('/items(101)') && init?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({
              Id: 101,
              Title: 'toilet-1',
              UserId: 'I005',
              RecordDate: '2026-05-26',
              OccurredAt: '2026-05-26T10:00:00.000Z',
              ToiletType: 'bowel',
              Amount: 'large',
              Memo: 'corrected memo',
              RecorderName: 'kiosk',
              Source: 'kiosk',
              IsDeleted: false,
              Created: '2026-05-26T10:01:00.000Z',
              Modified: '2026-05-26T10:05:00.000Z',
            }),
          };
        }
        return { ok: true, json: async () => ({ value: [] }) };
      });

      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId',
        'RecordDate',
        'OccurredAt',
        'ToiletType',
        'Amount',
        'Memo',
        'RecorderName',
        'Source',
        'IsDeleted',
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);
      const updated = await (repo as SharePointToiletRecordRepository & ToiletRecordRepositoryWithUpdate).update(
        'toilet-1',
        {
          toiletType: 'bowel',
          amount: 'large',
          memo: 'corrected memo',
          userId: 'I999',
          occurredAt: '2026-05-27T11:00:00.000Z',
          recordDate: '2026-05-27',
        },
      );

      const updateCall = mockSpFetch.mock.calls.find((call) =>
        String(call[0]).includes("/lists/getbytitle('ToiletRecords')/items(101)"),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall?.[1]?.headers).toMatchObject({
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
      });

      const body = JSON.parse(updateCall?.[1]?.body as string);
      expect(body).toEqual({
        ToiletType: 'bowel',
        Amount: 'large',
        Memo: 'corrected memo',
      });

      expect(updated).toMatchObject({
        id: 'toilet-1',
        userId: 'I005',
        recordDate: '2026-05-26',
        occurredAt: '2026-05-26T10:00:00.000Z',
        toiletType: 'bowel',
        amount: 'large',
        memo: 'corrected memo',
      });
      expect(updated.createdAt).toBe('2026-05-26T10:01:00.000Z');
      expect(updated.recorderName).toBe('kiosk');
      expect(updated.source).toBe('kiosk');
      expect(updated.isDeleted).toBe(false);
    });

    it('should reject a SharePoint correction when lookup finds no matching record and skip MERGE', async () => {
      const mockSpFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ value: [] }),
      });
      const mockGetFields = vi.fn().mockResolvedValue(new Set([
        'UserId',
        'RecordDate',
        'OccurredAt',
        'ToiletType',
        'Amount',
        'Memo',
        'RecorderName',
        'Source',
        'IsDeleted',
      ]));

      const repo = new SharePointToiletRecordRepository(mockSpFetch, mockGetFields);

      await expect(
        repo.update('toilet-missing', {
          toiletType: 'bowel',
          amount: 'large',
          memo: 'should not apply',
        }),
      ).rejects.toThrow('[SharePointToiletRecordRepo] record not found: toilet-missing');

      expect(mockSpFetch).toHaveBeenCalledTimes(1);
      const [lookupUrl, lookupInit] = mockSpFetch.mock.calls[0];
      expect(lookupInit).toBeUndefined();
      expect(decodeURIComponent(String(lookupUrl))).toContain("Title eq 'toilet-missing'");
      expect(mockSpFetch.mock.calls).not.toContainEqual([
        expect.stringContaining('/items('),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-HTTP-Method': 'MERGE' }),
        }),
      ]);
    });
  });

  // ── 3. toiletRepositoryFactory ──
  describe('toiletRepositoryFactory', () => {
    it('should resolve LocalStorageRepository when defaultShouldUseDemo() resolves to true', () => {
      vi.spyOn(factory, 'defaultShouldUseDemo').mockReturnValue(true);
      const repo = getToiletRepository(vi.fn());
      expect(repo).toBeInstanceOf(LocalStorageToiletRecordRepository);
    });

    it('should resolve LocalStorageRepository when defaultShouldUseDemo() is false but provider is memory', () => {
      vi.spyOn(factory, 'defaultShouldUseDemo').mockReturnValue(false);
      vi.spyOn(env, 'readOptionalEnv').mockReturnValue('memory');

      const repo = getToiletRepository(vi.fn());
      expect(repo).toBeInstanceOf(LocalStorageToiletRecordRepository);
    });

    it('should resolve SharePointRepository when defaultShouldUseDemo() resolves to false', () => {
      vi.spyOn(factory, 'defaultShouldUseDemo').mockReturnValue(false);
      vi.spyOn(env, 'readOptionalEnv').mockReturnValue('sharepoint');

      const repo = getToiletRepository(vi.fn());
      expect(repo).toBeInstanceOf(SharePointToiletRecordRepository);
    });
  });
});
