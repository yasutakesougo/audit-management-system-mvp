import { z } from 'zod';

const TIME_24H_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

export const EnvSchema = z.object({
  VITE_ATTENDANCE_DISCREPANCY_THRESHOLD: z.coerce
    .number()
    .min(0, 'Discrepancy threshold must be positive')
    .max(24, 'Discrepancy threshold must be less than 24 hours')
    .default(0.75),
  VITE_ABSENCE_MONTHLY_LIMIT: z.coerce
    .number()
    .int('Absence monthly limit must be an integer')
    .min(0, 'Absence monthly limit cannot be negative')
    .max(31, 'Absence monthly limit must be within a month')
    .default(2),
  VITE_FACILITY_CLOSE_TIME: z
    .string()
    .regex(TIME_24H_PATTERN, 'Facility close time must be HH:MM (24h)')
    .default('18:00'),
});

export type ParsedEnv = z.infer<typeof EnvSchema>;

type RawEnv = Record<string, unknown>;

const loadInlineEnv = (): RawEnv => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as ImportMeta)?.env) {
      return { ...(import.meta as ImportMeta).env } as RawEnv;
    }
  } catch {
    // ignore environments where import.meta is unavailable
  }
  return {};
};

const loadTestEnv = (): RawEnv => {
  const candidate = (globalThis as typeof globalThis & { __TEST_ENV__?: RawEnv }).__TEST_ENV__;
  return candidate ? { ...candidate } : {};
};

let cachedEnv: ParsedEnv | null = null;

export const parseEnv = (raw: RawEnv): ParsedEnv => EnvSchema.parse(raw);

export const getParsedEnv = (overrides?: RawEnv): ParsedEnv => {
  if (overrides) {
    return parseEnv({ ...loadTestEnv(), ...loadInlineEnv(), ...overrides });
  }
  if (cachedEnv) {
    return cachedEnv;
  }
  cachedEnv = parseEnv({ ...loadTestEnv(), ...loadInlineEnv() });
  return cachedEnv;
};

export const resetParsedEnvForTests = (): void => {
  cachedEnv = null;
};
