import { normalizeScheduleItemId } from './normalizeScheduleItemId';

export const normalizeExecutionDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
};

export const normalizeExecutionUserId = (value: unknown): string => String(value ?? '').trim();

export const buildExecutionUserIdCandidates = (...values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string) => {
    const normalized = normalizeExecutionUserId(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  for (const value of values) {
    const raw = normalizeExecutionUserId(value);
    if (!raw) continue;
    push(raw);
    push(raw.toUpperCase());
    push(raw.replace(/-/g, ''));

    const compact = raw.replace(/-/g, '').toUpperCase();
    const digitMatch = compact.match(/^U?(\d+)$/);
    if (!digitMatch) continue;

    const digits = digitMatch[1];
    const noPad = String(Number.parseInt(digits, 10));
    const pad3 = digits.padStart(3, '0');
    push(noPad);
    push(`U${digits}`);
    push(`U${pad3}`);
    push(`U-${pad3}`);
  }

  return out;
};

export { normalizeScheduleItemId };
