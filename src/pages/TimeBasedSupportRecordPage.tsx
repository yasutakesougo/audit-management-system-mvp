import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import { FullScreenDailyDialogPage } from '@/features/daily/components/FullScreenDailyDialogPage';
import { ProcedureEditor } from '@/features/daily/components/procedure/ProcedureEditor';
import { BentoGridSupportLayout } from '@/features/daily/components/split-stream/BentoGridSupportLayout';
import { ProcedurePanel, type ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecentRecordsDialog } from '@/features/daily/components/split-stream/RecentRecordsDialog';
import { RecordPanel } from '@/features/daily/components/split-stream/RecordPanel';
import { SupportPageHeader } from '@/features/daily/components/split-stream/SupportPageHeader';
import SupportSummaryStrip from '@/features/daily/components/split-stream/SupportSummaryStrip';
import { generateDailyReport } from '@/features/daily/domain/generateDailyReport';
import { getScheduleKey } from '@/features/daily/domain/getScheduleKey';
import { toBipOptions } from '@/features/daily/domain/toBipOptions';
import { useBehaviorData } from '@/features/daily/hooks/useBehaviorData';
import { useDailySupportUserFilter } from '@/features/daily/hooks/useDailySupportUserFilter';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureData } from '@/features/daily/hooks/useProcedureData';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';
import { getABCRecordsForUser, getLatestSPS, getSupervisionCounter } from '@/features/ibd/core/ibdStore';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { useSupportRecordSubmit } from '@/pages/hooks/useSupportRecordSubmit';
import { useTimeBasedSupportRecordPage } from '@/pages/hooks/useTimeBasedSupportRecordPage';
import { toLocalDateISO } from '@/utils/getNow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';

