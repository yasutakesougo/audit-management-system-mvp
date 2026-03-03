/**
 * Meeting Data API Hook — Lightweight Façade
 *
 * Phase 4C: External Data 布石 - API Integration
 *
 * Provides SharePoint persistence and synchronization for朝会・夕会 meeting data.
 * Delegates CRUD operations to dedicated API modules under ./api/.
 *
 * @see ./api/meetingSessionApi.ts - Session CRUD
 * @see ./api/meetingStepApi.ts - Step CRUD
 * @see ./api/meetingParticipationApi.ts - Participation CRUD
 * @see ./api/meetingPriorityApi.ts - Priority Record CRUD
 */

import { readOptionalEnv } from '@/lib/env';
import { useSP } from '@/lib/spClient';
import { useCallback, useMemo, useState } from 'react';
import { createMeetingParticipationApi } from './api/meetingParticipationApi';
import { createMeetingPriorityApi } from './api/meetingPriorityApi';
import { createMeetingSessionApi } from './api/meetingSessionApi';
import { createMeetingStepApi } from './api/meetingStepApi';
import { meetingLogger } from './logging/meetingLogger';
import type {
    MeetingKind,
    MeetingParticipation,
    MeetingPriorityRecord,
    MeetingSession,
    MeetingStepRecord,
} from './meetingDataTypes';

