import { vi } from 'vitest';

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  const spFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ value: [] }),
  });

  return {
    ...actual,
    useSP: () => ({
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
    }),
    createSpClient: (_acquireToken: any, _baseUrl: string) => ({
      spFetch,
      getListItemsByTitle: vi.fn().mockResolvedValue([]),
      addListItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
      updateItemByTitle: vi.fn().mockResolvedValue({ Id: 1 }),
      getListFieldInternalNames: vi.fn().mockResolvedValue(new Set()),
      getExistingListTitlesAndIds: vi.fn().mockResolvedValue(new Set()),
      tryGetListMetadata: vi.fn().mockResolvedValue({ Id: 'test-id', Title: 'Test List' }),
    }),
  };
});
