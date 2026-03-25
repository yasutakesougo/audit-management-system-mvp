import { describe, expect, it } from 'vitest';
import { resolveUserFixedTransportCourse } from '../userTransportCourse';

describe('resolveUserFixedTransportCourse', () => {
  it('uses TransportCourse as the primary key', () => {
    expect(resolveUserFixedTransportCourse({ TransportCourse: 'isogo' })).toBe('isogo');
    expect(resolveUserFixedTransportCourse({ TransportCourse: '磯子' })).toBe('isogo');
  });

  it('prefers TransportCourse over legacy fallback keys when both are present', () => {
    expect(
      resolveUserFixedTransportCourse({
        TransportCourse: 'kanazawa',
        transportCourseId: 'isogo',
      }),
    ).toBe('kanazawa');
  });

  it('falls back to legacy keys only when TransportCourse is missing', () => {
    expect(resolveUserFixedTransportCourse({ TransportCourseId: 'kan2' })).toBe('kan2');
    expect(resolveUserFixedTransportCourse({ defaultTransportCourse: '金沢' })).toBe('kanazawa');
  });

  it('returns null for invalid or missing values', () => {
    expect(resolveUserFixedTransportCourse(null)).toBeNull();
    expect(resolveUserFixedTransportCourse({})).toBeNull();
    expect(resolveUserFixedTransportCourse({ TransportCourse: 'unknown-course' })).toBeNull();
  });
});
