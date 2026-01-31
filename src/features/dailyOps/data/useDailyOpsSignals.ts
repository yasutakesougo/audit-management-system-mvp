import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/useAuth';
import { shouldSkipSharePoint } from '@/lib/env';
import type { DailyOpsStatus, UpsertDailyOpsSignalInput, DailyOpsSignalsPort } from './port';
import { makeSharePointDailyOpsSignalsPort } from './sharePointAdapter';

const QK = {
  byDate: (date: string, status?: DailyOpsStatus) => ['dailyOpsSignals', date, status ?? 'ALL'] as const,
};

// Demo/E2E mode: return empty in-memory port that never hits external APIs
const makeDemoPort = (): DailyOpsSignalsPort => ({
  listByDate: async () => [],
  upsert: async () => ({ id: 1, title: 'Demo', date: '', targetType: 'User', targetId: '', kind: 'Other', time: '', summary: '', status: 'Active', source: 'Other', createdAt: '', updatedAt: '' }),
  setStatus: async () => {},
});

export const useDailyOpsSignals = (date: string, opts?: { status?: DailyOpsStatus }) => {
  const { acquireToken } = useAuth();
  const skipSharePoint = shouldSkipSharePoint();
  
  const port = useMemo(
    () => (skipSharePoint ? makeDemoPort() : makeSharePointDailyOpsSignalsPort(acquireToken)),
    [skipSharePoint, acquireToken]
  );
  
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK.byDate(date, opts?.status),
    queryFn: () => port.listByDate(date, { status: opts?.status }),
    staleTime: 5_000,
  });

  const upsert = useMutation({
    mutationFn: (input: UpsertDailyOpsSignalInput) => port.upsert(input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK.byDate(date, opts?.status) });
    },
  });

  const setStatus = useMutation({
    mutationFn: (args: { itemId: number; status: DailyOpsStatus }) => port.setStatus(args.itemId, args.status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK.byDate(date, opts?.status) });
    },
  });

  return {
    ...query,
    upsert,
    setStatus,
  };
};
