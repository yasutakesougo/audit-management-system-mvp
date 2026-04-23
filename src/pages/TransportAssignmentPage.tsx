import { toLocalDateISO } from '@/utils/getNow';
import {
  applyPreviousWeekdayDefaults,
  assignUserToVehicle,
  buildTransportAssignmentDraft,
  recomputeUnassignedUsers,
  removeUserFromVehicle,
  type TransportAssignmentDraft,
  type TransportAssignmentScheduleRow,
  type TransportAssignmentStaffSource,
  type TransportAssignmentUserSource,
} from '@/features/transport-assignments/domain/transportAssignmentDraft';
import { resolveUserFixedTransportCourse } from '@/features/transport-assignments/domain/userTransportCourse';
import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { useTransportAssignmentSave } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import { useAssignmentSave } from '@/features/transport-assignments/hooks/useAssignmentSave';
import { useSchedules } from '@/features/schedules/hooks/legacy/useSchedules';
import { useStaffStore } from '@/features/staff/store';
import { getTransportCourseLabel, parseTransportCourse } from '@/features/today/transport/transportCourse';
import { hasTransportInfo } from '@/features/today/transport/transportStatusLogic';
import { DEFAULT_TRANSPORT_VEHICLE_IDS } from '@/features/today/transport/transportAssignments';
import type { TransportDirection } from '@/features/today/transport/transportTypes';
import {
  applyTransportVehicleNameOverride,
  loadTransportVehicleNameOverrides,
  resolveTransportVehicleName,
  saveTransportVehicleNameOverrides,
  type TransportVehicleNameOverrides,
} from '@/features/today/transport/transportVehicleNames';
import { 
  buildSchedulePatchPayloadsViaDomain 
} from '@/features/transport-assignments/adapters/assignmentAdapter';
import { 
  getTransportAssignmentInsights,
  orchestrateWeekBulkApply,
  compareDraftWithPersistedAssignments,
  detectConcurrencyConflicts,
  validateSaveReadiness,
  type AssignmentDiff,
  type ConcurrencyConflictInsight
} from '@/features/transport-assignments/application/transportAssignmentApplication';
import { useUsers } from '@/features/users/useUsers';
import { useAssignments } from '@/features/schedules/hooks/useAssignments';
import { useAssignmentRepository } from '@/features/schedules/assignmentRepositoryFactory';
import type { TransportAssignment } from '@/features/schedules/domain/assignment';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DirectionsBusRoundedIcon from '@mui/icons-material/DirectionsBusRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { emitTelemetry } from '@/lib/telemetry';
import { STORAGE_KEY as DAILY_STORAGE_KEY, type DailyFilters } from './dailyPageConstants';
import { TransportAssignmentControlSection } from './transport-assignment/TransportAssignmentControlSection';
import {
  buildDateRange,
  buildWeekBulkSummaryLabel,
  buildWeekDateOptions,
  DEFAULT_LOOKBACK_WEEKS,
  formatWeekRange,
  getWeekStartDate,
  isOnTargetDate,
  normalizeText,
  normalizeToWeekdayDate,
  shiftDateInJst,
  type WeekBulkApplyState,
} from './transport-assignment/TransportAssignmentPage.logic';
import { TransportAssignmentVehicleSection } from './transport-assignment/TransportAssignmentVehicleSection';
import { TransportConcurrencyInsightBanner } from './transport-assignment/TransportConcurrencyInsightBanner';

