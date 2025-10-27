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
      sp: {
        web: {
          select: () => ({
            get: () => Promise.resolve({ value: [] }),
          }),
        },
      },
    }),
  };
});
