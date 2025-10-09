import {
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_FISCAL_YEAR,
  SCHEDULE_FIELD_MONTH_KEY,
} from './fields';

type ScheduleFieldValue = string | number | boolean | null | undefined;

export type ScheduleFieldCarrier = Record<string, ScheduleFieldValue>;

export type ScheduleFiscalTerm = {
  fiscalYear?: string;
  monthKey?: string;
  dayKey?: string;
};

export const normalizeScheduleFiscalTerm = (
  item: ScheduleFieldCarrier | undefined,
): ScheduleFiscalTerm | undefined => {
  if (!item) {
    return undefined;
  }
  const fiscalYear = item[SCHEDULE_FIELD_FISCAL_YEAR];
  const monthKey = item[SCHEDULE_FIELD_MONTH_KEY];
  const dayKey = item[SCHEDULE_FIELD_DAY_KEY];

  if (!fiscalYear && !monthKey && !dayKey) {
    return undefined;
  }

  return {
    fiscalYear: typeof fiscalYear === 'string' ? fiscalYear : undefined,
    monthKey: typeof monthKey === 'string' ? monthKey : undefined,
    dayKey: typeof dayKey === 'string' ? dayKey : undefined,
  };
};
