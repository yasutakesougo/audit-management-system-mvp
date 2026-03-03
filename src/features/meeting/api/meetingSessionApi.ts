/**
 * Meeting Session API Layer
 *
 * Pure functions for Session CRUD operations against SharePoint.
 * Extracted from useMeetingData.ts to enable direct testing and reduce hook complexity.
 */

import { readOptionalEnv } from '@/lib/env';
import { meetingLogger } from '../logging/meetingLogger';
import type {
    MeetingKind,
    MeetingSession,
    SpMeetingSessionItem,
} from '../meetingDataTypes';
import {
    fromSpMeetingSessionFields,
    MEETING_LIST_NAMES,
    MEETING_SELECT_FIELDS,
    toSpMeetingSessionFields,
} from '../meetingDataTypes';

// Environment-driven list configuration
const SESSIONS_LIST =
  readOptionalEnv('VITE_SP_LIST_MEETING_SESSIONS') || MEETING_LIST_NAMES.SESSIONS;

// ──────────────────────────────────────────────────────────────
// Dependency Types
// ──────────────────────────────────────────────────────────────

export interface MeetingApiDeps {
  spFetch: (path: string, init?: RequestInit) => Promise<Response>;
  getListItemsByTitle: <T>(
    listTitle: string,
    selectFields: string[],
    filter?: string,
    orderBy?: string,
  ) => Promise<T[]>;
  addListItemByTitle: (
    listTitle: string,
    fields: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

export function createMeetingSessionApi(deps: MeetingApiDeps) {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = deps;

  /** Create a new meeting session */
  const create = async (
    sessionData: Omit<MeetingSession, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeetingSession> => {
    const now = new Date().toISOString();
    const sessionWithTimestamps: MeetingSession = {
      ...sessionData,
      createdAt: now,
      updatedAt: now,
    };

    const spFields = toSpMeetingSessionFields(sessionWithTimestamps);
    const result = (await addListItemByTitle(SESSIONS_LIST, spFields)) as {
      Id: number;
      Created: string;
      Modified: string;
    };

    const createdSession: MeetingSession = {
      ...sessionWithTimestamps,
      id: result.Id,
      createdAt: result.Created || now,
      updatedAt: result.Modified || now,
    };

    meetingLogger.sessionUpserted({
      sessionKey: createdSession.sessionKey,
      kind: createdSession.meetingKind,
      stepCount: 0,
      completedCount: 0,
      isNew: true,
    });

    meetingLogger.sharePointSyncSucceeded({
      sessionKey: createdSession.sessionKey,
      operation: 'create',
    });

    return createdSession;
  };

  /** Update an existing meeting session */
  const update = async (
    sessionId: number,
    updates: Partial<MeetingSession>,
  ): Promise<MeetingSession> => {
    const now = new Date().toISOString();
    const updatesWithTimestamp = { ...updates, updatedAt: now };

    const currentSessions =
      await getListItemsByTitle<SpMeetingSessionItem>(
        SESSIONS_LIST,
        [MEETING_SELECT_FIELDS.SESSIONS],
        `Id eq ${sessionId}`,
      );

    if (currentSessions.length === 0) {
      throw new Error(`Meeting session ${sessionId} not found`);
    }

    const currentSession = fromSpMeetingSessionFields(currentSessions[0]);
    const mergedSession = { ...currentSession, ...updatesWithTimestamp };

    const spFields = toSpMeetingSessionFields(mergedSession);

    const updateResult = await spFetch(
      `/lists/getbytitle('${SESSIONS_LIST}')/items(${sessionId})`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'IF-MATCH': '*',
          'X-HTTP-Method': 'MERGE',
        },
        body: JSON.stringify(spFields),
      },
    );

    if (!updateResult.ok) {
      throw new Error('Failed to update meeting session');
    }

    return mergedSession;
  };

  /** Get a session by ID */
  const getById = async (sessionId: number): Promise<MeetingSession | null> => {
    const sessions = await getListItemsByTitle<SpMeetingSessionItem>(
      SESSIONS_LIST,
      [MEETING_SELECT_FIELDS.SESSIONS],
      `Id eq ${sessionId}`,
    );
    return sessions.length === 0 ? null : fromSpMeetingSessionFields(sessions[0]);
  };

  /** Get a session by its unique key */
  const getByKey = async (sessionKey: string): Promise<MeetingSession | null> => {
    const sessions = await getListItemsByTitle<SpMeetingSessionItem>(
      SESSIONS_LIST,
      [MEETING_SELECT_FIELDS.SESSIONS],
      `SessionKey eq '${sessionKey}'`,
    );
    return sessions.length === 0 ? null : fromSpMeetingSessionFields(sessions[0]);
  };

  /** List sessions with optional date range and kind filters */
  const list = async (
    dateFrom?: string,
    dateTo?: string,
    kind?: MeetingKind,
  ): Promise<MeetingSession[]> => {
    const filterParts: string[] = [];
    if (dateFrom) filterParts.push(`Date ge '${dateFrom}'`);
    if (dateTo) filterParts.push(`Date le '${dateTo}'`);
    if (kind) filterParts.push(`MeetingKind eq '${kind}'`);
    const filterString = filterParts.join(' and ');

    const sessions = await getListItemsByTitle<SpMeetingSessionItem>(
      SESSIONS_LIST,
      [MEETING_SELECT_FIELDS.SESSIONS],
      filterString || undefined,
      'Date desc',
    );

    return sessions.map(fromSpMeetingSessionFields);
  };

  /** Get sessions by date (YYYY-MM-DD format) */
  const getByDate = async (date: string): Promise<MeetingSession[]> => {
    const filter = `startswith(SessionKey,'${date}_')`;
    const sessions = await getListItemsByTitle<SpMeetingSessionItem>(
      SESSIONS_LIST,
      [MEETING_SELECT_FIELDS.SESSIONS],
      filter,
    );
    return sessions.map(fromSpMeetingSessionFields);
  };

  return { create, update, getById, getByKey, list, getByDate };
}

export type MeetingSessionApi = ReturnType<typeof createMeetingSessionApi>;
