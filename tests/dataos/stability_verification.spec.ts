import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { 
  createDataProvider, 
  resolveProvider, 
  __clearProviderCache,
  isDataProviderReady
} from '@/lib/data/createDataProvider';
import { LocalStorageDataProvider } from '@/lib/data/LocalStorageDataProvider';
import { InMemoryDataProvider } from '@/lib/data/inMemoryDataProvider';
import { SharePointDataProvider } from '@/lib/sp/spDataProvider';
import { 
  DataProviderItemNotFoundError,
  DataProviderNotInitializedError
} from '@/lib/errors';
import type { UseSP, createSpClient } from '@/lib/spClient';
import { getUserRepository } from '@/features/users/repositoryFactory';

// Mock Telemetry and Observability to avoid side effects in tests
vi.mock('@/lib/telemetry/spTelemetry', () => ({ trackSpEvent: vi.fn() }));
vi.mock('@/lib/data/dataProviderObservabilityStore', () => ({
  useDataProviderObservabilityStore: {
    getState: () => ({ setProvider: vi.fn() })
  }
}));

const mockSpClient = {
  baseUrl: 'https://tenant.sharepoint.com/sites/test',
  listItems: vi.fn(),
  getItemById: vi.fn(),
  addListItemByTitle: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
} as unknown as UseSP;

