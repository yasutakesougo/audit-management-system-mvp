// contract:allow-interface — Inline draft type is a UI-layer concept, not a data shape (SSOT = schema.ts)
import type { CreateScheduleInput } from '../ScheduleRepository';
import type { ScheduleServiceType } from '../types';

export type InlineScheduleDraft = {
  id?: string;
  title: string;
  start: string;
  end: string;
  notes?: string | null;
  serviceType?: ScheduleServiceType | null;
  dateIso: string;
  startTime: string;
  endTime: string;
  sourceInput?: CreateScheduleInput;
};
