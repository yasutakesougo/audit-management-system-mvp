import { vi } from 'vitest';

const spFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ value: [] }),
});

const mockClient = {
  spFetch,
  sp: {
    web: {
      select: () => ({
        get: () => Promise.resolve({ value: [] }),
      }),
    },
  },
};

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => mockClient,
  };
});
