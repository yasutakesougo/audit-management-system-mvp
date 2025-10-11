import { vi } from 'vitest';

/**
 * Dynamically imports `dateutils.local` after forcing the desired schedule TZ.
 *
 * Usage:
 * ```ts
 * const { startOfDay, restore } = await loadDateutilsWithTz('America/Los_Angeles');
 * try {
 *   expect(startOfDay('2025-07-10T10:15:00-07:00').toISOString()).toMatch(/T07:00:00.000Z$/);
 * } finally {
 *   restore();
 * }
 * ```
 */
export async function loadDateutilsWithTz(tz: string) {
  const previous = process.env.VITE_SCHEDULES_TZ;
  process.env.VITE_SCHEDULES_TZ = tz;
  vi.resetModules();
  const mod = await import('@/features/schedule/dateutils.local');

  const restore = () => {
    if (previous === undefined) {
      delete process.env.VITE_SCHEDULES_TZ;
    } else {
      process.env.VITE_SCHEDULES_TZ = previous;
    }
    vi.resetModules();
  };

  return { ...mod, restore };
}
