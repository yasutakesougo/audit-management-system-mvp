/**
 * Meeting Data API Hook
 *
 * Phase 4C: External Data 布石 - API Integration
 *
 * Provides SharePoint persistence and synchronization for朝会・夕会 meeting data.
 * Follows established patterns from:
 * - useSP hook (src/lib/spClient.ts)
 * - Monthly records API (src/features/records/monthly/)
 * - Legacy schedule API (removed in Phase 2-C)
 */

import { estimatePayloadSize, HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { readOptionalEnv } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { meetingLogger } from './logging/meetingLogger';
import type {
    MeetingKind,
    MeetingParticipation,
    MeetingPriorityRecord,
    MeetingSession,
    MeetingStepId,
    MeetingStepRecord,
    SpMeetingSessionItem,
    SpMeetingStepItem
} from './meetingDataTypes';
import {
    fromSpMeetingSessionFields,
    fromSpMeetingStepFields,
    generateMeetingSessionKey,
    MEETING_LIST_NAMES,
    MEETING_SELECT_FIELDS,
    toSpMeetingSessionFields,
    toSpMeetingStepFields
} from './meetingDataTypes';

// Environment-driven list configuration
const SESSIONS_LIST = readOptionalEnv('VITE_SP_LIST_MEETING_SESSIONS') || MEETING_LIST_NAMES.SESSIONS;
const STEPS_LIST = readOptionalEnv('VITE_SP_LIST_MEETING_STEPS') || MEETING_LIST_NAMES.STEPS;
// const PARTICIPATION_LIST = readOptionalEnv('VITE_SP_LIST_MEETING_PARTICIPATION') || MEETING_LIST_NAMES.PARTICIPATION;
// const PRIORITY_LIST = readOptionalEnv('VITE_SP_LIST_MEETING_PRIORITY') || MEETING_LIST_NAMES.PRIORITY_RECORDS;

// Feature flags
const MEETING_PERSISTENCE_ENABLED = readOptionalEnv('VITE_MEETING_PERSISTENCE_ENABLED') === 'true';
// const MEETING_AUTO_SYNC_ENABLED = readOptionalEnv('VITE_MEETING_AUTO_SYNC_ENABLED') === 'true';

export interface UseMeetingDataOptions {
  autoSync?: boolean;
  enablePersistence?: boolean;
}

export interface MeetingDataState {
  sessions: MeetingSession[];
  currentSession?: MeetingSession;
  loading: boolean;
  error: string | null;
  syncing: boolean;
  lastSyncTime?: string;
}

export interface MeetingDataActions {
  // Session management
  createMeetingSession: (session: Omit<MeetingSession, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MeetingSession>;
  updateMeetingSession: (sessionId: number, updates: Partial<MeetingSession>) => Promise<MeetingSession>;
  getMeetingSession: (sessionId: number) => Promise<MeetingSession | null>;
  getMeetingSessionByKey: (sessionKey: string) => Promise<MeetingSession | null>;
  listMeetingSessions: (dateFrom?: string, dateTo?: string, kind?: MeetingKind) => Promise<MeetingSession[]>;

  // Step management
  updateMeetingStep: (sessionId: number, stepId: number, updates: Partial<MeetingStepRecord>) => Promise<MeetingStepRecord>;
  getMeetingSteps: (sessionId: number) => Promise<MeetingStepRecord[]>;

  // Participation management
  addParticipant: (participation: Omit<MeetingParticipation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MeetingParticipation>;
  updateParticipation: (participationId: number, updates: Partial<MeetingParticipation>) => Promise<MeetingParticipation>;
  getMeetingParticipants: (sessionId: number) => Promise<MeetingParticipation[]>;

  // Priority user management
  addPriorityRecord: (priority: Omit<MeetingPriorityRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<MeetingPriorityRecord>;
  updatePriorityRecord: (priorityId: number, updates: Partial<MeetingPriorityRecord>) => Promise<MeetingPriorityRecord>;
  getMeetingPriorities: (sessionId: number) => Promise<MeetingPriorityRecord[]>;

  // Sync operations
  syncToSharePoint: () => Promise<void>;
  refreshFromSharePoint: () => Promise<void>;

  // Utility functions
  resetError: () => void;
  setCurrentSession: (session: MeetingSession | undefined) => void;
}

export function useMeetingData(options: UseMeetingDataOptions = {}): MeetingDataState & MeetingDataActions {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = useSP();
  const [state, setState] = useState<MeetingDataState>({
    sessions: [],
    currentSession: undefined,
    loading: false,
    error: null,
    syncing: false,
    lastSyncTime: undefined,
  });

  const { enablePersistence = MEETING_PERSISTENCE_ENABLED } = options;

  // ──────────────────────────────────────────────────────────────
  // Helper Functions
  // ──────────────────────────────────────────────────────────────

  const updateState = useCallback((updater: (prev: MeetingDataState) => Partial<MeetingDataState>) => {
    setState(prev => ({ ...prev, ...updater(prev) }));
  }, []);

  const setError = useCallback((error: string | Error) => {
    updateState(_prev => ({ error: typeof error === 'string' ? error : error.message, loading: false, syncing: false }));
  }, [updateState]);

  const resetError = useCallback(() => {
    updateState(_prev => ({ error: null }));
  }, [updateState]);

  const setLoading = useCallback((loading: boolean) => {
    updateState(_prev => ({ loading }));
  }, [updateState]);

  const setSyncing = useCallback((syncing: boolean) => {
    updateState(_prev => ({ syncing }));
  }, [updateState]);

  // ──────────────────────────────────────────────────────────────
  // Session Management
  // ──────────────────────────────────────────────────────────────

  const createMeetingSession = useCallback(async (sessionData: Omit<MeetingSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingSession> => {
    if (!enablePersistence) {
      throw new Error('Meeting persistence is disabled');
    }

    setLoading(true);
    resetError();

    try {
      const now = new Date().toISOString();
      const sessionWithTimestamps: MeetingSession = {
        ...sessionData,
        createdAt: now,
        updatedAt: now,
      };

      const spFields = toSpMeetingSessionFields(sessionWithTimestamps);
      const result = await addListItemByTitle(SESSIONS_LIST, spFields) as { Id: number; Created: string; Modified: string };

      const createdSession: MeetingSession = {
        ...sessionWithTimestamps,
        id: result.Id,
        createdAt: result.Created || now,
        updatedAt: result.Modified || now,
      };

      // Update local state
      updateState(prev => ({
        sessions: [...prev.sessions, createdSession],
        loading: false,
        lastSyncTime: now,
      }));

      // Log session creation
      meetingLogger.sessionUpserted({
        sessionKey: createdSession.sessionKey,
        kind: createdSession.meetingKind,
        stepCount: 0, // 新規作成時はステップ数0
        completedCount: 0,
        isNew: true,
      });

      meetingLogger.sharePointSyncSucceeded({
        sessionKey: createdSession.sessionKey,
        operation: 'create',
      });

      return createdSession;
    } catch (error) {
      setError(error as Error);

      // Log SharePoint sync failure
      meetingLogger.sharePointSyncFailed({
        sessionKey: sessionData.sessionKey,
        operation: 'create',
        error,
      });

      throw error;
    }
  }, [enablePersistence, addListItemByTitle, setLoading, resetError, updateState, setError]);

  const updateMeetingSession = useCallback(async (sessionId: number, updates: Partial<MeetingSession>): Promise<MeetingSession> => {
    if (!enablePersistence) {
      throw new Error('Meeting persistence is disabled');
    }

    setLoading(true);
    resetError();

    try {
      const now = new Date().toISOString();
      const updatesWithTimestamp = { ...updates, updatedAt: now };

      // Get current session for merging
      const currentSessions = await getListItemsByTitle<SpMeetingSessionItem>(SESSIONS_LIST, [MEETING_SELECT_FIELDS.SESSIONS], `Id eq ${sessionId}`);

      if (currentSessions.length === 0) {
        throw new Error(`Meeting session ${sessionId} not found`);
      }

      const currentSession = fromSpMeetingSessionFields(currentSessions[0]);
      const mergedSession = { ...currentSession, ...updatesWithTimestamp };

      const spFields = toSpMeetingSessionFields(mergedSession);

      // Use spFetch directly for PATCH operations
      const updateResult = await spFetch(`/lists/getbytitle('${SESSIONS_LIST}')/items(${sessionId})`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: JSON.stringify(spFields),
      });

      if (!updateResult.ok) {
        throw new Error('Failed to update meeting session');
      }

      // Update local state
      updateState(prev => ({
        sessions: prev.sessions.map((s: MeetingSession) => s.id === sessionId ? mergedSession : s),
        currentSession: prev.currentSession?.id === sessionId ? mergedSession : prev.currentSession,
        loading: false,
        lastSyncTime: now,
      }));

      return mergedSession;
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [enablePersistence, getListItemsByTitle, setLoading, resetError, updateState, setError]);

  const getMeetingSession = useCallback(async (sessionId: number): Promise<MeetingSession | null> => {
    setLoading(true);
    resetError();

    try {
      const sessions = await getListItemsByTitle<SpMeetingSessionItem>(SESSIONS_LIST, [MEETING_SELECT_FIELDS.SESSIONS], `Id eq ${sessionId}`);

      setLoading(false);

      if (sessions.length === 0) {
        return null;
      }

      return fromSpMeetingSessionFields(sessions[0]);
    } catch (error) {
      setError(error as Error);
      return null;
    }
  }, [getListItemsByTitle, setLoading, resetError, setError]);

  const getMeetingSessionByKey = useCallback(async (sessionKey: string): Promise<MeetingSession | null> => {
    setLoading(true);
    resetError();

    try {
      const sessions = await getListItemsByTitle<SpMeetingSessionItem>(SESSIONS_LIST, [MEETING_SELECT_FIELDS.SESSIONS], `SessionKey eq '${sessionKey}'`);

      setLoading(false);

      if (sessions.length === 0) {
        return null;
      }

      return fromSpMeetingSessionFields(sessions[0]);
    } catch (error) {
      setError(error as Error);
      return null;
    }
  }, [getListItemsByTitle, setLoading, resetError, setError]);

  const listMeetingSessions = useCallback(async (
    dateFrom?: string,
    dateTo?: string,
    kind?: MeetingKind
  ): Promise<MeetingSession[]> => {
    setLoading(true);
    resetError();

    try {
      const filterParts: string[] = [];

      if (dateFrom) {
        filterParts.push(`Date ge '${dateFrom}'`);
      }

      if (dateTo) {
        filterParts.push(`Date le '${dateTo}'`);
      }

      if (kind) {
        filterParts.push(`MeetingKind eq '${kind}'`);
      }

      const filterString = filterParts.join(' and ');

      const sessions = await getListItemsByTitle<SpMeetingSessionItem>(
        SESSIONS_LIST,
        [MEETING_SELECT_FIELDS.SESSIONS],
        filterString || undefined,
        'Date desc'
      );

      const mappedSessions = sessions.map(fromSpMeetingSessionFields);

      updateState(_prev => ({
        sessions: mappedSessions,
        loading: false,
        lastSyncTime: new Date().toISOString(),
      }));

      return mappedSessions;
    } catch (error) {
      setError(error as Error);
      return [];
    }
  }, [getListItemsByTitle, setLoading, resetError, updateState, setError]);

  // ──────────────────────────────────────────────────────────────
  // Step Management
  // ──────────────────────────────────────────────────────────────

  const updateMeetingStep = useCallback(async (
    sessionId: number,
    stepId: number,
    updates: Partial<MeetingStepRecord>
  ): Promise<MeetingStepRecord> => {
    if (!enablePersistence) {
      throw new Error('Meeting persistence is disabled');
    }

    setLoading(true);
    resetError();

    try {
      const now = new Date().toISOString();
      const updatesWithTimestamp = { ...updates, updatedAt: now };

      // Find existing step record or create new one
      const existingSteps = await getListItemsByTitle<SpMeetingStepItem>(STEPS_LIST, [MEETING_SELECT_FIELDS.STEPS], `SessionId eq ${sessionId} and StepId eq ${stepId}`);

      let stepRecord: MeetingStepRecord;

      if (existingSteps.length > 0) {
        // Update existing step
        const currentStep = fromSpMeetingStepFields(existingSteps[0]);
        stepRecord = { ...currentStep, ...updatesWithTimestamp };

        const spFields = toSpMeetingStepFields(stepRecord);
        await spFetch(`/lists/getbytitle('${STEPS_LIST}')/items(${existingSteps[0].Id})`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE',
          },
          body: JSON.stringify(spFields),
        });
      } else {
        // Create new step record
        const session = await getMeetingSession(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        stepRecord = {
          sessionId,
          sessionKey: session.sessionKey,
          stepId: stepId as MeetingStepId,
          stepTitle: updates.stepTitle || `Step ${stepId}`,
          completed: false,
          timeSpentMinutes: 0,
          createdAt: now,
          ...updatesWithTimestamp,
        };

        const spFields = toSpMeetingStepFields(stepRecord);
        const result = await addListItemByTitle(STEPS_LIST, spFields) as { Id: number };
        stepRecord.id = result.Id;
      }

      setLoading(false);
      return stepRecord;
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [enablePersistence, getListItemsByTitle, addListItemByTitle, getMeetingSession, setLoading, resetError, setError]);

  const getMeetingSteps = useCallback(async (sessionId: number): Promise<MeetingStepRecord[]> => {
    setLoading(true);
    resetError();

    try {
      const steps = await getListItemsByTitle<SpMeetingStepItem>(STEPS_LIST, [MEETING_SELECT_FIELDS.STEPS], `SessionId eq ${sessionId}`, 'StepId');

      const mappedSteps = steps.map(fromSpMeetingStepFields);

      setLoading(false);
      return mappedSteps;
    } catch (error) {
      setError(error as Error);
      return [];
    }
  }, [getListItemsByTitle, setLoading, resetError, setError]);

  // ──────────────────────────────────────────────────────────────
  // Sync Operations
  // ──────────────────────────────────────────────────────────────

  const syncToSharePoint = useCallback(async (): Promise<void> => {
    if (!enablePersistence) {
      return;
    }

    setSyncing(true);
    resetError();

    try {
      // In a real implementation, this would sync any pending local changes
      // For now, we just refresh from SharePoint
      await refreshFromSharePoint();
    } catch (error) {
      setError(error as Error);
    } finally {
      setSyncing(false);
    }
  }, [enablePersistence, setSyncing, resetError, setError]);

  const refreshFromSharePoint = useCallback(async (): Promise<void> => {
    if (!enablePersistence) {
      return;
    }

    setLoading(true);
    resetError();

    try {
      // Get recent sessions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await listMeetingSessions(thirtyDaysAgo.toISOString().split('T')[0]);
    } catch (error) {
      setError(error as Error);
    }
  }, [enablePersistence, listMeetingSessions, setLoading, resetError, setError]);

  // ──────────────────────────────────────────────────────────────
  // Utility Functions
  // ──────────────────────────────────────────────────────────────

  const setCurrentSession = useCallback((session: MeetingSession | undefined) => {
    updateState(_prev => ({ currentSession: session }));
  }, [updateState]);

  // Get meeting sessions by date (YYYY-MM-DD format)
  const getMeetingSessionsByDate = useCallback(async (date: string): Promise<MeetingSession[]> => {
    if (!enablePersistence) return [];

    setLoading(true);
    resetError();

    try {
      const filter = `startswith(SessionKey,'${date}_')`;
      const sessions = await getListItemsByTitle<SpMeetingSessionItem>(SESSIONS_LIST, [MEETING_SELECT_FIELDS.SESSIONS], filter);

      setLoading(false);

      return sessions.map(fromSpMeetingSessionFields);
    } catch (error) {
      setError(error as Error);
      setLoading(false);
      throw error;
    }
  }, [enablePersistence, getListItemsByTitle, setLoading, resetError, setError]);

  // Get meeting step records by session ID
  const getMeetingStepsBySession = useCallback(async (sessionId: number): Promise<MeetingStepRecord[]> => {
    if (!enablePersistence) return [];

    setLoading(true);
    resetError();

    try {
      const filter = `SessionId eq ${sessionId}`;
      const steps = await getListItemsByTitle<SpMeetingStepItem>(STEPS_LIST, [MEETING_SELECT_FIELDS.STEPS], filter);

      setLoading(false);

      return steps.map(fromSpMeetingStepFields);
    } catch (error) {
      setError(error as Error);
      setLoading(false);
      throw error;
    }
  }, [enablePersistence, getListItemsByTitle, setLoading, resetError, setError]);

  // Get priority records by session ID (stubbed for Phase 5A)
  const getMeetingPriorityRecords = useCallback(async (_sessionId: number): Promise<MeetingPriorityRecord[]> => {
    if (!enablePersistence) return [];

    // TODO: Implement when PRIORITY_LIST is available
    return [];
  }, [enablePersistence]);

  // Add meeting step record
  const addMeetingStep = useCallback(async (sessionId: number, stepData: {
    stepId: number;
    stepTitle?: string;
    completed: boolean;
    completedAt?: string;
    completedByUserId?: string;
    timeSpent: number;
    stepNotes: string;
  }): Promise<MeetingStepRecord> => {
    if (!enablePersistence) {
      throw new Error('Persistence not enabled');
    }

    setLoading(true);
    resetError();

    try {
      const now = new Date().toISOString();
      const [sessionItem] = await getListItemsByTitle<SpMeetingSessionItem>(
        SESSIONS_LIST,
        [MEETING_SELECT_FIELDS.SESSIONS],
        `Id eq ${sessionId}`
      );

      if (!sessionItem) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const session = fromSpMeetingSessionFields(sessionItem);
      const newStepRecord: Omit<MeetingStepRecord, 'id'> = {
        sessionId,
        sessionKey: session.sessionKey,
        stepId: stepData.stepId as MeetingStepId,
        stepTitle: stepData.stepTitle ?? `Step ${stepData.stepId}`,
        completed: stepData.completed,
        completedAt: stepData.completedAt,
        completedByUserId: stepData.completedByUserId,
        timeSpentMinutes: stepData.timeSpent,
        stepNotes: stepData.stepNotes,
        createdAt: now,
        updatedAt: now,
      };

      const spFields = toSpMeetingStepFields(newStepRecord);

      const createResult = await spFetch(`/lists/getbytitle('${STEPS_LIST}')/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spFields),
      });

      if (!createResult.ok) {
        throw new Error('Failed to create meeting step record');
      }

      const createdItem = await createResult.json();
      setLoading(false);

      const normalizedItem: SpMeetingStepItem = {
        ...spFields,
        Id: createdItem.Id,
        Created: createdItem.Created ?? now,
        Modified: createdItem.Modified ?? now,
        '@odata.etag': createdItem['@odata.etag'],
      };

      return fromSpMeetingStepFields(normalizedItem);
    } catch (error) {
      setError(error as Error);
      setLoading(false);
      throw error;
    }
  }, [enablePersistence, getListItemsByTitle, spFetch, setLoading, resetError, setError]);

  // Placeholder implementations for remaining functions
  const addParticipant = useCallback(async (_participation: Omit<MeetingParticipation, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingParticipation> => {
    // TODO: Implement participation management
    throw new Error('Not implemented yet');
  }, []);

  const updateParticipation = useCallback(async (_participationId: number, _updates: Partial<MeetingParticipation>): Promise<MeetingParticipation> => {
    // TODO: Implement participation update
    throw new Error('Not implemented yet');
  }, []);

  const getMeetingParticipants = useCallback(async (_sessionId: number): Promise<MeetingParticipation[]> => {
    // TODO: Implement participant retrieval
    return [];
  }, []);

  const addPriorityRecord = useCallback(async (_priority: Omit<MeetingPriorityRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingPriorityRecord> => {
    // TODO: Implement priority record management
    throw new Error('Not implemented yet');
  }, []);

  const updatePriorityRecord = useCallback(async (_priorityId: number, _updates: Partial<MeetingPriorityRecord>): Promise<MeetingPriorityRecord> => {
    // TODO: Implement priority record update
    throw new Error('Not implemented yet');
  }, []);

  const getMeetingPriorities = useCallback(async (_sessionId: number): Promise<MeetingPriorityRecord[]> => {
    // TODO: Implement priority record retrieval
    return [];
  }, []);

  // Return combined state and actions
  return useMemo(() => ({
    // State
    ...state,

    // Actions
    createMeetingSession,
    updateMeetingSession,
    getMeetingSession,
    getMeetingSessionByKey,
    getMeetingSessionsByDate,
    listMeetingSessions,
    updateMeetingStep,
    addMeetingStep,
    getMeetingSteps,
    getMeetingStepsBySession,
    getMeetingPriorityRecords,
    addParticipant,
    updateParticipation,
    getMeetingParticipants,
    addPriorityRecord,
    updatePriorityRecord,
    getMeetingPriorities,
    syncToSharePoint,
    refreshFromSharePoint,
    resetError,
    setCurrentSession,
  }), [
    state,
    createMeetingSession,
    updateMeetingSession,
    getMeetingSession,
    getMeetingSessionByKey,
    getMeetingSessionsByDate,
    listMeetingSessions,
    updateMeetingStep,
    addMeetingStep,
    getMeetingSteps,
    getMeetingStepsBySession,
    getMeetingPriorityRecords,
    addParticipant,
    updateParticipation,
    getMeetingParticipants,
    addPriorityRecord,
    updatePriorityRecord,
    getMeetingPriorities,
    syncToSharePoint,
    refreshFromSharePoint,
    resetError,
    setCurrentSession,
  ]);
}

// ──────────────────────────────────────────────────────────────
// Utility Hooks for Specific Meeting Operations
// ──────────────────────────────────────────────────────────────

/**
 * Hook for managing a specific meeting session
 * Phase 5A: Simplified interface for MeetingGuidePage integration (Mock Implementation)
 */
export function useMeetingSession(sessionKey: string, kind: MeetingKind) {
  const [sessionState, setSessionState] = useState<{
    session: MeetingSession | null;
    stepRecords: MeetingStepRecord[];
    priorityRecords: MeetingPriorityRecord[];
    loading: boolean;
    error: Error | null;
  }>({
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
      // For now, just log the action
    } catch (error) {
      console.error('Failed to upsert step record:', error);

      // Log SharePoint sync failure
      meetingLogger.sharePointSyncFailed({
        sessionKey,
        operation: 'steps',
        error,
      });

      throw error;
    }
  }, [sessionState.session]);

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

/**
 * Hook for今日の会議 operations
 * Automatically manages today's morning and evening meetings
 */
export function useTodaysMeetings() {
  const meetingData = useMeetingData();
  const today = new Date().toISOString().split('T')[0];

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