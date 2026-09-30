import { describe, expect, it, vi } from 'vitest';
import { resolveRuntimeEnv } from '@/runtimeEnv';

describe('runtime environment merge', () => {
  it('loads env.runtime.json when Worker injects only a partial environment', async () => {
    const loadRuntimeEnv = vi.fn().mockResolvedValue({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
    });

    const result = await resolveRuntimeEnv({
      buildEnv: { VITE_FORCE_SHAREPOINT: '0' },
      workerInlineEnv: { VITE_SKIP_LOGIN: '0' },
      loadRuntimeEnv,
    });

    expect(loadRuntimeEnv).toHaveBeenCalledOnce();
    expect(result).toEqual({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_SKIP_LOGIN: '0',
    });
  });

  it('keeps keys that exist only in env.runtime.json', async () => {
    await expect(resolveRuntimeEnv({
      buildEnv: { VITE_FORCE_SHAREPOINT: '0' },
      workerInlineEnv: {},
      loadRuntimeEnv: async () => ({ VITE_DATA_PROVIDER: 'sharepoint' }),
    })).resolves.toMatchObject({ VITE_DATA_PROVIDER: 'sharepoint' });
  });

  it('gives Worker inline values priority for the same key', async () => {
    await expect(resolveRuntimeEnv({
      buildEnv: { VITE_SKIP_LOGIN: '0' },
      workerInlineEnv: { VITE_SKIP_LOGIN: '1' },
      loadRuntimeEnv: async () => ({ VITE_SKIP_LOGIN: '0' }),
    })).resolves.toMatchObject({ VITE_SKIP_LOGIN: '1' });
  });

  it('keeps the safe build and Worker fallback when runtime loading fails', async () => {
    await expect(resolveRuntimeEnv({
      buildEnv: {
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
      },
      workerInlineEnv: { VITE_SKIP_LOGIN: '0' },
      loadRuntimeEnv: async () => { throw new Error('unavailable'); },
    })).resolves.toEqual({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_SKIP_LOGIN: '0',
    });
  });

  it('retains the required production runtime assertions', async () => {
    await expect(resolveRuntimeEnv({
      buildEnv: {},
      workerInlineEnv: {},
      loadRuntimeEnv: async () => ({
        VITE_FORCE_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_DEMO_MODE: '0',
        VITE_SKIP_LOGIN: '0',
        VITE_SKIP_SHAREPOINT: '0',
      }),
    })).resolves.toMatchObject({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_DEMO_MODE: '0',
      VITE_SKIP_LOGIN: '0',
      VITE_SKIP_SHAREPOINT: '0',
    });
  });

  it('does not invent demo or test settings when they are absent', async () => {
    const result = await resolveRuntimeEnv({
      buildEnv: { VITE_DEMO_MODE: '0' },
      workerInlineEnv: { VITE_FORCE_SHAREPOINT: '1' },
      loadRuntimeEnv: async () => ({ VITE_SKIP_LOGIN: '0' }),
    });

    expect(result).toEqual({
      VITE_DEMO_MODE: '0',
      VITE_FORCE_SHAREPOINT: '1',
      VITE_SKIP_LOGIN: '0',
    });
    expect(result).not.toHaveProperty('VITE_E2E');
  });

  it('does not erase valid values with undefined, null, or empty strings', async () => {
    await expect(resolveRuntimeEnv({
      buildEnv: { VITE_FORCE_SHAREPOINT: '1', VITE_DATA_PROVIDER: 'sharepoint' },
      workerInlineEnv: { VITE_FORCE_SHAREPOINT: '', VITE_DATA_PROVIDER: '  ' },
      loadRuntimeEnv: async () => ({
        VITE_FORCE_SHAREPOINT: null,
        VITE_DATA_PROVIDER: undefined,
      }),
    })).resolves.toMatchObject({
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
    });
  });
});
