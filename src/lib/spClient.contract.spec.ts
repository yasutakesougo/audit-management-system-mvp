import { describe, expect, it } from 'vitest';
import { createSpClient } from './spClient';

describe('spClient Contract Integrity', () => {
  it('spClient exposes required contract', () => {
    const mockAcquireToken = async () => 'mock-token';
    const mockBaseUrl = 'https://contoso.sharepoint.com/sites/Audit/_api/web';
    
    const client = createSpClient(mockAcquireToken, mockBaseUrl);
    
    // Core Lifeline (Fetch & Batch)
    expect(typeof client.spFetch).toBe('function');
    expect(typeof client.batch).toBe('function');
    expect(typeof client.postBatch).toBe('function');

    // List Operations (Repository Foundation)
    expect(typeof client.getListItemsByTitle).toBe('function');
    expect(typeof client.addListItemByTitle).toBe('function');
    expect(typeof client.updateItemByTitle).toBe('function');
    expect(typeof client.deleteItemByTitle).toBe('function');
    expect(typeof client.patchListItem).toBe('function');

    // Item Operations
    expect(typeof client.getItemById).toBe('function');
    expect(typeof client.getItemByIdWithEtag).toBe('function');
    expect(typeof client.createItem).toBe('function');
    expect(typeof client.updateItem).toBe('function');
    expect(typeof client.deleteItem).toBe('function');

    // Metadata & Provisioning (Infrastructure Stability)
    expect(typeof client.ensureListExists).toBe('function');
    expect(typeof client.tryGetListMetadata).toBe('function');
    expect(typeof client.getListFieldInternalNames).toBe('function');
    expect(typeof client.fetchExistingFields).toBe('function');
    expect(typeof client.addFieldToList).toBe('function');
    expect(typeof client.updateField).toBe('function');
    expect(typeof client.getExistingListTitlesAndIds).toBe('function');
  });

  it('fetch works (contract validation)', () => {
    const mockAcquireToken = async () => 'mock-token';
    const mockBaseUrl = 'https://contoso.sharepoint.com/sites/Audit/_api/web';
    const client = createSpClient(mockAcquireToken, mockBaseUrl);
    
    expect(client.spFetch).toBeDefined();
    expect(typeof client.spFetch).toBe('function');
  });
});
