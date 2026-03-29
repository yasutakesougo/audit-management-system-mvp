import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';

/**
 * DataProvider Contract Tests
 * 
 * すべての IDataProvider 実装が満たすべき共通の振る舞いを定義します。
 * backend が SharePoint でも InMemory でも、同じインターフェースで
 * 同様の挙動（成功・失敗のパターン、戻り値の型）をすることを保証します。
 */
function runProviderContractTests(setupProvider: () => IDataProvider, providerName: string) {
  describe(`Contract: ${providerName}`, () => {
    let provider: IDataProvider;

    beforeEach(() => {
      provider = setupProvider();
    });

    describe('Read Operations', () => {
      it('listItems should return an array', async () => {
        const items = await provider.listItems('TestList');
        expect(Array.isArray(items)).toBe(true);
      });

      it('listItems for non-existent resource should return an empty array or handle gracefully', async () => {
        const items = await provider.listItems('NonExistentList');
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
      });

      it('getItemById should throw a descriptive error for non-existent item', async () => {
        // SharePoint implementation and InMemory both throw on 404
        await expect(provider.getItemById('TestList', 9999))
          .rejects.toThrow(/not found/i);
      });
    });

    describe('Write Operations', () => {
      it('should return the created item after createItem', async () => {
        const payload = { Title: 'Contract Test Item', Value: 100 };
        const created = await provider.createItem<{ Title: string; Id: number | string }>('TestList', payload);
        
        expect(created).toBeDefined();
        expect(created.Title).toBe(payload.Title);
        // IDataProvider Contract: Id must be either string or number
        expect(['string', 'number']).toContain(typeof created.Id);
      });

      it('should be able to update an existing item', async () => {
        const payload = { Title: 'Initial' };
        const created = await provider.createItem<{ Title: string; Id: number | string }>('TestList', payload);
        
        const updatePayload = { Title: 'Updated' };
        const updated = await provider.updateItem<{ Title: string }>('TestList', created.Id, updatePayload);
        
        expect(updated.Title).toBe(updatePayload.Title);
      });

      it('should successfully delete an item', async () => {
        const created = await provider.createItem<{ Id: number | string }>('TestList', { Title: 'To Delete' });
        await expect(provider.deleteItem('TestList', created.Id)).resolves.not.toThrow();
      });
    });

    describe('Metadata Operations', () => {
      it('getFieldInternalNames should return a Set', async () => {
        const names = await provider.getFieldInternalNames('TestList');
        expect(names).toBeInstanceOf(Set);
      });

      it('getMetadata should return basic list info', async () => {
        const meta = await provider.getMetadata('TestList');
        expect(meta).toBeDefined();
        expect(typeof meta).toBe('object');
      });
    });
  });
}

import type { UseSP } from '@/lib/spClient';

import { LocalStorageDataProvider } from '@/lib/data/LocalStorageDataProvider';

// ... other imports ...

// 1. InMemoryDataProvider のテスト
runProviderContractTests(() => new InMemoryDataProvider(), 'InMemoryDataProvider');

// 2. LocalStorageDataProvider のテスト
runProviderContractTests(() => {
  // Mock localStorage for node environment in tests
  const mockStorage: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
    key: (index: number) => Object.keys(mockStorage)[index] || null,
    get length() { return Object.keys(mockStorage).length; }
  });
  return new LocalStorageDataProvider();
}, 'LocalStorageDataProvider');

// 2. SharePointDataProvider のテスト (Mock Client 経由)
const mockSpClient = {
  listItems: vi.fn().mockImplementation((listTitle) => {
    if (listTitle === 'NonExistentList') return Promise.resolve([]);
    return Promise.resolve([]);
  }),
  getItemById: vi.fn().mockImplementation((_listName, id) => {
    if (id === 9999) return Promise.reject(new Error('Item 9999 not found'));
    return Promise.resolve({ Id: id, Title: 'Mock' });
  }),
  addListItemByTitle: vi.fn().mockImplementation((_list, payload) => Promise.resolve({ Id: 1, ...payload })),
  updateItem: vi.fn().mockResolvedValue({ Title: 'Updated' }),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  tryGetListMetadata: vi.fn().mockResolvedValue({}),
  getListFieldInternalNames: vi.fn().mockResolvedValue(new Set()),
} as unknown as UseSP;

runProviderContractTests(() => new SharePointDataProvider(mockSpClient), 'SharePointDataProvider (Mocked)');
