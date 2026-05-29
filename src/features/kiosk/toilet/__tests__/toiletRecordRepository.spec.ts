import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageToiletRecordRepository } from '../toiletRecordRepository';
import { SharePointToiletRecordRepository } from '../SharePointToiletRecordRepository';
import { getToiletRepository } from '../toiletRepositoryFactory';
import type { ToiletRecordInput } from '../types';
import * as env from '@/lib/env';
import * as factory from '@/lib/createRepositoryFactory';

// Mock list registry
vi.mock('@/sharepoint/spListRegistry', () => ({
  findListEntry: vi.fn(() => ({
    key: 'toilet_records',
    resolve: () => 'ToiletRecords',
  })),
}));

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

      // 2. Should use local-day UTC range query
      expect(decodedUrl).toContain("RecordDate ge '2026-05-25T15:00:00Z'");
      expect(decodedUrl).toContain("RecordDate lt '2026-05-26T15:00:00Z'");

      // 4. IsDeleted condition should be preserved
      expect(decodedUrl).toContain("IsDeleted ne true");

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