const TimeBasedSupportRecordPage: React.FC = () => {
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const initialSearchParams = useRef(new URLSearchParams(location.search)).current;
  const initialDateParam = initialSearchParams.get('date');
  const initialRecordDate =
    initialDateParam && /^\d{4}-\d{2}-\d{2}$/.test(initialDateParam)
      ? new Date(`${initialDateParam}T00:00:00`)
      : new Date();
  const initialParams = useRef({
    userId: initialSearchParams.get('userId') ?? initialSearchParams.get('user') ?? undefined,
    stepKey: initialSearchParams.get('step') ?? undefined,
    unfilledOnly: initialSearchParams.get('unfilled') === '1',
  }).current;
  const initialUserId = initialParams.userId;
  const initialStepKey = initialParams.stepKey;
  const initialUnfilledOnly = initialParams.unfilledOnly;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [recentRecordsOpen, setRecentRecordsOpen] = useState(false);
  const recordDate = useMemo(() => initialRecordDate, [initialRecordDate]);
  const targetDate = useMemo(() => recordDate.toISOString().slice(0, 10), [recordDate]);
  const recordPanelRef = useRef<HTMLDivElement>(null);
  const procedureRepo = useProcedureData();
  const { repo: behaviorRepo, data: behaviorRecords, error: behaviorError, clearError } = useBehaviorData();
  const { data: users } = useUsersDemo();
  const { filter, updateFilter, resetFilter, filteredUsers, hasActiveFilter } = useDailySupportUserFilter(users);
  const interventionStore = useInterventionStore();
  const executionStore = useExecutionData();

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

  // Submit logic (extracted hook)
  const {
    snackbarOpen,
    snackbarMessage,
    submitError,
    retryPersist,
    handleRecordSubmit,
    handleRetryPersist,
    handleSnackbarClose,
    setSubmitError,
  } = useSupportRecordSubmit({
    behaviorRepo,
    executionStore,
    targetUserId,
    targetDate,
    totalSteps,
    unfilledStepsCount,
  });

  // BIP data
  const userInterventionPlans = useMemo(
    () => (targetUserId ? interventionStore.getByUserId(targetUserId) : []),
    [interventionStore, targetUserId],
  );
  const bipOptions = useMemo(
    () => toBipOptions(userInterventionPlans),
    [userInterventionPlans],
  );

  // Error display (filter DailyActivityRecords list errors)
  const rawError = submitError ?? behaviorError;
  const displayedError = useMemo(() => {
    if (!rawError) return null;
    if (String(rawError).includes('DailyActivityRecords')) return null;
    return rawError;
  }, [rawError]);
  const selectedUser = useMemo(() => users.find((user) => user.UserID === targetUserId), [users, targetUserId]);

  // Observation preview map for Plan side tooltips
  const savedObservationsMap = useMemo(() => {
    const map = new Map<string, string>();
    recentObservations.forEach((obs) => {
      const key = obs.planSlotKey ?? '';
      if (key && obs.actualObservation) {
        map.set(key, obs.actualObservation.slice(0, 60) + (obs.actualObservation.length > 60 ? '…' : ''));
      }
    });
    return map;
  }, [recentObservations]);

  const previousSearchRef = useRef(location.search);

  // --- Effects ---
  useEffect(() => {
    if (!initialUserId) return;
    if (targetUserId) return;
    handleUserChange(initialUserId);
  }, [handleUserChange, initialUserId, targetUserId]);

  useEffect(() => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (targetUserId) {
        nextParams.set('user', targetUserId);
        nextParams.set('userId', targetUserId);
      } else {
        nextParams.delete('user');
        nextParams.delete('userId');
      }
      const prevStep = prev.get('step') ?? undefined;
      const resolvedStep = selectedStepId ?? prevStep ?? initialParams.stepKey;
      if (resolvedStep) {
        nextParams.set('step', resolvedStep);
      } else {
        nextParams.delete('step');
      }
      if (showUnfilledOnly) {
        nextParams.set('unfilled', '1');
      } else {
        nextParams.delete('unfilled');
      }
      if (nextParams.toString() === prev.toString()) return prev;
      return nextParams;
    }, { replace: true });
  }, [initialParams.stepKey, selectedStepId, setSearchParams, showUnfilledOnly, targetUserId]);

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
    const allowedKeys = new Set(['step', 'user', 'userId', 'date']);
    const onlyAllowedChanged = [...allKeys].every((key) => {
      if (!allowedKeys.has(key)) return prevParams.get(key) === nextParams.get(key);
      return true;
    });
    if (onlyAllowedChanged && typeof window !== 'undefined') {
      const scope = window as typeof window & { __suppressRouteReset__?: boolean };
      scope.__suppressRouteReset__ = true;
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => { scope.__suppressRouteReset__ = false; });
      } else {
        window.setTimeout(() => { scope.__suppressRouteReset__ = false; }, 0);
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
      if (seen.has(key)) dups.push(key);
      else seen.add(key);
    });
    if (dups.length) {
      console.warn('[daily/support] Duplicate scheduleKey detected:', dups);
    }
  }, [schedule]);

  // --- Callbacks ---
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

  const handleErrorClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('daily-support-submit-error');
    }
    clearError();
    setSubmitError(null);
  }, [clearError, setSubmitError]);

  const handleCopyReport = useCallback(async () => {
    if (!targetUserId || !selectedUser) return;
    const records = executionStore.getRecords(targetDate, targetUserId);
    const report = generateDailyReport({
      date: targetDate,
      userName: selectedUser.FullName,
      schedule,
      records,
      observations: (() => {
        const m = new Map<string, string>();
        recentObservations.forEach((o) => {
          if (o.planSlotKey && o.actualObservation) m.set(o.planSlotKey, o.actualObservation);
        });
        return m;
      })(),
    });
    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Fallback handled by snackbar
    }
  }, [executionStore, schedule, selectedUser, targetDate, targetUserId]);

  // --- IBD Summary Data ---
  const numericUserId = targetUserId ? Number(targetUserId.replace(/\D/g, '')) || 0 : 0;
  const latestSPS = useMemo(() => numericUserId ? getLatestSPS(numericUserId) : undefined, [numericUserId]);
  const supervisionCounter = useMemo(() => numericUserId ? getSupervisionCounter(numericUserId) : undefined, [numericUserId]);
  const todayAbcCount = useMemo(() => {
    if (!targetUserId) return 0;
    const records = getABCRecordsForUser(targetUserId);
    const todayStr = toLocalDateISO();
    return records.filter((r) => r.recordedAt?.slice(0, 10) === todayStr).length;
  }, [targetUserId]);

  return (
    <FullScreenDailyDialogPage
      title="支援手順兼記録"
      backTo="/dashboard"
      testId="daily-support-page"
      headerActions={
        <Stack direction="row" spacing={0.5} alignItems="center">
          {/* ── User Selector ── */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="iceberg-user-select-label">対象者</InputLabel>
            <Select
              labelId="iceberg-user-select-label"
              value={targetUserId}
              label="対象者"
              onChange={(event) => handleUserChange(event.target.value)}
              startAdornment={<PersonIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />}
              data-testid="user-select"
              sx={{
                bgcolor: 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                fontSize: '0.85rem',
              }}
            >
              <MenuItem value="">
                <em>選択</em>
              </MenuItem>
              {filteredUsers.map((user) => (
                <MenuItem key={user.UserID} value={user.UserID}>
                  {user.FullName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── Status Filter ── */}
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="filter-usage-status-label">状態</InputLabel>
            <Select
              labelId="filter-usage-status-label"
              value={filter.usageStatus}
              label="状態"
              onChange={(e) => updateFilter({ usageStatus: e.target.value })}
              data-testid="filter-usage-status"
              sx={{
                bgcolor: 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                fontSize: '0.85rem',
              }}
            >
              <MenuItem value="">(全て)</MenuItem>
              <MenuItem value="active">利用中</MenuItem>
              <MenuItem value="pending">待ち</MenuItem>
              <MenuItem value="suspended">休止</MenuItem>
              <MenuItem value="terminated">終了</MenuItem>
            </Select>
          </FormControl>

          {/* ── High Intensity Toggle ── */}
          <Tooltip title="強度行動障害支援対象者のみ表示">
            <ToggleButton
              value="highIntensity"
              selected={filter.highIntensityOnly}
              onChange={() => updateFilter({ highIntensityOnly: !filter.highIntensityOnly })}
              size="small"
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1, py: 0.5 }}
              data-testid="filter-high-intensity"
            >
              強度
            </ToggleButton>
          </Tooltip>

          {/* ── Filter Count ── */}
          {hasActiveFilter && (
            <>
              <Chip
                label={`${filteredUsers.length}/${users.length}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 24 }}
              />
              <Tooltip title="フィルターリセット">
                <IconButton size="small" onClick={resetFilter} aria-label="フィルターをリセット">
                  <FilterListOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}

          {/* ── Divider — filter vs action groups ── */}
          {targetUserId && selectedUser && (
            <Box sx={{ borderLeft: 2, borderColor: 'grey.300', height: 28, mx: 1 }} />
          )}

          {/* ── Action Icons ── */}
          {targetUserId && selectedUser && (
            <>
              <Tooltip title="手順を編集">
                <IconButton
                  onClick={() => setIsEditOpen(true)}
                  size="small"
                  color="primary"
                  aria-label="手順を編集"
                  data-testid="procedure-edit-button"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={`直近記録 (${recentObservations.length}件)`}>
                <IconButton
                  onClick={() => setRecentRecordsOpen(true)}
                  size="small"
                  data-testid="recent-records-button"
                >
                  <Badge badgeContent={recentObservations.length} color="primary" max={99}>
                    <HistoryIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
              <Tooltip title="日報コピー">
                <IconButton
                  onClick={handleCopyReport}
                  size="small"
                  data-testid="copy-daily-report-button"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      }
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'grey.100',
          backgroundColor: 'background.default',
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
        }}
        data-testid="iceberg-time-based-support-record-page"
      >

      {/* Error Alert (fixed, always visible) */}
      {displayedError ? (
        <Box
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            right: 12,
            zIndex: (theme) => theme.zIndex.modal + 3,
          }}
        >
          <Alert severity="error" onClose={handleErrorClose}>
            {String(displayedError)}
          </Alert>
        </Box>
      ) : null}

      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <BentoGridSupportLayout
          recordRef={recordPanelRef}
          header={
            <SupportPageHeader
              targetUserId={targetUserId}
              selectedUser={selectedUser}
              filteredUsers={filteredUsers}
              allUsersCount={users.length}
              recentObservations={recentObservations}
              filter={filter}
              hasActiveFilter={hasActiveFilter}
              onUserChange={handleUserChange}
              onEditorOpen={() => setIsEditOpen(true)}
              onRecentRecordsOpen={() => setRecentRecordsOpen(true)}
              onCopyReport={handleCopyReport}
              onUpdateFilter={updateFilter}
              onResetFilter={resetFilter}
            />
          }
          plan={targetUserId ? (
            <ProcedurePanel
              title={selectedUser ? `${selectedUser.FullName} 様 (Plan)` : '支援手順 (Plan)'}
              schedule={schedule}
              isAcknowledged={isAcknowledged}
              onAcknowledged={() => setIsAcknowledged(true)}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStepAndScroll}
              filledStepIds={filledStepIds}
              scrollToStepId={scrollToStepId}
              showUnfilledOnly={showUnfilledOnly}
              onToggleUnfilledOnly={() => setShowUnfilledOnly((prev) => !prev)}
              unfilledCount={unfilledStepsCount}
              totalCount={totalSteps}
              interventionPlans={userInterventionPlans}
              savedObservations={savedObservationsMap}
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
              selectedSlotKey={selectedStepId ?? undefined}
              onSlotChange={(next: string) => setSelectedStepId(next || null)}
              onAfterSubmit={handleAfterSubmit}
              recordDate={recordDate}
            />
          }
          summary={
            targetUserId ? (
              <SupportSummaryStrip
                totalSteps={totalSteps}
                filledSteps={totalSteps - unfilledStepsCount}
                abcCount={todayAbcCount}
                supervisionSupportCount={supervisionCounter?.supportCount}
                positiveConditions={latestSPS?.positiveConditions}
              />
            ) : undefined
          }
        />
      </Box>

      {/* Dialogs */}
      <RecentRecordsDialog
        open={recentRecordsOpen}
        onClose={() => setRecentRecordsOpen(false)}
        observations={recentObservations}
        userName={selectedUser?.FullName}
      />

      <ProcedureEditor
        open={isEditOpen}
        initialItems={schedule}
        onClose={() => setIsEditOpen(false)}
        onSave={handleProcedureSave}
        availablePlans={bipOptions}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <Snackbar
        open={Boolean(displayedError)}
        autoHideDuration={null}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
      >
        <Alert
          onClose={handleErrorClose}
          severity="error"
          sx={{ width: '100%' }}
          action={retryPersist ? (
            <Button color="inherit" size="small" onClick={handleRetryPersist}>
              再送
            </Button>
          ) : undefined}
        >
          {String(displayedError ?? '')}
        </Alert>
      </Snackbar>
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default TimeBasedSupportRecordPage;
