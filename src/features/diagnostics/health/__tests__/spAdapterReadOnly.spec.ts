import { describe, expect, it, vi } from 'vitest';
import { createSpAdapterWithAuth } from '../spAdapter';

const client = vi.hoisted(() => ({
  createItem: vi.fn().mockResolvedValue({ Id: 2676 }),
  updateItem: vi.fn().mockResolvedValue(undefined), deleteItem: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/spClient', () => ({
  ensureConfig: () => ({ baseUrl: 'https://tenant.invalid/sites/test' }),
  createSpClient: () => client,
}));

describe('diagnostic adapter fail-closed write boundary', () => {
  it.each(['create', 'update', 'delete'] as const)('rejects %s before calling SharePoint', async (operation) => {
    const sp = createSpAdapterWithAuth(async () => null);
    const request = operation === 'create' ? sp.createItem('Test', { Title: 'probe' })
      : operation === 'update' ? sp.updateItem('Test', 2676, { Title: 'probe' })
      : sp.deleteItem('Test', 2676);
    await expect(request).rejects.toThrow('WRITE_DIAGNOSTICS_DISABLED');
    expect(client.createItem).not.toHaveBeenCalled();
    expect(client.updateItem).not.toHaveBeenCalled();
    expect(client.deleteItem).not.toHaveBeenCalled();
  });
});
