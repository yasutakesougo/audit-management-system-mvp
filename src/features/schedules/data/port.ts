import type { ScheduleServiceType as SpScheduleServiceType } from '@/sharepoint/serviceTypes';

export type ScheduleCategory = 'User' | 'Staff' | 'Org';

// SharePoint と同じサービス区分を利用して型の乖離を防ぐ
export type ScheduleServiceType = SpScheduleServiceType;

export type ScheduleStatus = 'Planned' | 'Postponed' | 'Cancelled';

export type DateRange = {
  from: string;
  to: string;
};

export type CreateScheduleEventInput = {
  title: string;
  category: ScheduleCategory;
  startLocal: string;
  endLocal: string;
  serviceType: ScheduleServiceType;

  userId?: string;
  userLookupId?: string;
  userName?: string;

  locationName?: string;
  notes?: string;

  assignedStaffId?: string;
  vehicleId?: string;

  status?: ScheduleStatus;
  statusReason?: string | null;

  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
};

export type UpdateScheduleEventInput = CreateScheduleEventInput & { id: string };

export type SchedItem = {
  id: string;
  title: string;
  start: string;
  end: string;

  category?: ScheduleCategory;

  userId?: string;
  userLookupId?: string;
  personName?: string;

  serviceType?: ScheduleServiceType;
  subType?: string | null;

  locationName?: string;
  location?: string;

  notes?: string;
  note?: string;

  assignedStaffId?: string;
  staffNames?: string[];
  vehicleId?: string;

  status?: ScheduleStatus;
  statusReason?: string | null;

  entryHash?: string;
  createdAt?: string;
  updatedAt?: string;

  allDay?: boolean;
  dayKey?: string;
  monthKey?: string;

  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
};

export interface SchedulesPort {
  list(range: DateRange): Promise<SchedItem[]>;
  create(input: CreateScheduleEventInput): Promise<SchedItem>;
  update?: (input: UpdateScheduleEventInput) => Promise<SchedItem>;
  remove?: (eventId: string) => Promise<void>;
}
