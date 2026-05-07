import { normalizeScheduleItemId } from './normalizeScheduleItemId';

export const normalizeExecutionDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
};

export const normalizeExecutionUserId = (value: unknown): string => String(value ?? '').trim();

export { normalizeScheduleItemId };
