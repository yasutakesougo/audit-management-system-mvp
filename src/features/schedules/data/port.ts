import type { ScheduleCategory, ScheduleItemCore, ScheduleVisibility, ScheduleStatus, ScheduleServiceType } from '@/features/schedules/domain';
export type { ScheduleCategory, ScheduleVisibility, ScheduleStatus, ScheduleServiceType } from '@/features/schedules/domain';
import type { Result } from '@/shared/result';

export type DateRange = { from: string; to: string };

export type CreateScheduleEventInput = {
  title: string;
  category: ScheduleCategory;
  startLocal: string;
  endLocal: string;
  serviceType?: ScheduleServiceType | string | null;
  userId?: string;
  userLookupId?: string;
  userName?: string;
  assignedStaffId?: string;
  locationName?: string;
  notes?: string;
  vehicleId?: string;
  status?: ScheduleStatus;
  statusReason?: string | null;
  // Added for approval tracking
  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
  // Phase 1: owner and visibility
  ownerUserId?: string;
  visibility?: ScheduleVisibility;
  currentOwnerUserId?: string;
};

export type UpdateScheduleEventInput = CreateScheduleEventInput & {
  id: string;
};

export type SchedItem = ScheduleItemCore;

export interface SchedulesPort {
  list: (range: DateRange) => Promise<SchedItem[]>;
  create?: (input: CreateScheduleEventInput) => Promise<Result<SchedItem>>;
  update?: (input: UpdateScheduleEventInput) => Promise<Result<SchedItem>>;
  remove?: (id: string) => Promise<void>;
}
