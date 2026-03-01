import type { IUserMaster } from '@/features/users/types';
import type { AttendanceVisit } from './attendance.logic';

export type AttendanceRowVM = IUserMaster & AttendanceVisit;

export type AttendanceFilter = {
	date: string;
	query: string;
};

export type AttendanceHookStatus = 'loading' | 'success' | 'error';

export type AttendanceInputMode = 'normal' | 'checkInRun';
