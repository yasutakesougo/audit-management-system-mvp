import { z } from 'zod';
import { SCHEDULE_STATUSES } from './types';

export const StatusZ = z.enum([...SCHEDULE_STATUSES]);

export const CategoryZ = z.enum(['Org', 'User', 'Staff']);

export const BaseScheduleZ = z.object({
  id: z.string().min(1, 'id is required'),
  etag: z.string().min(1, 'etag is required'),
  category: CategoryZ,
  title: z.string().min(1, 'title is required'),
  start: z.string().min(1, 'start is required'),
  end: z.string().min(1, 'end is required'),
  allDay: z.boolean(),
  status: StatusZ,
  location: z.string().optional(),
  notes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  dayKey: z.string().optional(),
  fiscalYear: z.string().optional(),
});

export const ScheduleZ = BaseScheduleZ;

export type StatusSchema = z.infer<typeof StatusZ>;
export type ScheduleSchema = z.infer<typeof ScheduleZ>;

export const ScheduleCreate = z.object({
  Title: z.string().min(1, 'タイトルを入力してください'),
  EventDate: z.string().datetime(),
  EndDate: z.string().datetime(),
  AllDay: z.boolean().optional(),
  Location: z.string().max(255).optional(),
  Status: z.enum(['Planned', 'InProgress', 'Done', 'Cancelled']).optional(),
  StaffIdId: z.number().optional(),
  UserIdId: z.number().optional(),
  Notes: z.string().optional(),
  RecurrenceJson: z.string().optional(),
});

export type ScheduleCreateInput = z.infer<typeof ScheduleCreate>;
