import { readOptionalEnv } from '@/lib/env';
import type { StaffAttendancePort } from './port';
import { localStorageStaffAttendanceAdapter, sharePointStaffAttendanceAdapter } from './adapters';

export type StaffAttendanceStorageKind = 'local' | 'sharepoint';

export const getStaffAttendancePort = (): StaffAttendancePort => {
  const kind = (readOptionalEnv('VITE_STAFF_ATTENDANCE_STORAGE') ?? 'local') as StaffAttendanceStorageKind;
  if (kind === 'sharepoint') {
    return sharePointStaffAttendanceAdapter;
  }
  return localStorageStaffAttendanceAdapter;
};
