import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataProvider } from '@/lib/data/useDataProvider';
import type { DailyOpsStatus, UpsertDailyOpsSignalInput } from './port';
import { createDailyOpsSignalsPort } from './dailyOpsSignalsFactory';

const QK = {
  byDate: (date: string, status?: DailyOpsStatus) => ['dailyOpsSignals', date, status ?? 'ALL'] as const,
};

export const useDailyOpsSignals = (date: string, opts?: { status?: DailyOpsStatus }) => {
  const { provider } = useDataProvider();

  const port = useMemo(
    () => createDailyOpsSignalsPort(provider),
    [provider]
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
