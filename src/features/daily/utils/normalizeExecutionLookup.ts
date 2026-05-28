import { normalizeScheduleItemId } from './normalizeScheduleItemId';

export const normalizeExecutionDate = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
};

export const normalizeExecutionUserId = (value: unknown): string => String(value ?? '').trim();

const USER_ALIASES_GROUPS = [
  // Katsuragawa-san
  ['1', '10', 'U-001', 'I009'],
  // Ishiwata-san
  ['4', '6', 'U-002', 'U-003', 'I005'],
  // Shiota-san
  ['3', 'U-012', 'I016'],
  // Nakamura-san
  ['7', 'U-006', 'I017', 'I022'],
];

export const getUserIdAliases = (userId: string): string[] => {
  const clean = userId.replace(/-/g, '').trim().toUpperCase();
  if (!clean) return [];
  for (const group of USER_ALIASES_GROUPS) {
    const matched = group.some(alias => {
      const cleanAlias = alias.replace(/-/g, '').trim().toUpperCase();
      return clean === cleanAlias;
    });
    if (matched) {
      return group;
    }
  }
  return [];
};

export const buildExecutionUserIdCandidates = (...values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string) => {
    const normalized = normalizeExecutionUserId(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const allValues = [...values];
  for (const val of values) {
    const raw = normalizeExecutionUserId(val);
    if (raw) {
      const aliases = getUserIdAliases(raw);
      for (const alias of aliases) {
        allValues.push(alias);
      }
    }
  }

  for (const value of allValues) {
    const raw = normalizeExecutionUserId(value);
    if (!raw) continue;
    push(raw);
    push(raw.toUpperCase());
    push(raw.replace(/-/g, ''));

    const compact = raw.replace(/-/g, '').toUpperCase();
    const match = compact.match(/^([A-Z]*)(\d+)$/);
    if (!match) continue;

    const prefix = match[1] || 'U';
    const digits = match[2];
    const noPad = String(Number.parseInt(digits, 10));
    const pad3 = digits.padStart(3, '0');
    push(noPad);
    push(`${prefix}${digits}`);
    push(`${prefix}${noPad}`);
    push(`${prefix}${pad3}`);
    push(`${prefix}-${pad3}`);
  }

  return out;
};

export { normalizeScheduleItemId };
