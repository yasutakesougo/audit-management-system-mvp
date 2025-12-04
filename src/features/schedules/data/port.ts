export type DateRange = { from: string; to: string };

export type ScheduleCategory = 'User' | 'Staff' | 'Org';

export type ScheduleServiceType = 'normal' | 'transport' | 'respite' | 'nursing' | 'absence' | 'late' | 'earlyLeave' | 'other';

export type ScheduleStatus = 'Planned' | 'Postponed' | 'Cancelled';

export type CreateScheduleEventInput = {
  title: string;
  category: ScheduleCategory;
  startLocal: string;
  endLocal: string;
  serviceType: ScheduleServiceType;
  userId?: string;
  userLookupId?: string;
  userName?: string;
  assignedStaffId?: string;
  locationName?: string;
  notes?: string;
  vehicleId?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
};

export type UpdateScheduleEventInput = CreateScheduleEventInput & {
  id: string;
};

export type SchedItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  userId?: string;
  userLookupId?: string;
  category?: ScheduleCategory;
  serviceType?: string;
  locationName?: string;
  location?: string;
  notes?: string;
  note?: string;
  subType?: string;
  assignedStaffId?: string;
  staffNames?: string[];
  vehicleId?: string;
  personName?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
  entryHash?: string;
  allDay?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export interface SchedulesPort {
  list(range: DateRange): Promise<SchedItem[]>;
  create(input: CreateScheduleEventInput): Promise<SchedItem>;
  update?(input: UpdateScheduleEventInput): Promise<SchedItem>;
  remove?(eventId: string): Promise<void>;
}
