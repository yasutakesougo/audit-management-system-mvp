/**
 * Meeting Priority Record API Layer
 *
 * Pure functions for Priority Record CRUD operations against SharePoint.
 * Extracted from useMeetingData.ts to enable direct testing and reduce hook complexity.
 */

import { readOptionalEnv } from '@/lib/env';
import { meetingLogger } from '../logging/meetingLogger';
import type {
    MeetingPriorityRecord,
    SpMeetingPriorityItem,
} from '../meetingDataTypes';
import {
    fromSpMeetingPriorityFields,
    MEETING_LIST_NAMES,
    MEETING_PRIORITY_FILTER_FIELDS,
    MEETING_SELECT_FIELDS,
    toSpMeetingPriorityFields,
} from '../meetingDataTypes';
import type { MeetingApiDeps } from './meetingSessionApi';

// Environment-driven list configuration
const PRIORITY_LIST =
  readOptionalEnv('VITE_SP_LIST_MEETING_PRIORITY') ||
  MEETING_LIST_NAMES.PRIORITY_RECORDS;

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

export function createMeetingPriorityApi(deps: MeetingApiDeps) {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = deps;

  /** Add a new priority record */
  const add = async (
    priorityData: Omit<MeetingPriorityRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeetingPriorityRecord> => {
    const now = new Date().toISOString();
    const recordWithTimestamps: MeetingPriorityRecord = {
      ...priorityData,
      createdAt: now,
      updatedAt: now,
    };

    const spFields = toSpMeetingPriorityFields(recordWithTimestamps);
    const result = (await addListItemByTitle(PRIORITY_LIST, spFields)) as {
      Id: number;
      Created: string;
      Modified: string;
    };

    const created: MeetingPriorityRecord = {
      ...recordWithTimestamps,
      id: result.Id,
      createdAt: result.Created || now,
      updatedAt: result.Modified || now,
    };

    meetingLogger.sharePointSyncSucceeded({
      sessionKey: created.sessionKey,
      operation: 'create',
    });

    return created;
  };

  /** Update an existing priority record */
  const update = async (
    priorityId: number,
    updates: Partial<MeetingPriorityRecord>,
  ): Promise<MeetingPriorityRecord> => {
    const now = new Date().toISOString();

    const existing = await getListItemsByTitle<SpMeetingPriorityItem>(
      PRIORITY_LIST,
      [MEETING_SELECT_FIELDS.PRIORITY_RECORDS],
      `${MEETING_PRIORITY_FILTER_FIELDS.id} eq ${priorityId}`,
    );

    if (existing.length === 0) {
      throw new Error(`Priority record ${priorityId} not found`);
    }

    const current = fromSpMeetingPriorityFields(existing[0]);
    const merged: MeetingPriorityRecord = { ...current, ...updates, updatedAt: now };
    const spFields = toSpMeetingPriorityFields(merged);

    const res = await spFetch(
      `/lists/getbytitle('${PRIORITY_LIST}')/items(${priorityId})`,
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

    if (!res.ok) {
      throw new Error('Failed to update priority record');
    }

    return merged;
  };

  /** Get priority records by session ID */
  const getBySession = async (sessionId: number): Promise<MeetingPriorityRecord[]> => {
    const items = await getListItemsByTitle<SpMeetingPriorityItem>(
      PRIORITY_LIST,
      [MEETING_SELECT_FIELDS.PRIORITY_RECORDS],
      `${MEETING_PRIORITY_FILTER_FIELDS.sessionId} eq ${sessionId}`,
      'Priority',
    );
    return items.map(fromSpMeetingPriorityFields);
  };

  return { add, update, getBySession };
}

export type MeetingPriorityApi = ReturnType<typeof createMeetingPriorityApi>;
