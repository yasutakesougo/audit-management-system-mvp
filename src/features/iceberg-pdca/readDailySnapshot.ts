import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/infra/firestore/client';

export type DailySnapshotMetrics = {
  completionRate: number;
  leadTimeMinutes: number;
  targetDate?: string;
  targetUserId?: string;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value;
};

export const parseDailySnapshotMetrics = (value: unknown): DailySnapshotMetrics | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const completionRate = toNumber(record.completionRate);
  const leadTimeMinutes = toNumber(record.leadTimeMinutes);

  if (completionRate === null || leadTimeMinutes === null) {
    return null;
  }

  return {
    completionRate,
    leadTimeMinutes,
    targetDate: typeof record.targetDate === 'string' ? record.targetDate : undefined,
    targetUserId: typeof record.targetUserId === 'string' ? record.targetUserId : undefined,
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
}): Promise<DailySnapshotMetrics | null> => {
  const snapshotId = makeDailySnapshotId(params);
  const ref = doc(db, 'orgs', params.orgId, 'dailySnapshots', snapshotId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return null;
  }

  return parseDailySnapshotMetrics(snap.data());
};
