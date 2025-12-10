import type { CreateScheduleEventInput, ScheduleServiceType } from './port';

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
  sourceInput?: CreateScheduleEventInput;
};
