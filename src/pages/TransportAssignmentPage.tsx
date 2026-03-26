import { toLocalDateISO } from '@/utils/getNow';
import {
  applyPreviousWeekdayDefaults,
  assignUserToVehicle,
  buildSchedulePatchPayloads,
  buildTransportAssignmentDraft,
  hasVehicleMissingDriver,
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
import { useSchedules } from '@/features/schedules/hooks/useSchedules';
import { useStaffStore } from '@/features/staff/store';
import { TRANSPORT_COURSE_OPTIONS, getTransportCourseLabel, parseTransportCourse } from '@/features/today/transport/transportCourse';
import {
  DEFAULT_TRANSPORT_VEHICLE_IDS,
} from '@/features/today/transport/transportAssignments';
import {
  applyTransportVehicleNameOverride,
  loadTransportVehicleNameOverrides,
  resolveTransportVehicleName,
  saveTransportVehicleNameOverrides,
  type TransportVehicleNameOverrides,
} from '@/features/today/transport/transportVehicleNames';
import { useUsers } from '@/features/users/useUsers';
import Alert from '@mui/material/Alert';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DirectionsBusRoundedIcon from '@mui/icons-material/DirectionsBusRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type TransportDirection = 'to' | 'from';

const JST_TZ = 'Asia/Tokyo';
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_WEEKS = 8;

type WeekDateOption = {
  date: string;
  label: string;
};

type WeekBulkApplyState = {
  payloads: UpdateScheduleEventInput[];
  summary: Array<{ date: string; count: number }>;
};

function toJstDateKey(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: JST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toJstWeekdayLabel(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TZ,
    weekday: 'short',
  }).format(date);
}