export default function TransportAssignmentPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [targetDate, setTargetDate] = useState<string>(() => {
    // 1. URL Check
    const params = new URLSearchParams(location.search);
    const urlDate = params.get('date');
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      return normalizeToWeekdayDate(urlDate);
    }

    // 2. Session Context Inheritance (from Today hub)
    try {
      const dailyRaw = window.sessionStorage.getItem(DAILY_STORAGE_KEY);
      if (dailyRaw) {
        const dailyFilters = JSON.parse(dailyRaw) as DailyFilters;
        if (dailyFilters.from && /^\d{4}-\d{2}-\d{2}$/.test(dailyFilters.from)) {
          return normalizeToWeekdayDate(dailyFilters.from);
        }
      }
    } catch {
      // ignore parse errors
    }

    // 3. Fallback
    const val = normalizeToWeekdayDate(toLocalDateISO());
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info(`[DIAGNOSTIC] TransportAssignmentPage: Initialized targetDate to ${val} (URL date: ${urlDate})`);
    }
    return val;
  });

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.info('[DIAGNOSTIC] TransportAssignmentPage: Component mounted');
    }
  }, []);

  // Sync date to URL for bookmarkability and context preservation during refresh
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('date') !== targetDate) {
      // Defer navigation to next tick to avoid "navigate during render" conflicts which cause NotFoundError in React Router
      const timer = setTimeout(() => {
        const currentParams = new URLSearchParams(window.location.search);
        if (currentParams.get('date') !== targetDate) {
          currentParams.set('date', targetDate);
          navigate({ search: currentParams.toString() }, { replace: true });
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [targetDate, location.search, navigate]);

  const [direction, setDirection] = useState<TransportDirection>('to');
  const [draft, setDraft] = useState<TransportAssignmentDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingAssignByVehicle, setPendingAssignByVehicle] = useState<Record<string, string>>({});
  const [vehicleNameOverrides, setVehicleNameOverrides] = useState<TransportVehicleNameOverrides>(
    () => loadTransportVehicleNameOverrides(),
  );
  const [vehicleNameDraftByVehicle, setVehicleNameDraftByVehicle] = useState<Record<string, string>>({});
  const [weekBulkApplyState, setWeekBulkApplyState] = useState<WeekBulkApplyState | null>(null);

  const weekStartDate = useMemo(() => getWeekStartDate(targetDate), [targetDate]);
  const scheduleRange = useMemo(
    () => buildDateRange(weekStartDate, DEFAULT_LOOKBACK_WEEKS),
    [weekStartDate],
  );
  const weekDateOptions = useMemo(() => buildWeekDateOptions(weekStartDate), [weekStartDate]);
  const weekRangeLabel = useMemo(() => formatWeekRange(weekStartDate), [weekStartDate]);
  const {
    items: scheduleItems,
    loading: schedulesLoading,
    update: updateSchedule,
    refetch: refetchSchedules,
  } = useSchedules(scheduleRange);
  const { data: usersData, status: usersStatus } = useUsers();
  const { data: staffRows, loading: staffLoading } = useStaffStore();
  const {
    status: legacySaveStatus,
    error: legacySaveError,
    clearError: clearLegacySaveError,
    lastSavedAt,
  } = useTransportAssignmentSave({
    updateSchedule,
    refetchSchedules,
  });

  const assignmentRepo = useAssignmentRepository();
  const { 
    status: repoSaveStatus, 
    error: repoSaveError, 
    saveAssignments: repoSave, 
    saveBulkAssignments: repoBulkSave,
    clearError: clearRepoSaveError 
  } = useAssignmentSave(assignmentRepo);

  const clearSaveError = useCallback(() => {
    clearLegacySaveError();
    clearRepoSaveError();
  }, [clearLegacySaveError, clearRepoSaveError]);

  const saveStatus = repoSaveStatus !== 'idle' ? repoSaveStatus : legacySaveStatus;
  const saveError = repoSaveError || legacySaveError;

  const { assignments: persistedAssignments, loading: assignmentsLoading, refetch: refetchAssignments } = useAssignments({
    type: 'transport',
    range: {
      from: `${targetDate}T00:00:00+09:00`,
      to: `${targetDate}T23:59:59+09:00`,
    },
  });

  const [persistedSnapshot, setPersistedSnapshot] = useState<TransportAssignment[] | null>(null);
  const [allowConcurrencyBypass, setAllowConcurrencyBypass] = useState(false);

  // Snapshot logic for concurrency detection
  useEffect(() => {
    if (!assignmentsLoading && persistedAssignments && !persistedSnapshot) {
      if (process.env.NODE_ENV !== 'production') {
        const etags = (persistedAssignments as any[]).map(a => `${a.id}:${a.etag}`);
        // eslint-disable-next-line no-console
        console.info(`[DIAGNOSTIC] TransportAssignmentPage: Capturing persisted snapshot. ETags: ${JSON.stringify(etags)}`);
      }
      setPersistedSnapshot(persistedAssignments as any);
    }
  }, [assignmentsLoading, persistedAssignments, persistedSnapshot]);

  // Reset snapshot when context changes
  useEffect(() => {
    setPersistedSnapshot(null);
  }, [targetDate, direction]);

  const userSources = useMemo<TransportAssignmentUserSource[]>(
    () =>
      (usersData ?? [])
        .filter((user) => hasTransportInfo(user))
        .map((user) => {
          const fixedCourseId = resolveUserFixedTransportCourse(user);
          return {
            userId: user.UserID,
            userName: user.FullName,
            fixedCourseId,
            fixedCourseLabel: getTransportCourseLabel(fixedCourseId),
          };
        })
        .filter((user) => Boolean(normalizeText(user.userId)) && Boolean(normalizeText(user.userName))),
    [usersData],
  );

  const staffSources = useMemo<TransportAssignmentStaffSource[]>(
    () =>
      staffRows.map((staff) => ({
        id: staff.id,
        staffId: staff.staffId,
        name: staff.name,
      })),
    [staffRows],
  );

  const staffOptions = useMemo(
    () =>
      staffRows
        .map((staff) => {
          const staffId = normalizeText(staff.staffId) ?? normalizeText(String(staff.id));
          if (!staffId) return null;
          return {
            staffId,
            label: staff.name?.trim() || staffId,
          };
        })
        .filter((staff): staff is { staffId: string; label: string } => staff !== null),
    [staffRows],
  );

  const staffNameById = useMemo(() => new Map(staffOptions.map((staff) => [staff.staffId, staff.label] as const)), [staffOptions]);

  const scheduleRows = useMemo(
    () => scheduleItems as unknown as TransportAssignmentScheduleRow[],
    [scheduleItems],
  );
  const selectedDateRows = useMemo(
    () => scheduleRows.filter((row) => isOnTargetDate(row.start, targetDate)),
    [scheduleRows, targetDate],
  );

  const baseDraft = useMemo(
    () =>
      buildTransportAssignmentDraft({
        date: targetDate,
        direction,
        schedules: selectedDateRows,
        users: userSources,
        staff: staffSources,
        fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
      }),
    [direction, selectedDateRows, staffSources, targetDate, userSources],
  );

  const baseDraftSnapshot = useMemo(() => JSON.stringify(baseDraft), [baseDraft]);
  const stableBaseDraft = useMemo(() => baseDraft, [baseDraftSnapshot]);
  const weekdayDefaultDraft = useMemo(
    () =>
      applyPreviousWeekdayDefaults({
        draft: stableBaseDraft,
        schedules: scheduleRows,
        users: userSources,
      }),
    [scheduleRows, stableBaseDraft, userSources],
  );
  const weekdayDefaultSnapshot = useMemo(() => JSON.stringify(weekdayDefaultDraft), [weekdayDefaultDraft]);
  const hasWeekdayDefaultSuggestion = weekdayDefaultSnapshot !== baseDraftSnapshot;

  useEffect(() => {
    setDraft(stableBaseDraft);
    setDirty(false);
    setPendingAssignByVehicle({});
    setVehicleNameDraftByVehicle({});
  }, [stableBaseDraft]);

  const currentDraft = draft ?? stableBaseDraft;
  const isLoading = schedulesLoading || staffLoading || usersStatus === 'loading' || usersStatus === 'idle' || assignmentsLoading;

  const assignmentDiffs = useMemo(() => {
    if (!draft || !persistedAssignments) return [];
    return compareDraftWithPersistedAssignments(draft, (persistedAssignments as any));
  }, [draft, persistedAssignments]);

  const concurrencyConflicts = useMemo(() => {
    const conflicts = detectConcurrencyConflicts(persistedSnapshot, (persistedAssignments as any), vehicleNameOverrides);
    if (conflicts.length > 0 && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[TransportAssignmentPage] Concurrency Conflicts detected:', conflicts);
    }
    return conflicts;
  }, [persistedSnapshot, persistedAssignments, vehicleNameOverrides]);

  // Telemetry for Concurrency Conflicts
  useEffect(() => {
    if (concurrencyConflicts.length > 0) {
      emitTelemetry('assignment:concurrency_conflict', {
        targetDate,
        direction,
        conflictCount: concurrencyConflicts.length,
        vehicles: concurrencyConflicts.map((c: ConcurrencyConflictInsight) => c.vehicleName),
      });
    }
  }, [concurrencyConflicts, targetDate, direction]);

  const coordinationInsights = useMemo(() => {
    const vehicleCapacities: Record<string, number> = {
      '車両1': 6,
      '車両2': 6,
      '車両3': 8,
      '車両4': 4,
    };
    return getTransportAssignmentInsights(currentDraft, vehicleNameOverrides, vehicleCapacities);
  }, [currentDraft, vehicleNameOverrides]);

  const saveReadiness = useMemo(() => {
    return validateSaveReadiness(coordinationInsights, concurrencyConflicts);
  }, [coordinationInsights, concurrencyConflicts]);

  const userNameById = useMemo(
    () => new Map(currentDraft.users.map((user) => [user.userId, user.userName] as const)),
    [currentDraft.users],
  );

  const payloadPreview = useMemo(
    () =>
      buildSchedulePatchPayloadsViaDomain(currentDraft, selectedDateRows),
    [currentDraft, selectedDateRows],
  );
  const effectivePayloadPreview = useMemo(() => {
    const byId = new Map<string, UpdateScheduleEventInput>();
    if (weekBulkApplyState) {
      for (const payload of weekBulkApplyState.payloads) {
        byId.set(payload.id, payload);
      }
    }
    for (const payload of payloadPreview) {
      byId.set(payload.id, payload);
    }
    return [...byId.values()];
  }, [payloadPreview, weekBulkApplyState]);
  const weekBulkSummaryLabel = useMemo(
    () => buildWeekBulkSummaryLabel(weekBulkApplyState, weekDateOptions),
    [weekBulkApplyState, weekDateOptions],
  );

  const canSave = 
    dirty && 
    effectivePayloadPreview.length > 0 && 
    saveStatus !== 'saving' &&
    (!saveReadiness.isBlocked || (saveReadiness.blockReason === 'concurrency_conflict' && allowConcurrencyBypass));

  const handleTargetDateChange = (nextDateValue: string) => {
    const normalized = normalizeText(nextDateValue);
    if (!normalized) return;
    setTargetDate(normalizeToWeekdayDate(normalized));
  };

  const handleChangeWeek = (offsetDays: number) => {
    setTargetDate((prev) => normalizeToWeekdayDate(shiftDateInJst(prev, offsetDays)));
  };

  const handleVehicleNameDraftChange = (vehicleId: string, nextName: string) => {
    setVehicleNameDraftByVehicle((prev) => ({
      ...prev,
      [vehicleId]: nextName,
    }));
  };

  const handleVehicleNameCommit = (vehicleId: string, nextNameInput?: string) => {
    const nextName = nextNameInput ?? vehicleNameDraftByVehicle[vehicleId];
    if (nextName === undefined) return;

    const nextOverrides = applyTransportVehicleNameOverride(vehicleNameOverrides, vehicleId, nextName);
    setVehicleNameOverrides(nextOverrides);
    saveTransportVehicleNameOverrides(nextOverrides);
    setVehicleNameDraftByVehicle((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
  };

  const handleDriverChange = (vehicleId: string, staffId: string) => {
    clearSaveError();
    setDraft((prev) => {
      if (!prev) return prev;
      const normalizedStaffId = normalizeText(staffId);
      const nextVehicles = prev.vehicles.map((vehicle) =>
        vehicle.vehicleId === vehicleId
          ? {
              ...vehicle,
              driverStaffId: normalizedStaffId,
              driverName: normalizedStaffId ? (staffNameById.get(normalizedStaffId) ?? null) : null,
            }
          : vehicle,
      );
      const nextDraft = {
        ...prev,
        vehicles: nextVehicles,
      };
      return {
        ...nextDraft,
        unassignedUserIds: recomputeUnassignedUsers(nextDraft),
      };
    });
    setDirty(true);
  };

  const handleCourseChange = (vehicleId: string, courseValue: string) => {
    clearSaveError();
    setDraft((prev) => {
      if (!prev) return prev;
      const courseId = parseTransportCourse(courseValue);
      const nextVehicles = prev.vehicles.map((vehicle) =>
        vehicle.vehicleId === vehicleId
          ? {
              ...vehicle,
              courseId,
              courseLabel: getTransportCourseLabel(courseId),
            }
          : vehicle,
      );
      const nextDraft = {
        ...prev,
        vehicles: nextVehicles,
      };
      return {
        ...nextDraft,
        unassignedUserIds: recomputeUnassignedUsers(nextDraft),
      };
    });
    setDirty(true);
  };

  const handleAttendantChange = (vehicleId: string, staffId: string) => {
    clearSaveError();
    setDraft((prev) => {
      if (!prev) return prev;
      const normalizedStaffId = normalizeText(staffId);
      const nextVehicles = prev.vehicles.map((vehicle) =>
        vehicle.vehicleId === vehicleId
          ? {
              ...vehicle,
              attendantStaffId: normalizedStaffId,
              attendantName: normalizedStaffId ? (staffNameById.get(normalizedStaffId) ?? null) : null,
            }
          : vehicle,
      );
      const nextDraft = {
        ...prev,
        vehicles: nextVehicles,
      };
      return {
        ...nextDraft,
        unassignedUserIds: recomputeUnassignedUsers(nextDraft),
      };
    });
    setDirty(true);
  };

  const handleAssignUser = (vehicleId: string) => {
    const userId = normalizeText(pendingAssignByVehicle[vehicleId]);
    if (!userId) return;

    clearSaveError();
    setDraft((prev) => (prev ? assignUserToVehicle(prev, userId, vehicleId) : prev));
    setPendingAssignByVehicle((prev) => ({ ...prev, [vehicleId]: '' }));
    setDirty(true);
  };

  const handleRemoveUser = (userId: string) => {
    clearSaveError();
    setDraft((prev) => (prev ? removeUserFromVehicle(prev, userId) : prev));
    setDirty(true);
  };

  const handlePendingAssignChange = (vehicleId: string, userId: string) => {
    setPendingAssignByVehicle((prev) => ({
      ...prev,
      [vehicleId]: userId,
    }));
  };

  const handleSave = async () => {
    if (!canSave) return;
    
    // Final readiness check
    if (saveReadiness.isBlocked && !(saveReadiness.blockReason === 'concurrency_conflict' && allowConcurrencyBypass)) {
      if (saveReadiness.blockReason === 'concurrency_conflict') {
        emitTelemetry('assignment:save_blocked_by_conflict', {
          targetDate,
          direction,
          conflictCount: concurrencyConflicts.length,
        });
      }
      return;
    }

    if (weekBulkApplyState) {
      // Modern repository bulk save for the whole week
      const result = await repoBulkSave(weekBulkApplyState.assignments);
      if (result.success) {
        setDirty(false);
        setWeekBulkApplyState(null);
        void refetchSchedules();
        void refetchAssignments();
      }
    } else if (draft) {
      // Modern repository-based save for current day
      const result = await repoSave(draft);
      if (result.success) {
        setDirty(false);
        void refetchSchedules();
        void refetchAssignments();
      }
    }
  };

  const handleApplyWeekdayDefault = () => {
    if (!hasWeekdayDefaultSuggestion) return;
    clearSaveError();
    setDraft(weekdayDefaultDraft);
    setDirty(true);
    setPendingAssignByVehicle({});
  };

  const handleApplyWeekBulkDefault = () => {
    clearSaveError();

    const result = orchestrateWeekBulkApply({
      targetDate,
      direction,
      weekdayDefaultDraft,
      scheduleRows,
      userSources,
      staffSources,
      weekDateOptions,
    });

    setDraft(result.nextDraft);
    setPendingAssignByVehicle({});
    setWeekBulkApplyState({ 
      signals: [] as any[],
      assignments: result.assignments, 
      payloads: result.payloads, 
      summary: result.summary 
    });
    setDirty(result.payloads.length > 0 || payloadPreview.length > 0);
  };

  useEffect(() => {
    if (dirty && payloadPreview.length === 0) {
      if (!weekBulkApplyState || weekBulkApplyState.payloads.length === 0) {
        setDirty(false);
      }
    }
  }, [dirty, payloadPreview.length, weekBulkApplyState]);

  useEffect(() => {
    clearSaveError();
    setWeekBulkApplyState(null);
    setAllowConcurrencyBypass(false);
  }, [targetDate, direction, clearSaveError]);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="transport-assignment-page">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DirectionsBusRoundedIcon color="primary" />
          <Typography variant="h4" component="h1">
            送迎配車表
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/today"
          startIcon={<ArrowBackRoundedIcon />}
          variant="outlined"
          data-testid="transport-assignment-back-today"
        >
          今日の業務へ戻る
        </Button>
      </Stack>
      
      <TransportConcurrencyInsightBanner />

      <TransportAssignmentControlSection
        targetDate={targetDate}
        direction={direction}
        weekRangeLabel={weekRangeLabel}
        weekDateOptions={weekDateOptions}
        hasWeekdayDefaultSuggestion={hasWeekdayDefaultSuggestion}
        saveStatus={saveStatus}
        dirty={dirty}
        lastSavedAt={lastSavedAt}
        effectivePayloadCount={effectivePayloadPreview.length}
        canSave={canSave}
        onTargetDateChange={handleTargetDateChange}
        onChangeWeek={handleChangeWeek}
        onDirectionChange={setDirection}
        onWeekdayChange={setTargetDate}
        onApplyWeekdayDefault={handleApplyWeekdayDefault}
        onApplyWeekBulkDefault={handleApplyWeekBulkDefault}
        onRefresh={() => {
          void refetchSchedules();
          void refetchAssignments();
        }}
        onSave={handleSave}
      />

      {weekBulkApplyState ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="transport-assignment-week-bulk-summary">
          今週一括適用の結果: {weekBulkSummaryLabel}
        </Alert>
      ) : null}

      {saveStatus === 'success' ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="transport-assignment-save-success">
          配車設定を保存しました。
        </Alert>
      ) : null}

      {saveStatus === 'error' ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="transport-assignment-save-error">
          配車設定の保存に失敗しました。時間をおいて再試行してください。
          {saveError instanceof Error ? ` (${saveError.message})` : ''}
        </Alert>
      ) : null}

      {coordinationInsights.map((insight, idx) => (
        <Alert 
          key={idx} 
          severity={insight.severity} 
          sx={{ mb: 2 }} 
          data-testid={`transport-assignment-insight-${insight.type}`}
        >
          {insight.message}
        </Alert>
      ))}

      {isLoading ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              配車データを読み込み中...
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {currentDraft.users.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          対象日・方向に該当する送迎予定がありません。
        </Alert>
      ) : null}

      {/* Proof of Wiring: Show count of persisted assignments from the repository path */}
      {!isLoading && persistedAssignments.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'right' }}>
          同期済みドメイン情報: {persistedAssignments.length} 件の割り当てを読込中 (Repository経由)
        </Typography>
      )}

      {/* Concurrency Conflict Warning */}
      {concurrencyConflicts.length > 0 && (
        <Alert 
          severity="error" 
          variant="filled"
          sx={{ mb: 2 }}
          data-testid="concurrency-conflict-alert"
          action={
            <Button color="inherit" size="small" data-testid="concurrency-reload-button" onClick={() => {
              emitTelemetry('assignment:refetch_after_conflict', {
                targetDate,
                direction,
                conflictCount: concurrencyConflicts.length,
              });
              setPersistedSnapshot(null); // Clear snapshot to reset warning
              refetchSchedules();
              refetchAssignments();
            }}>
              最新を読み込む
            </Button>
          }
        >
          <Typography variant="subtitle2">注意: 外部でデータが更新されました</Typography>
          次の車両の情報が他のユーザーによって変更された可能性があります: 
          {concurrencyConflicts.map((c: ConcurrencyConflictInsight) => c.vehicleName).join(', ')}
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  size="small" 
                  checked={allowConcurrencyBypass}
                  onChange={(e) => setAllowConcurrencyBypass(e.target.checked)}
                  data-testid="concurrency-bypass-checkbox"
                />
              }
              label={<Typography variant="caption">リスクを理解した上で、このまま保存することを許可する</Typography>}
            />
          </Box>
        </Alert>
      )}

      {/* Changes Summary Section */}
      {dirty && assignmentDiffs.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>未保存の変更内容:</Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {assignmentDiffs.map((diff: AssignmentDiff) => (
              <li key={diff.vehicleId}>
                <strong>{resolveTransportVehicleName(diff.vehicleId, vehicleNameOverrides)}</strong>: 
                {diff.type === 'added' && ' 新規追加'}
                {diff.type === 'removed' && ' 削除'}
                {diff.type === 'modified' && (
                  <>
                    変更あり 
                    {diff.userChanges && (
                      <span style={{ fontSize: '0.85em', marginLeft: '8px' }}>
                        ({diff.userChanges.added.length}名追加 / {diff.userChanges.removed.length}名解除)
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <TransportAssignmentVehicleSection
        currentDraft={currentDraft}
        saveStatus={saveStatus}
        userNameById={userNameById}
        staffOptions={staffOptions}
        pendingAssignByVehicle={pendingAssignByVehicle}
        vehicleNameOverrides={vehicleNameOverrides}
        vehicleNameDraftByVehicle={vehicleNameDraftByVehicle}
        onVehicleNameDraftChange={handleVehicleNameDraftChange}
        onVehicleNameCommit={handleVehicleNameCommit}
        onCourseChange={handleCourseChange}
        onDriverChange={handleDriverChange}
        onAttendantChange={handleAttendantChange}
        onPendingAssignChange={handlePendingAssignChange}
        onAssignUser={handleAssignUser}
        onRemoveUser={handleRemoveUser}
      />
    </Container>
  );
}
