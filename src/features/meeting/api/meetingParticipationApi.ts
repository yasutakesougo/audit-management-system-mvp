/**
 * Meeting Participation API Layer
 *
 * Pure functions for Participation CRUD operations against SharePoint.
 * Extracted from useMeetingData.ts to enable direct testing and reduce hook complexity.
 */

import { readOptionalEnv } from '@/lib/env';
import { meetingLogger } from '../logging/meetingLogger';
import type {
    MeetingParticipation,
    SpMeetingParticipationItem,
} from '../meetingDataTypes';
import {
    fromSpMeetingParticipationFields,
    MEETING_LIST_NAMES,
    MEETING_PARTICIPATION_FILTER_FIELDS,
    MEETING_SELECT_FIELDS,
    toSpMeetingParticipationFields,
} from '../meetingDataTypes';
import type { MeetingApiDeps } from './meetingSessionApi';

// Environment-driven list configuration
const PARTICIPATION_LIST =
  readOptionalEnv('VITE_SP_LIST_MEETING_PARTICIPATION') ||
  MEETING_LIST_NAMES.PARTICIPATION;

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

export function createMeetingParticipationApi(deps: MeetingApiDeps) {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = deps;

  /** Add a new participant to a meeting session */
  const add = async (
    participationData: Omit<MeetingParticipation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<MeetingParticipation> => {
    const now = new Date().toISOString();
    const participationWithTimestamps: MeetingParticipation = {
      ...participationData,
      createdAt: now,
      updatedAt: now,
    };

    const spFields = toSpMeetingParticipationFields(participationWithTimestamps);
    const result = (await addListItemByTitle(PARTICIPATION_LIST, spFields)) as {
      Id: number;
      Created: string;
      Modified: string;
    };

    const created: MeetingParticipation = {
      ...participationWithTimestamps,
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

  /** Update an existing participation record */
  const update = async (
    participationId: number,
    updates: Partial<MeetingParticipation>,
  ): Promise<MeetingParticipation> => {
    const now = new Date().toISOString();

    const existing = await getListItemsByTitle<SpMeetingParticipationItem>(
      PARTICIPATION_LIST,
      [MEETING_SELECT_FIELDS.PARTICIPATION],
      `${MEETING_PARTICIPATION_FILTER_FIELDS.id} eq ${participationId}`,
    );

    if (existing.length === 0) {
      throw new Error(`Participation record ${participationId} not found`);
    }

    const current = fromSpMeetingParticipationFields(existing[0]);
    const merged: MeetingParticipation = { ...current, ...updates, updatedAt: now };
    const spFields = toSpMeetingParticipationFields(merged);

    const res = await spFetch(
      `/lists/getbytitle('${PARTICIPATION_LIST}')/items(${participationId})`,
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
      throw new Error('Failed to update participation record');
    }

    return merged;
  };

  /** Get all participants for a session */
  const getBySession = async (sessionId: number): Promise<MeetingParticipation[]> => {
    const items = await getListItemsByTitle<SpMeetingParticipationItem>(
      PARTICIPATION_LIST,
      [MEETING_SELECT_FIELDS.PARTICIPATION],
      `${MEETING_PARTICIPATION_FILTER_FIELDS.sessionId} eq ${sessionId}`,
      'ParticipantName',
    );
    return items.map(fromSpMeetingParticipationFields);
  };

  return { add, update, getBySession };
}

export type MeetingParticipationApi = ReturnType<typeof createMeetingParticipationApi>;
