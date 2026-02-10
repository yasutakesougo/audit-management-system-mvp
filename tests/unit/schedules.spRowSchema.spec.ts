import { describe, expect, it, vi } from 'vitest';

import { mapSpCategoryToDomain } from '@/features/schedules/data/spRowSchema';

describe('mapSpCategoryToDomain', () => {
  it('maps known SharePoint categories to domain lanes', () => {
    expect(mapSpCategoryToDomain('User')).toBe('User');
    expect(mapSpCategoryToDomain('Staff')).toBe('Staff');
    expect(mapSpCategoryToDomain('Org')).toBe('Org');
    expect(mapSpCategoryToDomain('Facility')).toBe('Org');
    expect(mapSpCategoryToDomain('Other')).toBe('Org');
  });

  it('defaults missing or unknown categories to Org with a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(mapSpCategoryToDomain(undefined)).toBe('Org');
    expect(mapSpCategoryToDomain(null)).toBe('Org');
    expect(mapSpCategoryToDomain('Unknown' as 'User')).toBe('Org');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
