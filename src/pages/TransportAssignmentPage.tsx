import { toLocalDateISO } from '@/utils/getNow';
import {
  applyPreviousWeekdayDefaults,
  assignUserToVehicle,
  buildSchedulePatchPayloads,
  buildTransportAssignmentDraft,
  hasVehicleMissingDriver,
  removeUserFromVehicle,
  toAssignmentChange,
  updateVehicleAssignment,
  type TransportAssignmentDraft,
  type TransportAssignmentScheduleRow,
  type TransportAssignmentStaffSource,
  type TransportAssignmentUserSource,
} from '@/features/transport-assignments/domain/transportAssignmentDraft';
import { resolveUserFixedTransportCourse } from '@/features/transport-assignments/domain/userTransportCourse';
import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { useTransportAssignmentSave } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import { useSchedules } from '@/features/schedules/hooks/legacy/useSchedules';
import { useStaffStore } from '@/features/staff/store';
import { getTransportCourseLabel } from '@/features/today/transport/transportCourse';
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
import { useUsers } from '@/features/users/useUsers';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DirectionsBusRoundedIcon from '@mui/icons-material/DirectionsBusRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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

export default function TransportAssignmentPage() {
  const [targetDate, setTargetDate] = useState<string>(() => normalizeToWeekdayDate(toLocalDateISO()));
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
    save,
    status: saveStatus,
    error: saveError,
    clearError: clearSaveError,
    lastSavedAt,
  } = useTransportAssignmentSave({
    updateSchedule,
    refetchSchedules,
  });

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
  const isLoading = schedulesLoading || staffLoading || usersStatus === 'loading' || usersStatus === 'idle';

  const userNameById = useMemo(
    () => new Map(currentDraft.users.map((user) => [user.userId, user.userName] as const)),
    [currentDraft.users],
  );

  const payloadPreview = useMemo(
    () =>
      buildSchedulePatchPayloads({
        draft: currentDraft,
        schedules: selectedDateRows,
      }),
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
  const missingDriverVehicleIds = useMemo(
    () =>
      currentDraft.vehicles
        .filter((vehicle) => hasVehicleMissingDriver(vehicle))
        .map((vehicle) => resolveTransportVehicleName(vehicle.vehicleId, vehicleNameOverrides)),
    [currentDraft.vehicles, vehicleNameOverrides],
  );
  const canSave = dirty && effectivePayloadPreview.length > 0 && saveStatus !== 'saving';

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
    const change = toAssignmentChange(staffId);
    setDraft((prev) => (prev ? updateVehicleAssignment(prev, vehicleId, 'driver', change, staffNameById) : prev));
    setDirty(true);
  };

  const handleCourseChange = (vehicleId: string, courseValue: string) => {
    clearSaveError();
    const change = toAssignmentChange(courseValue);
    setDraft((prev) => (prev ? updateVehicleAssignment(prev, vehicleId, 'course', change) : prev));
    setDirty(true);
  };

  const handleAttendantChange = (vehicleId: string, staffId: string) => {
    clearSaveError();
    const change = toAssignmentChange(staffId);
    setDraft((prev) => (prev ? updateVehicleAssignment(prev, vehicleId, 'attendant', change, staffNameById) : prev));
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
    const result = await save(effectivePayloadPreview);
    if (result.success) {
      setDirty(false);
      setWeekBulkApplyState(null);
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

    const nextTargetDraft = weekdayDefaultDraft;
    const payloadMap = new Map<string, UpdateScheduleEventInput>();
    const summary = weekDateOptions.map((option) => {
      const dayRows = scheduleRows.filter((row) => isOnTargetDate(row.start, option.date));
      const baseDraftForDate =
        option.date === targetDate
          ? nextTargetDraft
          : buildTransportAssignmentDraft({
              date: option.date,
              direction,
              schedules: dayRows,
              users: userSources,
              staff: staffSources,
              fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
            });
      const appliedDraftForDate = applyPreviousWeekdayDefaults({
        draft: baseDraftForDate,
        schedules: scheduleRows,
        users: userSources,
      });
      const dayPayloads = buildSchedulePatchPayloads({
        draft: appliedDraftForDate,
        schedules: dayRows,
      });
      for (const payload of dayPayloads) {
        payloadMap.set(payload.id, payload);
      }
      return {
        date: option.date,
        count: dayPayloads.length,
      };
    });

    setDraft(nextTargetDraft);
    setPendingAssignByVehicle({});
    const payloads = [...payloadMap.values()];
    setWeekBulkApplyState({ payloads, summary });
    setDirty(payloads.length > 0 || payloadPreview.length > 0);
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

      {missingDriverVehicleIds.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="transport-assignment-missing-driver-warning">
          乗車利用者がいる車両で運転者が未設定です: {missingDriverVehicleIds.join('、')}
        </Alert>
      ) : null}

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
