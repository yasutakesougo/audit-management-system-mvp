export type ScheduleVisibility = 'org' | 'team' | 'private';
export type ScheduleCategory = 'User' | 'Staff' | 'Org';
export type ScheduleSource = 'sharepoint' | 'graph' | 'demo';
export type ScheduleStatus = 'Planned' | 'Postponed' | 'Cancelled';
export type ScheduleServiceType = 'absence' | 'late' | 'earlyLeave' | string;

export type ScheduleItemCore = {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  category?: ScheduleCategory;
  visibility?: ScheduleVisibility;
  location?: string;
  locationName?: string;
  notes?: string;
  allDay?: boolean;
  source?: ScheduleSource;
  updatedAt?: string;
  createdAt?: string;
  
  // Phase 1: user/staff assignment fields
  userId?: string;
  userLookupId?: string | number;
  personName?: string;
  assignedStaffId?: string;
  assignedTo?: string | null;
  vehicleId?: string;
  
  // Phase 1: approval/acceptance fields
  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
  
  // Phase 1: status and service type
  status?: ScheduleStatus;
  statusReason?: string | null;
  serviceType?: ScheduleServiceType;
  
  // Phase 1: metadata
  entryHash?: string;
  ownerUserId?: string;
  
  // Phase 2-0: conflict detection via etag
  etag: string;
};

export function normalizeVisibility(v?: string | null): ScheduleVisibility {
  if (v === 'org' || v === 'team' || v === 'private') return v;
  return 'team';
}
