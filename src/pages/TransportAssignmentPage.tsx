import { toLocalDateISO } from '@/utils/getNow';
import {
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
import { useTransportAssignmentSave } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import { useSchedules } from '@/features/schedules/hooks/useSchedules';
import { useStaffStore } from '@/features/staff/store';
import {
  DEFAULT_TRANSPORT_VEHICLE_IDS,
} from '@/features/today/transport/transportAssignments';
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

function buildDateRange(date: string): { from: string; to: string } {
  return {
    from: `${date}T00:00:00+09:00`,
    to: `${date}T23:59:59+09:00`,
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

export default function TransportAssignmentPage() {
  const [targetDate, setTargetDate] = useState<string>(() => toLocalDateISO());
  const [direction, setDirection] = useState<TransportDirection>('to');
  const [draft, setDraft] = useState<TransportAssignmentDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingAssignByVehicle, setPendingAssignByVehicle] = useState<Record<string, string>>({});

  const scheduleRange = useMemo(() => buildDateRange(targetDate), [targetDate]);
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
        .map((user) => ({
          userId: user.UserID,
          userName: user.FullName,
        }))
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

  const baseDraft = useMemo(
    () =>
      buildTransportAssignmentDraft({
        date: targetDate,
        direction,
        schedules: scheduleRows,
        users: userSources,
        staff: staffSources,
        fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
      }),
    [direction, scheduleRows, staffSources, targetDate, userSources],
  );

  const baseDraftSnapshot = useMemo(() => JSON.stringify(baseDraft), [baseDraft]);
  const stableBaseDraft = useMemo(() => baseDraft, [baseDraftSnapshot]);

  useEffect(() => {
    setDraft(stableBaseDraft);
    setDirty(false);
    setPendingAssignByVehicle({});
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
        schedules: scheduleRows,
      }),
    [currentDraft, scheduleRows],
  );
  const missingDriverVehicleIds = useMemo(
    () =>
      currentDraft.vehicles
        .filter((vehicle) => hasVehicleMissingDriver(vehicle))
        .map((vehicle) => vehicle.vehicleId),
    [currentDraft.vehicles],
  );
  const canSave = dirty && payloadPreview.length > 0 && saveStatus !== 'saving';

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
    const result = await save(payloadPreview);
    if (result.success) {
      setDirty(false);
    }
  };

  useEffect(() => {
    if (dirty && payloadPreview.length === 0) {
      setDirty(false);
    }
  }, [dirty, payloadPreview.length]);

  useEffect(() => {
    clearSaveError();
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
            onChange={(event) => setTargetDate(event.target.value)}
            inputProps={{ 'data-testid': 'transport-assignment-date' }}
            sx={{ width: { xs: '100%', md: 220 } }}
          />
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
            color={payloadPreview.length > 0 ? 'warning' : 'default'}
            label={`更新予定 ${payloadPreview.length}件`}
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
              <Typography variant="h6">{vehicle.vehicleId}</Typography>
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
