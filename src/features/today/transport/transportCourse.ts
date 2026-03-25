export const TRANSPORT_COURSE_OPTIONS = [
  { value: 'isogo', label: '磯子' },
  { value: 'kan2', label: '環2' },
  { value: 'kanazawa', label: '金沢' },
] as const;

export type TransportCourse = (typeof TRANSPORT_COURSE_OPTIONS)[number]['value'];

const COURSE_LABEL_BY_VALUE: Record<TransportCourse, string> = {
  isogo: '磯子',
  kan2: '環2',
  kanazawa: '金沢',
};

const COURSE_VALUE_BY_LABEL: Record<string, TransportCourse> = {
  磯子: 'isogo',
  環2: 'kan2',
  金沢: 'kanazawa',
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isTransportCourse(value: unknown): value is TransportCourse {
  return value === 'isogo' || value === 'kan2' || value === 'kanazawa';
}

export function parseTransportCourse(value: unknown): TransportCourse | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (isTransportCourse(normalized)) return normalized;
  return COURSE_VALUE_BY_LABEL[normalized] ?? null;
}

export function getTransportCourseLabel(value: unknown): string | null {
  const parsed = parseTransportCourse(value);
  if (!parsed) return null;
  return COURSE_LABEL_BY_VALUE[parsed];
}
