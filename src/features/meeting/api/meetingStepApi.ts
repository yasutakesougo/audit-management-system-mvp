/**
 * Meeting Step API Layer
 *
 * Pure functions for Step CRUD operations against SharePoint.
 * Extracted from useMeetingData.ts to enable direct testing and reduce hook complexity.
 */

import { readOptionalEnv } from '@/lib/env';
import type {
    MeetingStepId,
    MeetingStepRecord,
    SpMeetingSessionItem,
    SpMeetingStepItem,
} from '../meetingDataTypes';
import {
    fromSpMeetingSessionFields,
    fromSpMeetingStepFields,
    MEETING_LIST_NAMES,
    MEETING_SELECT_FIELDS,
    MEETING_SESSION_FILTER_FIELDS,
    MEETING_STEP_FILTER_FIELDS,
    toSpMeetingStepFields,
} from '../meetingDataTypes';
import type { MeetingApiDeps } from './meetingSessionApi';

// Environment-driven list configuration
const SESSIONS_LIST =
  readOptionalEnv('VITE_SP_LIST_MEETING_SESSIONS') || MEETING_LIST_NAMES.SESSIONS;
const STEPS_LIST =
  readOptionalEnv('VITE_SP_LIST_MEETING_STEPS') || MEETING_LIST_NAMES.STEPS;

// ──────────────────────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────────────────────

export function createMeetingStepApi(deps: MeetingApiDeps) {
  const { spFetch, getListItemsByTitle, addListItemByTitle } = deps;

  /** Update or create a step record */
  const upsert = async (
    sessionId: number,
    stepId: number,
    updates: Partial<MeetingStepRecord>,
  ): Promise<MeetingStepRecord> => {
    const now = new Date().toISOString();
    const updatesWithTimestamp = { ...updates, updatedAt: now };

    const existingSteps = await getListItemsByTitle<SpMeetingStepItem>(
      STEPS_LIST,
      [MEETING_SELECT_FIELDS.STEPS],
      `${MEETING_STEP_FILTER_FIELDS.sessionId} eq ${sessionId} and ${MEETING_STEP_FILTER_FIELDS.stepId} eq ${stepId}`,
    );

    let stepRecord: MeetingStepRecord;

    if (existingSteps.length > 0) {
      // Update existing step
      const currentStep = fromSpMeetingStepFields(existingSteps[0]);
      stepRecord = { ...currentStep, ...updatesWithTimestamp };

      const spFields = toSpMeetingStepFields(stepRecord);
      await spFetch(
        `/lists/getbytitle('${STEPS_LIST}')/items(${existingSteps[0].Id})`,
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
    } else {
      // Create new step record – need session info for sessionKey
      const sessionItems = await getListItemsByTitle<SpMeetingSessionItem>(
        SESSIONS_LIST,
        [MEETING_SELECT_FIELDS.SESSIONS],
        `${MEETING_SESSION_FILTER_FIELDS.id} eq ${sessionId}`,
      );
      if (sessionItems.length === 0) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const session = fromSpMeetingSessionFields(sessionItems[0]);
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
      const result = (await addListItemByTitle(STEPS_LIST, spFields)) as { Id: number };
      stepRecord.id = result.Id;
    }

    return stepRecord;
  };

  /** Get all step records for a session */
  const getBySession = async (sessionId: number): Promise<MeetingStepRecord[]> => {
    const steps = await getListItemsByTitle<SpMeetingStepItem>(
      STEPS_LIST,
      [MEETING_SELECT_FIELDS.STEPS],
      `${MEETING_STEP_FILTER_FIELDS.sessionId} eq ${sessionId}`,
      'StepId',
    );
    return steps.map(fromSpMeetingStepFields);
  };

  /** Add a new meeting step record via direct spFetch */
  const add = async (
    sessionId: number,
    stepData: {
      stepId: number;
      stepTitle?: string;
      completed: boolean;
      completedAt?: string;
      completedByUserId?: string;
      timeSpent: number;
      stepNotes: string;
    },
  ): Promise<MeetingStepRecord> => {
    const now = new Date().toISOString();

    const [sessionItem] = await getListItemsByTitle<SpMeetingSessionItem>(
      SESSIONS_LIST,
      [MEETING_SELECT_FIELDS.SESSIONS],
      `${MEETING_SESSION_FILTER_FIELDS.id} eq ${sessionId}`,
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

    const createResult = await spFetch(
      `/lists/getbytitle('${STEPS_LIST}')/items`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spFields),
      },
    );

    if (!createResult.ok) {
      throw new Error('Failed to create meeting step record');
    }

    const createdItem = await createResult.json();

    const normalizedItem: SpMeetingStepItem = {
      ...spFields,
      Id: createdItem.Id,
      Created: createdItem.Created ?? now,
      Modified: createdItem.Modified ?? now,
      '@odata.etag': createdItem['@odata.etag'],
    };

    return fromSpMeetingStepFields(normalizedItem);
  };

  return { upsert, getBySession, add };
}

export type MeetingStepApi = ReturnType<typeof createMeetingStepApi>;
