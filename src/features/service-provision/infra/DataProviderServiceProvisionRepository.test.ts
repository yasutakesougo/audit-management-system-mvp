/**
 * DataProviderServiceProvisionRepository.test.ts
 * 
 * サービス提供実績レポジトリの単一責任（マッピング・クエリ生成）を検証する。
 * IDataProvider はモック化し、SharePoint 通信の実態（フィールド名等）が
 * SERVICE_PROVISION_FIELDS と一致していることを保証する。
 */
import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { DataProviderServiceProvisionRepository } from './DataProviderServiceProvisionRepository';
import { SERVICE_PROVISION_FIELDS } from '@/sharepoint/fields/serviceProvisionFields';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { makeEntryKey } from '../domain/types';

describe('DataProviderServiceProvisionRepository', () => {
  let mockProvider: Mocked<IDataProvider>;
  let repository: DataProviderServiceProvisionRepository;

  const sampleSpItem = {
    Id: 1,
    'odata.etag': 'W/"1"',
    [SERVICE_PROVISION_FIELDS.entryKey]: 'user1_2026-04-01',
    [SERVICE_PROVISION_FIELDS.userCode]: 'user1',
    [SERVICE_PROVISION_FIELDS.recordDate]: '2026-04-01T00:00:00Z',
    [SERVICE_PROVISION_FIELDS.status]: '提供',
    [SERVICE_PROVISION_FIELDS.startHHMM]: '0900',
    [SERVICE_PROVISION_FIELDS.endHHMM]: '1700',
    [SERVICE_PROVISION_FIELDS.hasTransport]: true,
    [SERVICE_PROVISION_FIELDS.hasTransportPickup]: true,
    [SERVICE_PROVISION_FIELDS.hasTransportDropoff]: false,
    [SERVICE_PROVISION_FIELDS.hasMeal]: true,
    [SERVICE_PROVISION_FIELDS.hasBath]: false,
    [SERVICE_PROVISION_FIELDS.hasExtended]: false,
    [SERVICE_PROVISION_FIELDS.hasAbsentSupport]: false,
    [SERVICE_PROVISION_FIELDS.note]: 'Test Note',
    [SERVICE_PROVISION_FIELDS.source]: 'Unified',
    [SERVICE_PROVISION_FIELDS.updatedByUPN]: 'admin@example.com',
  };

  beforeEach(() => {
    mockProvider = {
      listItems: vi.fn(),
      getItemById: vi.fn(),
      createItem: vi.fn(),
      updateItem: vi.fn(),
      deleteItem: vi.fn(),
      getMetadata: vi.fn(),
      getFieldInternalNames: vi.fn().mockResolvedValue(new Set(Object.values(SERVICE_PROVISION_FIELDS))),
      getResourceNames: vi.fn().mockResolvedValue(['ServiceProvisionRecords']),
      ensureListExists: vi.fn(),
      seed: vi.fn(),
    } as Mocked<IDataProvider>;

    repository = new DataProviderServiceProvisionRepository({ provider: mockProvider });
  });

  describe('getByEntryKey', () => {
    it('正しくフィルタクエリを生成し、ドメインモデルに変換できること', async () => {
      mockProvider.listItems.mockResolvedValue([sampleSpItem]);

      const result = await repository.getByEntryKey('user1_2026-04-01');

      expect(mockProvider.listItems).toHaveBeenCalledWith(
        'ServiceProvisionRecords',
        expect.objectContaining({
          filter: expect.stringContaining(`EntryKey eq 'user1_2026-04-01'`)
        })
      );

      expect(result).not.toBeNull();
      expect(result?.userCode).toBe('user1');
      expect(result?.recordDateISO).toBe('2026-04-01');
      expect(result?.startHHMM).toBe(900);
      expect(result?.hasTransportPickup).toBe(true);
    });

    it('該当データがない場合に null を返すこと', async () => {
      mockProvider.listItems.mockResolvedValue([]);
      const result = await repository.getByEntryKey('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('upsertByEntryKey', () => {
    const input = {
      userCode: 'user1',
      recordDateISO: '2026-04-01',
      status: '提供' as const,
      startHHMM: 900,
      endHHMM: 1700,
      hasTransport: true,
      hasTransportPickup: true,
      hasTransportDropoff: false,
      hasMeal: true,
      hasBath: false,
      hasExtended: false,
      hasAbsentSupport: false,
      note: 'Updated Note',
      source: 'Unified' as const,
      updatedByUPN: 'admin@example.com',
    };

    it('既存データがない場合、createItem を呼び出すこと', async () => {
      mockProvider.listItems.mockResolvedValue([]); // getByEntryKey returns null
      mockProvider.createItem.mockResolvedValue({ ...sampleSpItem, Id: 100 });

      const result = await repository.upsertByEntryKey(input);

      expect(mockProvider.createItem).toHaveBeenCalledWith(
        'ServiceProvisionRecords',
        expect.objectContaining({
          [SERVICE_PROVISION_FIELDS.entryKey]: makeEntryKey('user1', '2026-04-01'),
          [SERVICE_PROVISION_FIELDS.note]: 'Updated Note'
        })
      );
      expect(result.id).toBe(100);
    });

    it('既存データがある場合、updateItem を呼び出すこと', async () => {
      mockProvider.listItems.mockResolvedValue([sampleSpItem]); // getByEntryKey returns existing
      mockProvider.updateItem.mockResolvedValue({ ...sampleSpItem });

      await repository.upsertByEntryKey(input);

      expect(mockProvider.updateItem).toHaveBeenCalledWith(
        'ServiceProvisionRecords',
        1, // ID from sampleSpItem
        expect.objectContaining({
          [SERVICE_PROVISION_FIELDS.note]: 'Updated Note'
        })
      );
    });
  });
});
