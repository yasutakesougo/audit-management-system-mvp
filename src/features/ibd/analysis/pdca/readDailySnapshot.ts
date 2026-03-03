import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/infra/firestore/client';

export type DailySnapshotMetrics = {
  completionRate: number;
  leadTimeMinutes: number;
  targetDate?: string;
  targetUserId?: string;
};

export type DailySnapshotReadResult =
  | { status: 'ok'; metrics: DailySnapshotMetrics }
  | { status: 'not-found' }
  | { status: 'invalid'; reason: string };

type SnapshotTimestamp = {
  toMillis: () => number;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const isSnapshotTimestamp = (value: unknown): value is SnapshotTimestamp => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.toMillis === 'function';
};

export const parseDailySnapshotMetrics = (
  value: unknown,
  expected: {
    templateId: string;
    targetDate: string;
    targetUserId: string;
  },
): DailySnapshotReadResult => {
  if (typeof value !== 'object' || value === null) {
    return { status: 'invalid', reason: 'snapshot payload is not an object' };
  }

  const record = value as Record<string, unknown>;
  const completionRate = toNumber(record.completionRate);
  const leadTimeMinutes = toNumber(record.leadTimeMinutes);

  if (completionRate === null || leadTimeMinutes === null) {
    return { status: 'invalid', reason: 'snapshot metrics are missing or not numeric' };
  }

  if (completionRate < 0 || completionRate > 1) {
    return { status: 'invalid', reason: `completionRate out of range: ${completionRate}` };
  }

  if (leadTimeMinutes < 0) {
    return { status: 'invalid', reason: `leadTimeMinutes must be >= 0: ${leadTimeMinutes}` };
  }

  if (!isSnapshotTimestamp(record.createdAt) || !isSnapshotTimestamp(record.updatedAt)) {
    return { status: 'invalid', reason: 'snapshot missing createdAt/updatedAt timestamp' };
  }

  if (record.templateId !== expected.templateId) {
    return {
      status: 'invalid',
      reason: `templateId mismatch: expected=${expected.templateId} actual=${String(record.templateId)}`,
    };
  }

  if (record.targetDate !== expected.targetDate) {
    return {
      status: 'invalid',
      reason: `targetDate mismatch: expected=${expected.targetDate} actual=${String(record.targetDate)}`,
    };
  }

  if (record.targetUserId !== expected.targetUserId) {
    return {
      status: 'invalid',
      reason: `targetUserId mismatch: expected=${expected.targetUserId} actual=${String(record.targetUserId)}`,
    };
  }

  return {
    status: 'ok',
    metrics: {
      completionRate,
      leadTimeMinutes,
      targetDate: typeof record.targetDate === 'string' ? record.targetDate : undefined,
      targetUserId: typeof record.targetUserId === 'string' ? record.targetUserId : undefined,
    },
  };
};

export const makeDailySnapshotId = (params: {
  templateId: string;
  targetDate: string;
  targetUserId: string;
}): string => `${params.templateId}__${params.targetDate}__${params.targetUserId}`;

export const readDailySnapshot = async (params: {
  orgId: string;
  templateId: string;
  targetDate: string;
  targetUserId: string;
}): Promise<DailySnapshotReadResult> => {
  const snapshotId = makeDailySnapshotId(params);
  const ref = doc(db, 'orgs', params.orgId, 'dailySnapshots', snapshotId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { status: 'not-found' };
  }

  return parseDailySnapshotMetrics(snap.data(), {
    templateId: params.templateId,
    targetDate: params.targetDate,
    targetUserId: params.targetUserId,
  });
};
