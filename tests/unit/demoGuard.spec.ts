import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as envModule from '@/lib/env';
import { useSchedules } from '@/features/schedules/hooks/useSchedules';
import { useDaily } from '@/features/daily/hooks/useDaily';
import { useAttendanceStore } from '@/features/attendance/store';
import { 
  resetAttendanceRepository, 
  getCurrentAttendanceRepositoryKind 
} from '@/features/attendance/repositoryFactory';
import { 
  resetDailyRecordRepository, 
  getCurrentDailyRecordRepositoryKind 
} from '@/features/daily/repositoryFactory';
import { 
  resetScheduleRepository, 
  getCurrentScheduleRepositoryKind 
} from '@/features/schedules/repositoryFactory';

// Mock env module
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof envModule>();
  return {
    ...actual,
    isDemoModeEnabled: vi.fn(),
    isTestMode: vi.fn(),
    readBool: vi.fn(),
    shouldSkipLogin: vi.fn().mockReturnValue(false),
    shouldSkipSharePoint: vi.fn().mockReturnValue(false),
    isForceDemoEnabled: vi.fn().mockReturnValue(false),
    getAppConfig: vi.fn().mockReturnValue({
      forceDemo: false,
    }),
  };
});

// Mock SP config to avoid ensureConfig errors in createReal
vi.mock('@/lib/sp/config', () => ({
  ensureConfig: vi.fn().mockReturnValue({ baseUrl: 'https://demo' }),
}));

// Mock useUsers for attendance store
vi.mock('@/features/users', () => ({
  useUsers: () => ({ data: [{ Id: 1, UserID: 'U001' }] }),
}));

describe('Demo Mode Guards', () => {
  beforeEach(() => {
    vi.mocked(envModule.readBool).mockReturnValue(false);
    vi.mocked(envModule.isForceDemoEnabled).mockReturnValue(false);
    vi.mocked(envModule.shouldSkipLogin).mockReturnValue(false);
    vi.mocked(envModule.shouldSkipSharePoint).mockReturnValue(false);
    resetAttendanceRepository();
    resetDailyRecordRepository();
    resetScheduleRepository();
  });

  describe('Attendance Repository Selection', () => {
    it('should use REAL repository when demo mode is OFF', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(false);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useAttendanceStore());
      expect(getCurrentAttendanceRepositoryKind()).toBe('real');
    });

    it('should use DEMO repository when demo mode is ON', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(true);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useAttendanceStore());
      expect(getCurrentAttendanceRepositoryKind()).toBe('demo');
    });
  });

  describe('Daily Record Repository Selection', () => {
    it('should use REAL repository when demo mode is OFF', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(false);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useDaily());
      expect(getCurrentDailyRecordRepositoryKind()).toBe('real');
    });

    it('should use DEMO repository when demo mode is ON', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(true);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useDaily());
      expect(getCurrentDailyRecordRepositoryKind()).toBe('demo');
    });
  });

  describe('Schedule Repository Selection', () => {
    it('should use REAL repository when demo mode is OFF', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(false);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useSchedules());
      expect(getCurrentScheduleRepositoryKind()).toBe('real');
    });

    it('should use DEMO repository when demo mode is ON', () => {
      vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(true);
      vi.mocked(envModule.isTestMode).mockReturnValue(false);
      
      renderHook(() => useSchedules());
      expect(getCurrentScheduleRepositoryKind()).toBe('demo');
    });
  });
});
