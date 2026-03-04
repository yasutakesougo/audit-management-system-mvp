/**
 * useTodaysMeetings - Today's Meeting Operations Hook
 *
 * Automatically manages today's morning and evening meetings.
 * Extracted from useMeetingData.ts for single-responsibility.
 */

import { useCallback } from 'react';
import type { MeetingSession } from './meetingDataTypes';
import { generateMeetingSessionKey } from './meetingDataTypes';
import { useMeetingData } from './useMeetingData';
import { useMeetingSession } from './useMeetingSession';
import { toLocalDateISO } from '@/utils/getNow';

/**
 * Hook for今日の会議 operations
 * Automatically manages today's morning and evening meetings
 */
export function useTodaysMeetings() {
  const meetingData = useMeetingData();
  const today = toLocalDateISO();

  const morningSessionKey = generateMeetingSessionKey(today, 'morning');
  const eveningSessionKey = generateMeetingSessionKey(today, 'evening');

  const morningSession = useMeetingSession(morningSessionKey, 'morning');
  const eveningSession = useMeetingSession(eveningSessionKey, 'evening');

  const createTodaysMorningMeeting = useCallback(async (chairpersonUserId: string, chairpersonName: string) => {
    const now = new Date().toISOString();
    const sessionData: Omit<MeetingSession, 'id'> = {
      sessionKey: morningSessionKey,
      meetingKind: 'morning',
      date: today,
      chairpersonUserId,
      chairpersonName,
      status: 'scheduled',
      totalParticipants: 1,
      completedSteps: 0,
      totalSteps: 5, // From MORNING_STEP_TEMPLATES
      completionRate: 0,
      createdAt: now,
      updatedAt: now,
    };
    return await meetingData.createMeetingSession(sessionData);
  }, [meetingData, morningSessionKey, today]);

  const createTodaysEveningMeeting = useCallback(async (chairpersonUserId: string, chairpersonName: string) => {
    const now = new Date().toISOString();
    const sessionData: Omit<MeetingSession, 'id'> = {
      sessionKey: eveningSessionKey,
      meetingKind: 'evening',
      date: today,
      chairpersonUserId,
      chairpersonName,
      status: 'scheduled',
      totalParticipants: 1,
      completedSteps: 0,
      totalSteps: 4, // From EVENING_STEP_TEMPLATES
      completionRate: 0,
      createdAt: now,
      updatedAt: now,
    };
    return await meetingData.createMeetingSession(sessionData);
  }, [meetingData, eveningSessionKey, today]);

  return {
    today,
    morning: morningSession,
    evening: eveningSession,
    createTodaysMorningMeeting,
    createTodaysEveningMeeting,
    loading: meetingData.loading,
    error: meetingData.error,
  };
}