// Feature flags
const MEETING_PERSISTENCE_ENABLED = readOptionalEnv('VITE_MEETING_PERSISTENCE_ENABLED') === 'true';

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
  // State Helpers
  // ──────────────────────────────────────────────────────────────

  const updateState = useCallback((updater: (prev: MeetingDataState) => Partial<MeetingDataState>) => {
    setState(prev => ({ ...prev, ...updater(prev) }));
  }, []);

  const setError = useCallback((error: string | Error) => {
    updateState(() => ({ error: typeof error === 'string' ? error : error.message, loading: false, syncing: false }));
  }, [updateState]);

  const resetError = useCallback(() => {
    updateState(() => ({ error: null }));
  }, [updateState]);

  const setLoading = useCallback((loading: boolean) => {
    updateState(() => ({ loading }));
  }, [updateState]);

  const setSyncing = useCallback((syncing: boolean) => {
    updateState(() => ({ syncing }));
  }, [updateState]);

  // ──────────────────────────────────────────────────────────────
  // API Layer Instantiation
  // ──────────────────────────────────────────────────────────────

  const deps = useMemo(
    () => ({ spFetch, getListItemsByTitle, addListItemByTitle }),
    [spFetch, getListItemsByTitle, addListItemByTitle],
  );

  const sessionApi = useMemo(() => createMeetingSessionApi(deps), [deps]);
  const stepApi = useMemo(() => createMeetingStepApi(deps), [deps]);
  const participationApi = useMemo(() => createMeetingParticipationApi(deps), [deps]);
  const priorityApi = useMemo(() => createMeetingPriorityApi(deps), [deps]);

  // ──────────────────────────────────────────────────────────────
  // Persistence Guard + State Wrapper Pattern
  // ──────────────────────────────────────────────────────────────

  const guardPersistence = useCallback(<T>(operation: string, fn: () => Promise<T>): Promise<T> => {
    if (!enablePersistence) {
      throw new Error(`Meeting persistence is disabled (operation: ${operation})`);
    }
    return fn();
  }, [enablePersistence]);

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setLoading(true);
    resetError();
    try {
      const result = await fn();
      setLoading(false);
      return result;
    } catch (error) {
      setError(error as Error);
      throw error;
    }
  }, [setLoading, resetError, setError]);

  // ──────────────────────────────────────────────────────────────
  // Session Management
  // ──────────────────────────────────────────────────────────────

  const createMeetingSession = useCallback(async (sessionData: Omit<MeetingSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingSession> => {
    return guardPersistence('createSession', () => withLoading(async () => {
      try {
        const session = await sessionApi.create(sessionData);
        updateState(prev => ({
          sessions: [...prev.sessions, session],
          lastSyncTime: new Date().toISOString(),
        }));
        return session;
      } catch (error) {
        meetingLogger.sharePointSyncFailed({
          sessionKey: sessionData.sessionKey,
          operation: 'create',
          error,
        });
        throw error;
      }
    }));
  }, [guardPersistence, withLoading, sessionApi, updateState]);

  const updateMeetingSession = useCallback(async (sessionId: number, updates: Partial<MeetingSession>): Promise<MeetingSession> => {
    return guardPersistence('updateSession', () => withLoading(async () => {
      const merged = await sessionApi.update(sessionId, updates);
      updateState(prev => ({
        sessions: prev.sessions.map(s => s.id === sessionId ? merged : s),
        currentSession: prev.currentSession?.id === sessionId ? merged : prev.currentSession,
        lastSyncTime: new Date().toISOString(),
      }));
      return merged;
    }));
  }, [guardPersistence, withLoading, sessionApi, updateState]);

  const getMeetingSession = useCallback(async (sessionId: number): Promise<MeetingSession | null> => {
    return withLoading(() => sessionApi.getById(sessionId));
  }, [withLoading, sessionApi]);

  const getMeetingSessionByKey = useCallback(async (sessionKey: string): Promise<MeetingSession | null> => {
    return withLoading(() => sessionApi.getByKey(sessionKey));
  }, [withLoading, sessionApi]);

  const listMeetingSessions = useCallback(async (dateFrom?: string, dateTo?: string, kind?: MeetingKind): Promise<MeetingSession[]> => {
    return withLoading(async () => {
      const sessions = await sessionApi.list(dateFrom, dateTo, kind);
      updateState(() => ({
        sessions,
        lastSyncTime: new Date().toISOString(),
      }));
      return sessions;
    });
  }, [withLoading, sessionApi, updateState]);

  // ──────────────────────────────────────────────────────────────
  // Step Management
  // ──────────────────────────────────────────────────────────────

  const updateMeetingStep = useCallback(async (sessionId: number, stepId: number, updates: Partial<MeetingStepRecord>): Promise<MeetingStepRecord> => {
    return guardPersistence('updateStep', () => withLoading(() => stepApi.upsert(sessionId, stepId, updates)));
  }, [guardPersistence, withLoading, stepApi]);

  const addMeetingStep = useCallback(async (sessionId: number, stepData: {
    stepId: number;
    stepTitle?: string;
    completed: boolean;
    completedAt?: string;
    completedByUserId?: string;
    timeSpent: number;
    stepNotes: string;
  }): Promise<MeetingStepRecord> => {
    return guardPersistence('addStep', () => withLoading(() => stepApi.add(sessionId, stepData)));
  }, [guardPersistence, withLoading, stepApi]);

  const getMeetingSteps = useCallback(async (sessionId: number): Promise<MeetingStepRecord[]> => {
    return withLoading(() => stepApi.getBySession(sessionId));
  }, [withLoading, stepApi]);

  const getMeetingStepsBySession = useCallback(async (sessionId: number): Promise<MeetingStepRecord[]> => {
    if (!enablePersistence) return [];
    return withLoading(() => stepApi.getBySession(sessionId));
  }, [enablePersistence, withLoading, stepApi]);

  // ──────────────────────────────────────────────────────────────
  // Participation Management
  // ──────────────────────────────────────────────────────────────

  const addParticipant = useCallback(async (participationData: Omit<MeetingParticipation, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingParticipation> => {
    return guardPersistence('addParticipant', () => withLoading(async () => {
      try {
        return await participationApi.add(participationData);
      } catch (error) {
        meetingLogger.sharePointSyncFailed({
          sessionKey: participationData.sessionKey,
          operation: 'create',
          error,
        });
        throw error;
      }
    }));
  }, [guardPersistence, withLoading, participationApi]);

  const updateParticipation = useCallback(async (participationId: number, updates: Partial<MeetingParticipation>): Promise<MeetingParticipation> => {
    return guardPersistence('updateParticipation', () => withLoading(() => participationApi.update(participationId, updates)));
  }, [guardPersistence, withLoading, participationApi]);

  const getMeetingParticipants = useCallback(async (sessionId: number): Promise<MeetingParticipation[]> => {
    if (!enablePersistence) return [];
    return withLoading(() => participationApi.getBySession(sessionId));
  }, [enablePersistence, withLoading, participationApi]);

  // ──────────────────────────────────────────────────────────────
  // Priority Record Management
  // ──────────────────────────────────────────────────────────────

  const addPriorityRecord = useCallback(async (priorityData: Omit<MeetingPriorityRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MeetingPriorityRecord> => {
    return guardPersistence('addPriority', () => withLoading(async () => {
      try {
        return await priorityApi.add(priorityData);
      } catch (error) {
        meetingLogger.sharePointSyncFailed({
          sessionKey: priorityData.sessionKey,
          operation: 'create',
          error,
        });
        throw error;
      }
    }));
  }, [guardPersistence, withLoading, priorityApi]);

  const updatePriorityRecord = useCallback(async (priorityId: number, updates: Partial<MeetingPriorityRecord>): Promise<MeetingPriorityRecord> => {
    return guardPersistence('updatePriority', () => withLoading(() => priorityApi.update(priorityId, updates)));
  }, [guardPersistence, withLoading, priorityApi]);

  const getMeetingPriorities = useCallback(async (sessionId: number): Promise<MeetingPriorityRecord[]> => {
    if (!enablePersistence) return [];
    return withLoading(() => priorityApi.getBySession(sessionId));
  }, [enablePersistence, withLoading, priorityApi]);

  // ──────────────────────────────────────────────────────────────
  // Sync Operations
  // ──────────────────────────────────────────────────────────────

  const refreshFromSharePoint = useCallback(async (): Promise<void> => {
    if (!enablePersistence) return;
    setLoading(true);
    resetError();
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      await listMeetingSessions(thirtyDaysAgo.toISOString().split('T')[0]);
    } catch (error) {
      setError(error as Error);
    }
  }, [enablePersistence, listMeetingSessions, setLoading, resetError, setError]);

  const syncToSharePoint = useCallback(async (): Promise<void> => {
    if (!enablePersistence) return;
    setSyncing(true);
    resetError();
    try {
      await refreshFromSharePoint();
    } catch (error) {
      setError(error as Error);
    } finally {
      setSyncing(false);
    }
  }, [enablePersistence, setSyncing, resetError, refreshFromSharePoint, setError]);

  // ──────────────────────────────────────────────────────────────
  // Utility Functions
  // ──────────────────────────────────────────────────────────────

  const setCurrentSession = useCallback((session: MeetingSession | undefined) => {
    updateState(() => ({ currentSession: session }));
  }, [updateState]);

  const getMeetingSessionsByDate = useCallback(async (date: string): Promise<MeetingSession[]> => {
    if (!enablePersistence) return [];
    return withLoading(() => sessionApi.getByDate(date));
  }, [enablePersistence, withLoading, sessionApi]);

  const getMeetingPriorityRecords = useCallback(async (sessionId: number): Promise<MeetingPriorityRecord[]> => {
    if (!enablePersistence) return [];
    return withLoading(() => priorityApi.getBySession(sessionId));
  }, [enablePersistence, withLoading, priorityApi]);

  // ──────────────────────────────────────────────────────────────
  // Return combined state and actions
  // ──────────────────────────────────────────────────────────────

  return useMemo(() => ({
    ...state,
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

// Re-export useMeetingSession for backward compatibility
export { useMeetingSession } from './useMeetingSession';