function toJstNoon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00+09:00`);
}

function shiftDateInJst(dateKey: string, days: number): string {
  const base = toJstNoon(dateKey);
  return toJstDateKey(new Date(base.getTime() + (days * DAY_MS)));
}

function getWeekStartDate(dateKey: string): string {
  const base = toJstNoon(dateKey);
  const day = base.getUTCDay(); // 0: Sun ... 6: Sat (stable for JST noon)
  const diff = (day + 6) % 7; // Monday start
  return toJstDateKey(new Date(base.getTime() - (diff * DAY_MS)));
}

function buildWeekDateOptions(weekStart: string): WeekDateOption[] {
  return Array.from({ length: 5 }, (_, index) => {
    const date = shiftDateInJst(weekStart, index);
    const weekday = toJstWeekdayLabel(toJstNoon(date));
    return {
      date,
      label: `${weekday} ${date.slice(5).replace('-', '/')}`,
    };
  });
}

function formatWeekRange(weekStart: string): string {
  const weekEnd = shiftDateInJst(weekStart, 4);
  return `${weekStart.slice(5).replace('-', '/')} - ${weekEnd.slice(5).replace('-', '/')}`;
}

function buildDateRange(weekStart: string, lookbackWeeks = 0): { from: string; to: string } {
  const rangeStart = shiftDateInJst(weekStart, -(lookbackWeeks * 7));
  const weekEnd = shiftDateInJst(weekStart, 4);
  return {
    from: `${rangeStart}T00:00:00+09:00`,
    to: `${weekEnd}T23:59:59+09:00`,
  };
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function isOnTargetDate(start: string | undefined, targetDate: string): boolean {
  if (!start) return false;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return false;
  return toJstDateKey(date) === targetDate;
}

function normalizeToWeekdayDate(dateKey: string): string {
  const day = toJstNoon(dateKey).getUTCDay();
  if (day === 0) return shiftDateInJst(dateKey, 1);
  if (day === 6) return shiftDateInJst(dateKey, -1);
  return dateKey;
}

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
      usersData
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
  const weekBulkSummaryLabel = useMemo(() => {
    if (!weekBulkApplyState) return '';
    const weekdayByDate = new Map(
      weekDateOptions.map((option) => [option.date, option.label.split(' ')[0] ?? option.date] as const),
    );
    return weekBulkApplyState.summary
      .map((item) => {
        const weekday = weekdayByDate.get(item.date) ?? item.date;
        return item.count > 0 ? `${weekday} ${item.count}件` : `${weekday} 変更なし`;
      })
      .join(' / ');
  }, [weekBulkApplyState, weekDateOptions]);
  const missingDriverVehicleIds = useMemo(
    () =>
      currentDraft.vehicles
        .filter((vehicle) => hasVehicleMissingDriver(vehicle))
        .map((vehicle) => resolveTransportVehicleName(vehicle.vehicleId, vehicleNameOverrides)),
    [currentDraft.vehicles, vehicleNameOverrides],
  );
  const canSave = dirty && effectivePayloadPreview.length > 0 && saveStatus !== 'saving';

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

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            label="対象日"
            type="date"
            size="small"
            value={targetDate}
            onChange={(event) => {
              const normalized = normalizeText(event.target.value);
              if (!normalized) return;
              setTargetDate(normalizeToWeekdayDate(normalized));
            }}
            inputProps={{ 'data-testid': 'transport-assignment-date' }}
            sx={{ width: { xs: '100%', md: 220 } }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              variant="outlined"
              onClick={() => setTargetDate((prev) => normalizeToWeekdayDate(shiftDateInJst(prev, -7)))}
              data-testid="transport-assignment-week-prev"
            >
              前週
            </Button>
            <Chip
              size="small"
              label={`週 ${weekRangeLabel}`}
              data-testid="transport-assignment-week-range"
            />
            <Button
              size="small"
              variant="outlined"
              onClick={() => setTargetDate((prev) => normalizeToWeekdayDate(shiftDateInJst(prev, 7)))}
              data-testid="transport-assignment-week-next"
            >
              次週
            </Button>
          </Stack>
          <ToggleButtonGroup
            size="small"
            color="primary"
            exclusive
            value={direction}
            onChange={(_, value: TransportDirection | null) => {
              if (value) setDirection(value);
            }}
            data-testid="transport-assignment-direction"
          >
            <ToggleButton value="to">迎え</ToggleButton>
            <ToggleButton value="from">送り</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            size="small"
            color="primary"
            exclusive
            value={targetDate}
            onChange={(_, value: string | null) => {
              if (value) setTargetDate(value);
            }}
            data-testid="transport-assignment-weekdays"
            sx={{ flexWrap: 'wrap' }}
          >
            {weekDateOptions.map((option) => (
              <ToggleButton
                key={option.date}
                value={option.date}
                data-testid={`transport-assignment-weekday-${option.date}`}
              >
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {hasWeekdayDefaultSuggestion ? (
            <Button
              size="small"
              variant="outlined"
              onClick={handleApplyWeekdayDefault}
              data-testid="transport-assignment-apply-weekday-default"
              disabled={saveStatus === 'saving'}
            >
              同曜日デフォルト適用
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            onClick={handleApplyWeekBulkDefault}
            data-testid="transport-assignment-apply-week-bulk-default"
            disabled={saveStatus === 'saving'}
          >
            今週に一括適用
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
            {saveStatus === 'saving'
              ? '保存中...'
              : dirty
                ? '未保存の変更があります'
                : saveStatus === 'success'
                  ? `保存済み (${formatSavedAt(lastSavedAt)})`
                  : '変更なし'}
          </Typography>
          <Chip
            size="small"
            color={effectivePayloadPreview.length > 0 ? 'warning' : 'default'}
            label={`更新予定 ${effectivePayloadPreview.length}件`}
            data-testid="transport-assignment-payload-count"
          />
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={handleSave}
            data-testid="transport-assignment-save-button"
          >
            {saveStatus === 'saving' ? '保存中…' : '保存'}
          </Button>
        </Stack>
      </Paper>

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

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          mb: 2,
        }}
        data-testid="transport-assignment-vehicle-board-placeholder"
      >
        {currentDraft.vehicles.map((vehicle, index) => (
          <Paper
            key={vehicle.vehicleId}
            variant="outlined"
            sx={{ p: 2, minHeight: 220 }}
            data-testid={`transport-assignment-vehicle-card-${index + 1}`}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="車両名"
                value={vehicleNameDraftByVehicle[vehicle.vehicleId] ?? resolveTransportVehicleName(vehicle.vehicleId, vehicleNameOverrides)}
                onChange={(event) => handleVehicleNameDraftChange(vehicle.vehicleId, event.target.value)}
                onBlur={(event) => handleVehicleNameCommit(vehicle.vehicleId, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const value = (event.target as HTMLInputElement).value;
                  handleVehicleNameCommit(vehicle.vehicleId, value);
                  (event.target as HTMLInputElement).blur();
                }}
                disabled={saveStatus === 'saving'}
                inputProps={{
                  maxLength: 20,
                  'data-testid': `transport-assignment-vehicle-name-input-${index + 1}`,
                }}
                sx={{ minWidth: 180 }}
              />
              {vehicle.courseLabel ? (
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label={`コース: ${vehicle.courseLabel}`}
                  data-testid={`transport-assignment-vehicle-course-${index + 1}`}
                />
              ) : null}
              {hasVehicleMissingDriver(vehicle) ? (
                <Chip
                  size="small"
                  color="warning"
                  label="運転者未設定"
                  data-testid={`transport-assignment-vehicle-warning-${index + 1}`}
                />
              ) : null}
            </Stack>

            <Stack spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel id={`transport-assignment-course-label-${vehicle.vehicleId}`}>コース</InputLabel>
                <Select
                  labelId={`transport-assignment-course-label-${vehicle.vehicleId}`}
                  label="コース"
                  value={vehicle.courseId ?? ''}
                  onChange={(event) => handleCourseChange(vehicle.vehicleId, String(event.target.value))}
                  data-testid={`transport-assignment-course-select-${index + 1}`}
                  disabled={saveStatus === 'saving'}
                >
                  <MenuItem value="">
                    <em>未設定</em>
                  </MenuItem>
                  {TRANSPORT_COURSE_OPTIONS.map((course) => (
                    <MenuItem key={course.value} value={course.value}>
                      {course.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id={`transport-assignment-driver-label-${vehicle.vehicleId}`}>運転者</InputLabel>
                <Select
                  labelId={`transport-assignment-driver-label-${vehicle.vehicleId}`}
                  label="運転者"
                  value={vehicle.driverStaffId ?? ''}
                  onChange={(event) => handleDriverChange(vehicle.vehicleId, String(event.target.value))}
                  data-testid={`transport-assignment-driver-select-${index + 1}`}
                  disabled={saveStatus === 'saving'}
                >
                  <MenuItem value="">
                    <em>未設定</em>
                  </MenuItem>
                  {staffOptions.map((staff) => (
                    <MenuItem key={staff.staffId} value={staff.staffId}>
                      {staff.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id={`transport-assignment-attendant-label-${vehicle.vehicleId}`}>添乗者</InputLabel>
                <Select
                  labelId={`transport-assignment-attendant-label-${vehicle.vehicleId}`}
                  label="添乗者"
                  value={vehicle.attendantStaffId ?? ''}
                  onChange={(event) => handleAttendantChange(vehicle.vehicleId, String(event.target.value))}
                  data-testid={`transport-assignment-attendant-select-${index + 1}`}
                  disabled={saveStatus === 'saving'}
                >
                  <MenuItem value="">
                    <em>なし</em>
                  </MenuItem>
                  {staffOptions.map((staff) => (
                    <MenuItem key={`attendant-${staff.staffId}`} value={staff.staffId}>
                      {staff.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  乗車利用者
                </Typography>
                {vehicle.riderUserIds.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">割当なし</Typography>
                ) : (
                  vehicle.riderUserIds.map((userId) => (
                    <Stack key={`${vehicle.vehicleId}-${userId}`} direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={userNameById.get(userId) ?? userId} />
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => handleRemoveUser(userId)}
                        data-testid={`transport-assignment-unassign-${vehicle.vehicleId}-${userId}`}
                      >
                        解除
                      </Button>
                    </Stack>
                  ))
                )}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" fullWidth>
                  <InputLabel id={`transport-assignment-add-user-label-${vehicle.vehicleId}`}>未割当から追加</InputLabel>
                  <Select
                    labelId={`transport-assignment-add-user-label-${vehicle.vehicleId}`}
                    label="未割当から追加"
                    value={pendingAssignByVehicle[vehicle.vehicleId] ?? ''}
                    onChange={(event) =>
                      setPendingAssignByVehicle((prev) => ({
                        ...prev,
                        [vehicle.vehicleId]: String(event.target.value),
                      }))
                    }
                    data-testid={`transport-assignment-add-user-select-${index + 1}`}
                    disabled={saveStatus === 'saving'}
                  >
                    <MenuItem value="">
                      <em>選択してください</em>
                    </MenuItem>
                    {currentDraft.unassignedUserIds.map((userId) => (
                      <MenuItem key={`${vehicle.vehicleId}-${userId}`} value={userId}>
                        {userNameById.get(userId) ?? userId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => handleAssignUser(vehicle.vehicleId)}
                  disabled={saveStatus === 'saving' || !normalizeText(pendingAssignByVehicle[vehicle.vehicleId])}
                >
                  追加
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Paper
        variant="outlined"
        sx={{ p: 2, minHeight: 120 }}
        data-testid="transport-assignment-unassigned-placeholder"
      >
        <Typography variant="h6" sx={{ mb: 1 }}>未割当利用者</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" data-testid="transport-assignment-unassigned-list">
          {currentDraft.unassignedUserIds.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              未割当はありません。
            </Typography>
          ) : (
            currentDraft.unassignedUserIds.map((userId) => (
              <Chip
                key={`unassigned-${userId}`}
                size="small"
                label={userNameById.get(userId) ?? userId}
                variant="outlined"
              />
            ))
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
