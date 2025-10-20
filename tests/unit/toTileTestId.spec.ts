import { describe, expect, it } from 'vitest';
import { toTileTestId } from '@/features/home/toTileTestId';

describe('toTileTestId', () => {
  it('sanitizes slashes and special characters', () => {
    expect(toTileTestId('/schedules/week')).toBe('home-tile-schedules-week');
    expect(toTileTestId('/coffee-shop/summary')).toBe('home-tile-coffee-shop-summary');
    expect(toTileTestId('/daily')).toBe('home-tile-daily');
  });
});
