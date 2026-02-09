import { ProcedureEditor } from '@/features/daily/components/procedure/ProcedureEditor';
import { ProcedurePanel, type ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel } from '@/features/daily/components/split-stream/RecordPanel';
import { SplitStreamLayout } from '@/features/daily/components/split-stream/SplitStreamLayout';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import { useInMemoryBehaviorRepository, useInMemoryProcedureRepository } from '@/features/daily/repositories/inMemory';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { FullScreenDailyDialogPage } from '@/features/daily/components/FullScreenDailyDialogPage';
import { useTimeBasedSupportRecordPage } from '@/pages/hooks/useTimeBasedSupportRecordPage';
import { useLocation, useSearchParams } from 'react-router-dom';

const TimeBasedSupportRecordPage: React.FC = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserId = searchParams.get('user') ?? undefined;
  const initialStepKey = searchParams.get('step') ?? undefined;
  const initialUnfilledOnly = searchParams.get('unfilled') === '1';
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const recordDate = useMemo(() => new Date(), []);
  const recordPanelRef = useRef<HTMLDivElement>(null);
  const procedureRepo = useInMemoryProcedureRepository();
  const { repo: behaviorRepo, data: behaviorRecords } = useInMemoryBehaviorRepository();
  const { data: users } = useUsersDemo();
  const {
    targetUserId,
    handleUserChange,
    schedule,
    filledStepIds,
    recentObservations,
    isAcknowledged,
    setIsAcknowledged,
    selectedStepId,
    setSelectedStepId,
    scrollToStepId,
    showUnfilledOnly,
    setShowUnfilledOnly,
    recordLockState,
    totalSteps,
    unfilledStepsCount,
    handleSelectStep,
    handleAfterSubmit,
  } = useTimeBasedSupportRecordPage({
    procedureRepo,
    behaviorRepo,
    behaviorRecords,
    initialUserId,
    initialStepKey,
    initialUnfilledOnly,
  });
  const selectedUser = useMemo(() => users.find((user) => user.UserID === targetUserId), [users, targetUserId]);
  const previousSearchRef = useRef(location.search);

  useEffect(() => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (targetUserId) {
        nextParams.set('user', targetUserId);
      } else {
        nextParams.delete('user');
      }
      if (selectedStepId) {
        nextParams.set('step', selectedStepId);
      } else {
        nextParams.delete('step');
      }
      if (showUnfilledOnly) {
        nextParams.set('unfilled', '1');
      } else {
        nextParams.delete('unfilled');
      }
      if (nextParams.toString() === prev.toString()) {
        return prev;
      }
      return nextParams;
    }, { replace: true });
  }, [selectedStepId, setSearchParams, showUnfilledOnly, targetUserId]);

  useEffect(() => {
    const prevSearch = previousSearchRef.current;
    const nextSearch = location.search;
    if (prevSearch === nextSearch) return;
    if (location.pathname !== '/daily/support') {
      previousSearchRef.current = nextSearch;
      return;
    }

    const prevParams = new URLSearchParams(prevSearch);
    const nextParams = new URLSearchParams(nextSearch);
    const allKeys = new Set<string>([...prevParams.keys(), ...nextParams.keys()]);
    const allowedKeys = new Set(['step', 'user']);
    const onlyAllowedChanged = [...allKeys].every((key) => {
      if (!allowedKeys.has(key)) {
        return prevParams.get(key) === nextParams.get(key);
      }
      return true;
    });

    if (onlyAllowedChanged && typeof window !== 'undefined') {
      const scope = window as typeof window & { __suppressRouteReset__?: boolean };
      scope.__suppressRouteReset__ = true;
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => {
          scope.__suppressRouteReset__ = false;
        });
      } else {
        window.setTimeout(() => {
          scope.__suppressRouteReset__ = false;
        }, 0);
      }
    }

    previousSearchRef.current = nextSearch;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!schedule.length) return;
    const seen = new Set<string>();
    const dups: string[] = [];
    schedule.forEach((item) => {
      const key = getScheduleKey(item.time, item.activity);
      if (seen.has(key)) {
        dups.push(key);
      } else {
        seen.add(key);
      }
    });
    if (dups.length) {
      console.warn('[daily/support] Duplicate scheduleKey detected:', dups, 'Check timeSlot + plannedActivity normalization.');
    }
  }, [schedule]);

  const handleRecordSubmit = useCallback(async (payload: Omit<BehaviorObservation, 'id' | 'userId'>) => {
    if (!targetUserId) return;
    await behaviorRepo.add({
      ...payload,
      userId: targetUserId,
    });
    setSnackbarOpen(true);
  }, [behaviorRepo, targetUserId]);

  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  type StepLike = string | ScheduleItem | { scheduleKey?: string; time?: string; activity?: string };
  const normalizeStepKey = (value: StepLike, fallback?: string) => {
    if (typeof value === 'string') return value;
    if ('scheduleKey' in value && value.scheduleKey) return value.scheduleKey;
    if ('time' in value && 'activity' in value && value.time && value.activity) {
      return getScheduleKey(value.time, value.activity);
    }
    return fallback ?? '';
  };

  const handleSelectStepAndScroll = useCallback((step: StepLike, stepId?: string) => {
    const resolvedStepId = normalizeStepKey(step, stepId);
    if (!resolvedStepId) return;
    flushSync(() => {
      handleSelectStep(resolvedStepId);
      setIsAcknowledged(true);
    });
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      const node = recordPanelRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (inView) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [handleSelectStep, setIsAcknowledged]);

  const handleProcedureSave = useCallback((items: ProcedureItem[]) => {
    if (!targetUserId) return;
    procedureRepo.save(targetUserId, items);
  }, [procedureRepo, targetUserId]);

  const handleEditorOpen = useCallback(() => {
    setIsEditOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setIsEditOpen(false);
  }, []);

  return (
    <FullScreenDailyDialogPage
      title="支援（サポート記録）"
      backTo="/dashboard"
      testId="daily-support-page"
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.100' }}
        data-testid="iceberg-time-based-support-record-page"
      >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          borderRadius: 0
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <AccessTimeIcon color="primary" />
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Typography variant="h6" fontWeight="bold">
              支援手順・行動記録（タイムライン）
            </Typography>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="iceberg-user-select-label">支援対象者</InputLabel>
              <Select
                labelId="iceberg-user-select-label"
                value={targetUserId}
                label="支援対象者"
                onChange={(event) => handleUserChange(event.target.value)}
                startAdornment={<PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
              >
                <MenuItem value="">
                  <em>選択してください</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.UserID} value={user.UserID}>
                    {user.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <SplitStreamLayout
          recordRef={recordPanelRef}
          plan={targetUserId ? (
            <ProcedurePanel
              title={selectedUser ? `${selectedUser.FullName} 様 (Plan)` : '支援手順 (Plan)'}
              schedule={schedule}
              isAcknowledged={isAcknowledged}
              onAcknowledged={() => setIsAcknowledged(true)}
              onEdit={handleEditorOpen}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStepAndScroll}
              filledStepIds={filledStepIds}
              scrollToStepId={scrollToStepId}
              showUnfilledOnly={showUnfilledOnly}
              onToggleUnfilledOnly={() => setShowUnfilledOnly((prev) => !prev)}
              unfilledCount={unfilledStepsCount}
              totalCount={totalSteps}
            />
          ) : (
            <ProcedurePanel title="支援手順 (Plan)">
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 320, textAlign: 'center' }}>
                <Typography variant="body1" fontWeight="bold">
                  支援対象者を選択して時間割を表示
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  左列には ProcedureStore から読み込んだ時間ごとのスケジュールが表示されます。
                  対象者を選ぶとスクロールで Plan を確認できます。
                </Typography>
              </Stack>
            </ProcedurePanel>
          )}
          record={
            <RecordPanel
              title="行動記録 (Do)"
              lockState={recordLockState}
              onSubmit={handleRecordSubmit}
              schedule={schedule}
              selectedSlotKey={selectedStepId ?? ''}
              onSlotChange={(next) => setSelectedStepId(next || null)}
              onAfterSubmit={handleAfterSubmit}
              recordDate={recordDate}
            />
          }
        />
      </Box>

      {targetUserId && (
        <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'common.white' }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              直近の行動記録
            </Typography>
            <Chip label={`${recentObservations.length}件`} size="small" />
            {selectedUser && (
              <Typography variant="body2" color="text.secondary">
                {selectedUser.FullName}
              </Typography>
            )}
          </Box>
          {recentObservations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              記録はまだありません。Planを確認してから記録を開始してください。
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {recentObservations.slice(0, 5).map((observation) => (
                <Box key={observation.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                    {new Date(observation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Chip
                    label={`${observation.behavior} / Lv.${observation.intensity}`}
                    color={observation.intensity >= 4 ? 'error' : observation.intensity >= 3 ? 'warning' : 'success'}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    A: {observation.antecedent ?? '―'} / C: {observation.consequence ?? '―'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <ProcedureEditor
        open={isEditOpen}
        initialItems={schedule}
        onClose={handleEditorClose}
        onSave={handleProcedureSave}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          行動記録を保存しました
        </Alert>
      </Snackbar>
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default TimeBasedSupportRecordPage;
