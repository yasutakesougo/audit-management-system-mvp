import { describe, expect, it } from 'vitest';

import { isAdminSurfacePath } from './adminSurfaces';

describe('isAdminSurfacePath', () => {
  it('matches admin surface routes', () => {
    expect(isAdminSurfacePath('/analysis/dashboard')).toBe(true);
    expect(isAdminSurfacePath('/analysis/intervention')).toBe(true);
    expect(isAdminSurfacePath('/ops')).toBe(true);
    expect(isAdminSurfacePath('/exceptions')).toBe(true);
    expect(isAdminSurfacePath('/handoff-analysis')).toBe(true);
  });

  it('does not match frontline routes', () => {
    expect(isAdminSurfacePath('/today')).toBe(false);
    expect(isAdminSurfacePath('/daily/attendance')).toBe(false);
    expect(isAdminSurfacePath('/daily/table')).toBe(false);
    expect(isAdminSurfacePath('/handoff-timeline')).toBe(false);
  });
});
