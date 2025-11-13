export const SERVICE_TYPE_OPTIONS = [
  '送迎',
  '訪問支援',
  '内勤',
  '外出支援',
  '面談',
  '会議',
  '研修',
] as const;

export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

export function normalizeServiceType(value: string | null | undefined): ServiceType | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = SERVICE_TYPE_OPTIONS.find((option) => option === trimmed);
  return match ?? null;
}
