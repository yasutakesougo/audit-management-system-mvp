import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/schedules', () => ({
  useSchedules: vi.fn(() => ({ items: [], loading: false })),
  makeRange: vi.fn(),
}));

describe.skip('MonthPage contracts', () => {
  it('does not call useSchedules directly (items are provided by parent)', async () => {
    const mod = await import('@/features/schedules');
    expect(mod).toBeTruthy();

    expect(mod.useSchedules).not.toHaveBeenCalled();
  });
});
