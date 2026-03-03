import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

import { db } from '@/infra/firestore/client';

export type DailyPdcaEventType = 'DAILY_SUPPORT_SUBMITTED' | 'PDCA_CHECK_VIEWED';

export type DailySubmissionMetrics = {
  completionRate?: number;
  leadTimeMinutes?: number;
  unfilledCount?: number;
};

export type PersistDailyPdcaInput = {
  orgId: string;
  templateId: string;
  targetDate: string;
  targetUserId: string;
  actorUserId: string;
  actorName?: string;
  type: DailyPdcaEventType;
  clientVersion: string;
  metrics?: DailySubmissionMetrics;
  submittedAt?: Date;
  sourceRoute?: string;
  ref?: string;
};

export function makeIdempotencyKey(input: Pick<
  PersistDailyPdcaInput,
  'type' | 'templateId' | 'targetDate' | 'targetUserId'
>) {
  return `${input.type}:${input.templateId}:${input.targetDate}:${input.targetUserId}`;
}

export function makeDailySnapshotId(input: Pick<
  PersistDailyPdcaInput,
  'templateId' | 'targetDate' | 'targetUserId'
>) {
  return `${input.templateId}__${input.targetDate}__${input.targetUserId}`;
}

export async function createDailyEventCreateOnly(input: PersistDailyPdcaInput) {
  const idempotencyKey = makeIdempotencyKey(input);
  const ref = doc(db, 'orgs', input.orgId, 'events', idempotencyKey);

  const payload = {
    orgId: input.orgId,
    templateId: input.templateId,
    targetDate: input.targetDate,
    targetUserId: input.targetUserId,
    actorUserId: input.actorUserId,
    actorName: input.actorName ?? null,
    client: { app: 'web' as const, version: input.clientVersion },
    type: input.type,
    idempotencyKey,
    occurredAt: serverTimestamp(),
    metrics: input.metrics ?? null,
    trace: {
      sourceRoute: input.sourceRoute ?? null,
      ref: input.ref ?? null,
    },
  } as const;

  await setDoc(ref, payload, { merge: false });
  return { idempotencyKey };
}

export async function upsertDailySnapshot(input: PersistDailyPdcaInput) {
  const snapId = makeDailySnapshotId(input);
  const ref = doc(db, 'orgs', input.orgId, 'dailySnapshots', snapId);

  const submittedAtTs = input.submittedAt ? Timestamp.fromDate(input.submittedAt) : null;

  const payload = {
    orgId: input.orgId,
    templateId: input.templateId,
    targetDate: input.targetDate,
    targetUserId: input.targetUserId,
    createdAt: serverTimestamp(),
    completionRate: input.metrics?.completionRate ?? 0,
    leadTimeMinutes: input.metrics?.leadTimeMinutes ?? 0,
    submittedAt: submittedAtTs,
    computedFrom: {
      lastEventAt: serverTimestamp(),
      eventCount: 1,
      version: 1,
    },
    updatedAt: serverTimestamp(),
  } as const;

  await setDoc(ref, payload, { merge: true });
}

export async function persistDailySubmission(input: PersistDailyPdcaInput) {
  await createDailyEventCreateOnly(input);
  await upsertDailySnapshot(input);
}
