import NurseToastBridge from '@/features/nurse/components/NurseToastBridge';
import { useSnackbarHost } from '@/features/nurse/components/SnackbarHost';
import VitalCard from '@/features/nurse/components/VitalCard';
import { buildIdempotencyKey, queue, type NurseQueueItem } from '@/features/nurse/state/offlineQueue';
import { flushNurseQueue } from '@/features/nurse/state/useNurseSync';
import { TESTIDS } from '@/testids';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Outlet, useSearchParams, type RouteObject } from 'react-router-dom';

const pulseRange = { min: 40, max: 180 } as const;
const sysRange = { min: 70, max: 220 } as const;
const diaRange = { min: 40, max: 150 } as const;

type LastSavedState = {
  pulse: number;
  sys: number;
  dia: number;
  at: string;
} | null;

const formatLastSaved = (state: LastSavedState): string => {
  if (!state) return '保存履歴はまだありません。';
  const timestamp = new Date(state.at);
  const timeLabel = Number.isNaN(timestamp.getTime())
    ? state.at
    : timestamp.toLocaleTimeString('ja-JP', { hour12: false, hour: '2-digit', minute: '2-digit' });
  return `脈拍 ${state.pulse} / 収縮期 ${state.sys} / 拡張期 ${state.dia} （${timeLabel} 保存）`;
};

const useAltSyncHotkey = (handler: () => void) => {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase?.() ?? '';
      if (event.altKey && (event.code === 'KeyS' || key === 's')) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handler]);
};

const NurseObservationPage: React.FC = () => {
  const [search] = useSearchParams();
  const userId = search.get('user') ?? 'I000';
  const [pulse, setPulse] = useState<number>(Number.NaN);
  const [sys, setSys] = useState<number>(Number.NaN);
  const [dia, setDia] = useState<number>(Number.NaN);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queueItems, setQueueItems] = useState<NurseQueueItem[]>(() => queue.all());
  const [lastSaved, setLastSaved] = useState<LastSavedState>(null);
  const snackbar = useSnackbarHost();

  const isPulseInvalid = Number.isFinite(pulse) && (pulse < pulseRange.min || pulse > pulseRange.max);
  const isSysInvalid = Number.isFinite(sys) && (sys < sysRange.min || sys > sysRange.max);
  const isDiaInvalid = Number.isFinite(dia) && (dia < diaRange.min || dia > diaRange.max);

  const canSave =
    Number.isFinite(pulse) &&
    Number.isFinite(sys) &&
    Number.isFinite(dia) &&
    !isPulseInvalid &&
    !isSysInvalid &&
    !isDiaInvalid;

  const refreshQueue = useCallback(() => {
    setQueueItems(queue.all());
  }, []);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const timestampUtc = new Date().toISOString();
      const item: NurseQueueItem = {
        idempotencyKey: buildIdempotencyKey({ userId, type: 'observation', timestampUtc }),
        type: 'observation',
        userId,
        memo: '',
        tags: ['bp-panel'],
        timestampUtc,
        source: 'bp.panel',
        vitals: {
          pulse: Number.isFinite(pulse) ? pulse : undefined,
          sys: Number.isFinite(sys) ? sys : undefined,
          dia: Number.isFinite(dia) ? dia : undefined,
        },
      };
      queue.add(item);
  setLastSaved({ pulse, sys, dia, at: timestampUtc });
      refreshQueue();
      setPulse(Number.NaN);
      setSys(Number.NaN);
      setDia(Number.NaN);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await flushNurseQueue(undefined, { source: 'manual' });
    } finally {
      refreshQueue();
      setSyncing(false);
    }
  }, [refreshQueue, syncing]);

  useAltSyncHotkey(handleSync);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack spacing={0.5}>
        <Typography variant="h4" component="h1" data-testid={TESTIDS.NURSE_OBS_HEADING} sx={{ fontWeight: 700 }}>
          血圧・脈拍記録
        </Typography>
        <Typography variant="body2" color="text.secondary">
          利用者: {userId}
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ p: 3, display: 'grid', gap: 2.5 }} data-testid={TESTIDS.NURSE_BP_PANEL}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            血圧・脈拍の記録
          </Typography>
          <Typography variant="body2" color="text.secondary">
            カードをタップして測定値を入力してください。
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.25, md: 1.5 },
            gridTemplateColumns: {
              xs: 'repeat(auto-fit, minmax(220px, 1fr))',
              md: 'repeat(auto-fit, minmax(240px, 1fr))',
            },
            alignItems: 'stretch',
          }}
        >
          <VitalCard
            label="脈拍"
            unit="bpm"
            value={pulse}
            onChange={setPulse}
            isDanger={isPulseInvalid}
            inputTestId={TESTIDS.NURSE_BP_INPUT_PULSE}
          />
          <VitalCard
            label="血圧(上)"
            unit="mmHg"
            value={sys}
            onChange={setSys}
            isDanger={isSysInvalid}
            inputTestId={TESTIDS.NURSE_BP_INPUT_SYS}
          />
          <VitalCard
            label="血圧(下)"
            unit="mmHg"
            value={dia}
            onChange={setDia}
            isDanger={isDiaInvalid}
            inputTestId={TESTIDS.NURSE_BP_INPUT_DIA}
          />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!canSave || saving}
            data-testid={TESTIDS.NURSE_OBS_SAVE}
          >
            保存
          </Button>
          <Button variant="outlined" onClick={handleSync} disabled={syncing} data-testid={TESTIDS.NURSE_SYNC_BUTTON}>
            同期
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          最終保存
        </Typography>
        <Typography data-testid={TESTIDS.NURSE_BP_LAST_SAVED}>{formatLastSaved(lastSaved)}</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          未送信キュー
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {queueItems.length === 0 ? '現在未送信の記録はありません。' : `未送信 ${queueItems.length} 件`}
        </Typography>
        <Divider sx={{ my: 1.5 }} />
        <Stack spacing={1} data-testid={TESTIDS.NURSE_BP_QUEUE}>
          {queueItems.length === 0 ? (
            <Typography variant="body2">キューは空です。</Typography>
          ) : (
            queueItems.map((item) => (
              <Typography key={item.idempotencyKey} variant="body2">
                {`${item.userId} / ${item.vitals?.sys ?? '-'}-${item.vitals?.dia ?? '-'} (${item.vitals?.pulse ?? '-'})`}
              </Typography>
            ))
          )}
        </Stack>
      </Paper>

      {snackbar.ui}
      <NurseToastBridge onToast={snackbar.open} />
    </Box>
  );
};

const NurseLayout: React.FC = () => (
  <Box sx={{ p: 3 }}>
    <Outlet />
  </Box>
);

export const nurseRoutes = (): RouteObject => ({
  path: '/nurse',
  element: <NurseLayout />,
  children: [
    { index: true, element: <Navigate to="observation" replace /> },
    { path: 'observation', element: <NurseObservationPage /> },
  ],
});

export default nurseRoutes;
