export type ScheduleVisibility = 'org' | 'team' | 'private';
export type ScheduleCategory = 'User' | 'Staff' | 'Org';
export type ScheduleSource = 'sharepoint' | 'graph' | 'demo';

export type ScheduleItemCore = {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  category: ScheduleCategory;
  visibility: ScheduleVisibility;
  location?: string;
  notes?: string;
  allDay?: boolean;
  source: ScheduleSource;
  updatedAt?: string;
  etag?: string;
};

export function normalizeVisibility(v?: string | null): ScheduleVisibility {
  if (v === 'org' || v === 'team' || v === 'private') return v;
  return 'team';
}
