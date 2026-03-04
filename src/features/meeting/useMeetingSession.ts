/**
 * useMeetingSession - Individual Meeting Session Hook
 *
 * Phase 5A: Simplified interface for MeetingGuidePage integration (Mock Implementation)
 * Extracted from useMeetingData.ts for single-responsibility.
 */

import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { useCallback, useEffect, useState } from 'react';
import { meetingLogger } from './logging/meetingLogger';
import type {
    MeetingKind,
    MeetingPriorityRecord,
    MeetingSession,
    MeetingStepRecord,
} from './meetingDataTypes';

interface MeetingSessionState {
  session: MeetingSession | null;
  stepRecords: MeetingStepRecord[];
  priorityRecords: MeetingPriorityRecord[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for managing a specific meeting session
 * Phase 5A: Simplified interface for MeetingGuidePage integration (Mock Implementation)
 */
export function useMeetingSession(sessionKey: string, kind: MeetingKind) {
  const [sessionState, setSessionState] = useState<MeetingSessionState>({
    session: null,
    stepRecords: [],
    priorityRecords: [],
    loading: true,
    error: null,
  });

  // Mock implementation for Phase 5A demo
  const loadSession = useCallback(async () => {
    setSessionState(prev => ({ ...prev, loading: true, error: null }));
    const span = startFeatureSpan(HYDRATION_FEATURES.meeting.load, {
      sessionKey,
      kind,
    });

    try {
      // Create a mock session for demo purposes
      const mockSession: MeetingSession = {
        id: 1,
        sessionKey,
        meetingKind: kind,
        date: sessionKey.split('_')[0],
        chairpersonUserId: 'current-user',
        chairpersonName: '司会者',
        status: 'scheduled',
        totalParticipants: 1,
        completedSteps: 0,
        totalSteps: kind === 'morning' ? 5 : 4,
        completionRate: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSessionState({
        session: mockSession,
        stepRecords: [],
        priorityRecords: [],
        loading: false,
        error: null,
      });

      span({
        meta: {
          status: 'ok',
          stepTemplateCount: mockSession.totalSteps,
          bytes: estimatePayloadSize(mockSession),
        },
      });
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));

      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [sessionKey, kind]);

  // Mock upsert step record function
  const upsertStepRecord = useCallback(async (stepData: {
    stepId: string;
    completed: boolean;
    stepNotes?: string;
  }) => {
    if (!sessionState.session) return;

    try {
      // eslint-disable-next-line no-console
      console.log('Mock upsertStepRecord:', stepData);

      // Log step toggle action
      meetingLogger.stepToggled({
        sessionKey,
        kind,
        stepId: stepData.stepId,
        stepTitle: `Step ${stepData.stepId}`, // In real implementation, get actual step title
        completed: stepData.completed,
      });

      // In real implementation, this would sync with SharePoint
    } catch (error) {
      console.error('Failed to upsert step record:', error);

      meetingLogger.sharePointSyncFailed({
        sessionKey,
        operation: 'steps',
        error,
      });

      throw error;
    }
  }, [sessionState.session, sessionKey, kind]);

  // Load session on mount or when sessionKey changes
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return {
    session: sessionState.session,
    stepRecords: sessionState.stepRecords,
    priorityRecords: sessionState.priorityRecords,
    loading: sessionState.loading,
    error: sessionState.error,
    upsertStepRecord,
    loadSession,
  };
}
