import { describe, expect, it, vi } from 'vitest';

import { buildContractErrorMessage, validateSchedulesListContract, type ListFieldMeta } from './contract';
import { SpScheduleCategoryRaw } from './spRowSchema';
import { SCHEDULES_FIELDS } from './spSchema';

const baseFields: ListFieldMeta[] = [
  { internalName: SCHEDULES_FIELDS.title, type: 'Text', required: true },
  { internalName: SCHEDULES_FIELDS.start, type: 'DateTime', required: true },
  { internalName: SCHEDULES_FIELDS.end, type: 'DateTime', required: true },
  {
    internalName: SCHEDULES_FIELDS.serviceType,
    type: 'Choice',
    required: true,
    choices: [...SpScheduleCategoryRaw.options],
  },
  { internalName: SCHEDULES_FIELDS.locationName, type: 'Text', required: false },
];

const resolveTitle = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    readEnv: (key: string, fallback = '') => env[key] ?? fallback,
    readOptionalEnv: (key: string) => env[key],
  }));
  const mod = await import('./spSchema');
  return mod.getSchedulesListTitle();
};

describe('schedules contract', () => {
  it('resolves list title with correct precedence', async () => {
    await expect(resolveTitle({})).resolves.toBe('ScheduleEvents');
    await expect(resolveTitle({ VITE_SP_LIST_SCHEDULES: 'LegacySchedules' })).resolves.toBe('LegacySchedules');
    await expect(resolveTitle({ VITE_SCHEDULES_LIST_TITLE: 'PreferredSchedules' })).resolves.toBe('PreferredSchedules');
    await expect(resolveTitle({
      VITE_SCHEDULES_LIST_TITLE: 'PreferredSchedules',
      VITE_SP_LIST_SCHEDULES: 'LegacySchedules',
    })).resolves.toBe('PreferredSchedules');
  });

  it('detects missing required fields', () => {
    const fields = baseFields.filter((field) => field.internalName !== SCHEDULES_FIELDS.end);
    const result = validateSchedulesListContract(fields);

    expect(result.ok).toBe(false);
    expect(result.missingFields).toEqual([SCHEDULES_FIELDS.end]);
    expect(buildContractErrorMessage(result)).toContain('Missing fields');
  });

  it('detects missing category choices', () => {
    const fields = baseFields.map((field) =>
      field.internalName === SCHEDULES_FIELDS.serviceType
        ? { ...field, choices: ['User', 'Org'] }
        : field,
    );
    const result = validateSchedulesListContract(fields);

    expect(result.ok).toBe(false);
    expect(result.missingChoices[0]?.field).toBe(SCHEDULES_FIELDS.serviceType);
    expect(result.missingChoices[0]?.missing).toContain('Staff');
    expect(buildContractErrorMessage(result)).toContain('Missing choices');
  });
});