function setLocationSearch(search: string): void {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

describe('Data OS Stability Verification', () => {
  beforeEach(() => {
    __clearProviderCache();
    setLocationSearch('');
    vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
    });
    // Reset env if possible, though Vitest makes import.meta.env tricky
    // We'll rely more on URL params for the tests
  });

  describe('1. Singleton Equality & Provider Isolation', () => {
    it('should return the same instance for multiple calls (Singleton)', () => {
      const { provider: p1 } = createDataProvider(mockSpClient, { type: 'memory' });
      const { provider: p2 } = createDataProvider(mockSpClient, { type: 'memory' });
      
      expect(p1).toBe(p2); // Referential equality
      expect(p1).toBeInstanceOf(InMemoryDataProvider);
    });

    it('should return different instances for different provider types (Isolation)', () => {
      // 1. Memory
      const { provider: pMemory } = createDataProvider(mockSpClient, { type: 'memory' });
      expect(pMemory).toBeInstanceOf(InMemoryDataProvider);
      
      // 2. Local (need to clear cache or use different type to trigger new instantiation)
      // Actually because our factory check type first, it will create a new one if not in cache
      const { provider: pLocal } = createDataProvider(mockSpClient, { type: 'local' });
      expect(pLocal).toBeInstanceOf(LocalStorageDataProvider);
      expect(pLocal).not.toBe(pMemory);
    });

    it('resolveProvider should return the same instance as createDataProvider (Bridge Consistency)', () => {
      const { provider: pFromFactory } = createDataProvider(mockSpClient, { type: 'local' });
      const pFromResolver = resolveProvider({ forceKind: 'local' });
      
      expect(pFromResolver).toBe(pFromFactory);
    });
  });

  describe('2. LocalStorage StorageEvent Sync', () => {
    it('should invalidate cache and reload on StorageEvent', async () => {
      const resource = 'TestList';
      const key = `dp:v1:data:${resource}`;
      const initialData = [{ Id: 1, Title: 'Initial' }];
      const updatedData = [{ Id: 1, Title: 'Updated externally' }];

      let currentData = initialData;
      const getItemMock = vi.fn().mockImplementation(() => JSON.stringify(currentData));
      vi.stubGlobal('localStorage', { 
        getItem: getItemMock,
        setItem: vi.fn()
      });

      const provider = new LocalStorageDataProvider();
      
      // 1. First read
      const items1 = await provider.listItems(resource);
      expect(items1).toEqual(initialData);
      expect(getItemMock).toHaveBeenCalledTimes(1);

      // 2. Second read (should use cache)
      const items2 = await provider.listItems(resource);
      expect(items2).toEqual(initialData);
      expect(getItemMock).toHaveBeenCalledTimes(1);

      // 3. External update trigger (simulate another tab)
      currentData = updatedData;
      window.dispatchEvent(new StorageEvent('storage', { key }));

      // 4. Third read (should RELOAD from localStorage)
      const items3 = await provider.listItems(resource);
      expect(items3).toEqual(updatedData);
      expect(getItemMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. Error Contract Consistency', () => {
    const providerTypes = [
      { name: 'InMemory', setup: () => new InMemoryDataProvider() },
      { name: 'LocalStorage', setup: () => {
          vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
          return new LocalStorageDataProvider();
      }},
      { name: 'SharePoint', setup: () => {
          const client = { ...mockSpClient, getItemById: vi.fn().mockRejectedValue(new Error('404')) };
          return new SharePointDataProvider(client as unknown as ReturnType<typeof createSpClient>);
      }}
    ];

    it.each(providerTypes)('$name should throw DataProviderItemNotFoundError on miss', async ({ setup }) => {
      const provider = setup();
      
      try {
        await provider.getItemById('TestResource', 999);
        assert.fail('Should have thrown');
      } catch (err: unknown) {
        // We check if it is instance of base class or has the right name
        expect(err).toBeInstanceOf(DataProviderItemNotFoundError);
        // For SP, it might be a subclass but still instanceof base
        if (err instanceof DataProviderItemNotFoundError) {
            expect(err.name).toMatch(/NotFoundError/);
        }
      }
    });
  });

  describe('4. Regression: CRUD Contract', () => {
    // Basic connectivity check for the most common provider in local dev
    it('LocalStorageDataProvider should handle basic CRUD correctly', async () => {
      const mockStorage: Record<string, string> = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => mockStorage[k],
        setItem: (k: string, v: string) => { mockStorage[k] = v; }
      });

      const provider = new LocalStorageDataProvider();
      const resource = 'RegressionList';

      // Create
      const created = await provider.createItem<{ Id: number, Title: string }>(resource, { Title: 'Test' });
      expect(created.Id).toBeDefined();
      expect(created.Title).toBe('Test');

      // Read
      const items = await provider.listItems(resource);
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(created);

      // Update
      await provider.updateItem(resource, created.Id, { Title: 'Updated' });
      const item = await provider.getItemById<{ Title: string }>(resource, created.Id);
      expect(item.Title).toBe('Updated');

      // Delete
      await provider.deleteItem(resource, created.Id);
      const itemsAfter = await provider.listItems(resource);
      expect(itemsAfter).toHaveLength(0);
    });
  });

  describe('5. Hardening & Readiness', () => {
    it('resolveProvider should throw DataProviderNotInitializedError if uninitialized and in sharepoint mode', () => {
      // Should throw because no spClient has been provided yet
      expect(() => resolveProvider({ forceKind: 'sharepoint' })).toThrow(DataProviderNotInitializedError);
    });

    it('createDataProvider should update client on existing sharepoint instance', () => {
      const client1 = { ...mockSpClient, baseUrl: 'site1' } as unknown as UseSP;
      const client2 = { ...mockSpClient, baseUrl: 'site2' } as unknown as UseSP;
      
      const { provider: p1 } = createDataProvider(client1, { type: 'sharepoint' });
      const setClientSpy = vi.spyOn(p1 as SharePointDataProvider, 'setClient');
      
      const { provider: p2 } = createDataProvider(client2, { type: 'sharepoint' });
      
      expect(p1).toBe(p2); // Same instance
      expect(setClientSpy).toHaveBeenCalledWith(client2);
    });

    it('getUserRepository should resolve in test mode even when provider is not preinitialized', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = getUserRepository({ forceKind: 'real' });
      expect(repo).toBeDefined();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('isDataProviderReady should return correct state', () => {
      setLocationSearch('?provider=memory');
      expect(isDataProviderReady()).toBe(false);
      
      createDataProvider(mockSpClient, { type: 'memory' });
      expect(isDataProviderReady()).toBe(true);
    });
  });
});
