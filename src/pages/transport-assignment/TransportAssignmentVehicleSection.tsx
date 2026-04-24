import {
  hasVehicleMissingDriver,
  type TransportAssignmentDraft,
} from '@/features/transport-assignments/domain/transportAssignmentDraft';
import type { TransportAssignmentSaveStatus } from '@/features/transport-assignments/hooks/useTransportAssignmentSave';
import { TRANSPORT_COURSE_OPTIONS } from '@/features/today/transport/transportCourse';
import {
  resolveTransportVehicleName,
  type TransportVehicleNameOverrides,
} from '@/features/today/transport/transportVehicleNames';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { normalizeText } from './TransportAssignmentPage.logic';
import { TransportConcurrencyInsightBanner } from './TransportConcurrencyInsightBanner';

type StaffOption = {
  staffId: string;
  label: string;
};

type TransportAssignmentVehicleSectionProps = {
  currentDraft: TransportAssignmentDraft;
  saveStatus: TransportAssignmentSaveStatus;
  userNameById: Map<string, string>;
  staffOptions: StaffOption[];
  pendingAssignByVehicle: Record<string, string>;
  vehicleNameOverrides: TransportVehicleNameOverrides;
  vehicleNameDraftByVehicle: Record<string, string>;
  onVehicleNameDraftChange: (vehicleId: string, nextName: string) => void;
  onVehicleNameCommit: (vehicleId: string, nextNameInput?: string) => void;
  onCourseChange: (vehicleId: string, courseValue: string) => void;
  onDriverChange: (vehicleId: string, staffId: string) => void;
  onAttendantChange: (vehicleId: string, staffId: string) => void;
  onPendingAssignChange: (vehicleId: string, userId: string) => void;
  onAssignUser: (vehicleId: string) => void;
  onRemoveUser: (userId: string) => void;
};

export function TransportAssignmentVehicleSection({
  currentDraft,
  saveStatus,
  userNameById,
  staffOptions,
  pendingAssignByVehicle,
  vehicleNameOverrides,
  vehicleNameDraftByVehicle,
  onVehicleNameDraftChange,
  onVehicleNameCommit,
  onCourseChange,
  onDriverChange,
  onAttendantChange,
  onPendingAssignChange,
  onAssignUser,
  onRemoveUser,
}: TransportAssignmentVehicleSectionProps) {
  return (
    <>
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
            <TransportConcurrencyInsightBanner currentVehicleId={vehicle.vehicleId} />
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <TextField
                size="small"
                label="車両名"
                value={vehicleNameDraftByVehicle[vehicle.vehicleId] ?? resolveTransportVehicleName(vehicle.vehicleId, vehicleNameOverrides)}
                onChange={(event) => onVehicleNameDraftChange(vehicle.vehicleId, event.target.value)}
                onBlur={(event) => onVehicleNameCommit(vehicle.vehicleId, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  const value = (event.target as HTMLInputElement).value;
                  onVehicleNameCommit(vehicle.vehicleId, value);
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
                  onChange={(event) => onCourseChange(vehicle.vehicleId, String(event.target.value))}
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
                  onChange={(event) => onDriverChange(vehicle.vehicleId, String(event.target.value))}
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
                  onChange={(event) => onAttendantChange(vehicle.vehicleId, String(event.target.value))}
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
                        onClick={() => onRemoveUser(userId)}
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
                    onChange={(event) => onPendingAssignChange(vehicle.vehicleId, String(event.target.value))}
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
                  onClick={() => onAssignUser(vehicle.vehicleId)}
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
    </>
  );
}
