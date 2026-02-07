import { useStaffAttendanceStore } from './store';
import type { StaffAttendance } from './types';

const STORAGE_KEY = 'staff-attendance.v1';

type PersistShape = {
  attendances: StaffAttendance[];
};

export function hydrateStaffAttendanceFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as PersistShape;
    if (!parsed?.attendances || !Array.isArray(parsed.attendances)) return;

    const store = useStaffAttendanceStore();
    parsed.attendances.forEach((att) => {
      store.upsert(att);
    });

    console.info(
      '[staff-attendance] hydrated from localStorage:',
      parsed.attendances.length
    );
  } catch (error) {
    console.warn('[staff-attendance] hydration failed:', error);
  }
}

export function saveStaffAttendanceToStorage(): void {
  try {
    const store = useStaffAttendanceStore();
    const attendances = store.listAll();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ attendances }));
  } catch (error) {
    console.warn('[staff-attendance] save failed:', error);
  }
}
