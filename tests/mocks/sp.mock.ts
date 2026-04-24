import { vi } from 'vitest';

export const spFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ value: [] }),
});

export const useSP = () => ({
  spFetch,
  getListItemsByTitle: vi.fn().mockResolvedValue([]),
  addListItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
  updateItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
  getListFieldInternalNames: vi.fn().mockResolvedValue(new Set()),
  getExistingListTitlesAndIds: vi.fn().mockResolvedValue(new Set()),
  tryGetListMetadata: vi.fn().mockResolvedValue({ Id: 'test-id', Title: 'Test List' }),
  sp: {
    web: {
      select: () => ({
        get: () => Promise.resolve({ value: [] }),
      }),
    },
  },
});

export const createSpClient = (_acquireToken: () => Promise<string | null>, _baseUrl: string) => ({
  spFetch,
  getListItemsByTitle: vi.fn().mockResolvedValue([]),
  addListItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
  updateItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
  getListFieldInternalNames: vi.fn().mockResolvedValue(new Set()),
  getExistingListTitlesAndIds: vi.fn().mockResolvedValue(new Set()),
  tryGetListMetadata: vi.fn().mockResolvedValue({ Id: 'test-id', Title: 'Test List' }),
});
