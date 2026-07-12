import { describe, expect, it, vi } from 'vitest';
import { commandVersion, probeUrl } from '../../scripts/ci/run-perf-with-diagnostics.mjs';

describe('LHCI runtime diagnostics', () => {
  it('records HTTP status and redirect location', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: '/login' } }));
    const result = await probeUrl('http://127.0.0.1:4173/analysis/dashboard', fetchImpl);
    expect(result).toMatchObject({ status: 302, location: '/login' });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('records connection errors without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(probeUrl('http://127.0.0.1:4173', fetchImpl)).resolves.toMatchObject({ error: 'ECONNREFUSED' });
  });

  it('reports unavailable commands as diagnostics', () => {
    expect(commandVersion('definitely-not-a-real-command')).toMatch(/^unavailable:/);
  });
});
