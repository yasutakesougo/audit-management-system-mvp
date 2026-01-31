import { readOptionalEnv } from '@/lib/env';
import type { StaffAttendancePort } from './port';
import { localStorageStaffAttendanceAdapter, sharePointStaffAttendanceAdapter } from './adapters';

export type StaffAttendanceStorageKind = 'local' | 'sharepoint';

const parseBoolean = (value?: string, fallback = true): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
};

export const getStaffAttendanceStorageKind = (): StaffAttendanceStorageKind => {
  return (readOptionalEnv('VITE_STAFF_ATTENDANCE_STORAGE') ?? 'local') as StaffAttendanceStorageKind;
};

export const getStaffAttendanceWriteEnabled = (): boolean => {
  const explicit = readOptionalEnv('VITE_STAFF_ATTENDANCE_WRITE');
  if (explicit !== undefined) return parseBoolean(explicit, true);
  const globalWrite = readOptionalEnv('VITE_WRITE_ENABLED');
  return parseBoolean(globalWrite, true);
};

export const getStaffAttendancePort = (): StaffAttendancePort => {
  const kind = getStaffAttendanceStorageKind();
  if (kind === 'sharepoint') {
    return sharePointStaffAttendanceAdapter;
  }
  return localStorageStaffAttendanceAdapter;
};
