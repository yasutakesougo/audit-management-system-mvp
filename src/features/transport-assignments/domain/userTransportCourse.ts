import { parseTransportCourse, type TransportCourse } from '@/features/today/transport/transportCourse';

export const USER_TRANSPORT_COURSE_PRIMARY_KEY = 'TransportCourse' as const;

// Backward compatibility: legacy columns are read-only fallbacks.
export const USER_TRANSPORT_COURSE_FALLBACK_KEYS = [
  'TransportCourseId',
  'TransportFixedCourse',
  'TransportRouteCourse',
  'Course',
  'course',
  'courseId',
  'transportCourse',
  'transportCourseId',
  'defaultTransportCourse',
] as const;

export function resolveUserFixedTransportCourse(user: unknown): TransportCourse | null {
  if (!user || typeof user !== 'object') return null;
  const record = user as Record<string, unknown>;

  const primary = parseTransportCourse(record[USER_TRANSPORT_COURSE_PRIMARY_KEY]);
  if (primary) return primary;

  for (const key of USER_TRANSPORT_COURSE_FALLBACK_KEYS) {
    const parsed = parseTransportCourse(record[key]);
    if (parsed) return parsed;
  }

  return null;
}
