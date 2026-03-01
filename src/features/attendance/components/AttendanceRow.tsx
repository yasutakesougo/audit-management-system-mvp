import CheckIcon from '@mui/icons-material/Check';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import { Box, Button, Chip, CircularProgress, IconButton, Typography } from '@mui/material';

import {
    TRANSPORT_METHOD_LABEL,
    resolveToMethod,
    type TransportMethod,
} from '../transportMethod';
import type { AttendanceInputMode } from '../types';

export type AttendanceRowUser = {
  id: string;
  name: string;
  needsTransport?: boolean;
  defaultTransportToMethod?: TransportMethod;
};

export type AttendanceRowVisit = {
  status: '未' | '通所中' | '退所済' | '当日欠席';
  checkInAtText?: string;
  checkOutAtText?: string;
  rangeText?: string;
  transportTo?: boolean;
  transportToMethod?: TransportMethod;
};

export type AttendanceRowProps = {
  user: AttendanceRowUser;
  visit: AttendanceRowVisit;
  inputMode?: AttendanceInputMode;
  tempValue?: number;
  canAbsence: boolean;
  isSaving?: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onAbsence: () => void;
  onOpenTemp?: () => void;
  onDetail: () => void;
};

export function AttendanceRow({
  user,
  visit,
  inputMode = 'normal',
  tempValue,
  canAbsence,
  isSaving = false,
  onCheckIn,
  onCheckOut,
  onAbsence,
  onOpenTemp,
  onDetail,
}: AttendanceRowProps): JSX.Element {
  const isAbsent = visit.status === '当日欠席';
  const isDone = visit.status === '退所済' || Boolean(visit.checkOutAtText);
  const canCheckIn = visit.status === '未' && !visit.checkInAtText;
  const canCheckOut = visit.status === '通所中' && !isDone;
  const savingSpinner = isSaving ? <CircularProgress size={16} sx={{ ml: 0.5 }} /> : null;

  const isRunMode = inputMode === 'checkInRun';
  // In checkInRun mode: check-in already done → show completed state
  const checkInDone = isRunMode && !canCheckIn && (visit.status === '通所中' || isDone);
  // Show temp button only in checkInRun mode for checked-in users
  const showTempAction = isRunMode && !canCheckIn && !isAbsent && onOpenTemp;

  // Secondary action styles for checkInRun mode (disabled + faded)
  const secondarySx = isRunMode
    ? { opacity: 0.35, pointerEvents: 'none' as const }
    : {};

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px, 1.4fr) auto minmax(80px, 0.8fr) auto auto',
        gap: 1,
        alignItems: 'center',
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        opacity: isAbsent ? 0.5 : 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.name}
        </Typography>
        {visit.status === '当日欠席' ? (
          <Chip label="欠席" size="small" variant="outlined" />
        ) : null}
        {tempValue != null ? (
          <Chip
            icon={<ThermostatIcon />}
            label={`${tempValue}℃`}
            size="small"
            color={tempValue >= 37.5 ? 'error' : 'default'}
            variant="outlined"
            data-testid="temp-chip"
          />
        ) : null}
        {(() => {
          const method = resolveToMethod(
            {
              isTransportTarget: user.needsTransport ?? false,
              defaultTransportToMethod: user.defaultTransportToMethod,
            },
            visit.transportTo !== undefined || visit.transportToMethod
              ? {
                  transportTo: visit.transportTo ?? false,
                  transportFrom: false,
                  transportToMethod: visit.transportToMethod,
                }
              : undefined,
          );
          return method !== 'self' ? (
            <Chip
              icon={<DirectionsCarIcon />}
              label={TRANSPORT_METHOD_LABEL[method]}
              size="small"
              variant="outlined"
            />
          ) : null;
        })()}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant={canCheckIn ? 'contained' : 'outlined'}
          disabled={isSaving || !canCheckIn || isAbsent}
          onClick={onCheckIn}
          sx={{
            minHeight: 44,
            minWidth: isRunMode ? 140 : 92,
            fontWeight: 700,
          }}
          startIcon={checkInDone ? <CheckIcon /> : undefined}
        >
          {checkInDone
            ? '通所済'
            : visit.checkInAtText && !canCheckIn
              ? `通所 ${visit.checkInAtText}`
              : '通所'}
          {isSaving && canCheckIn ? savingSpinner : null}
        </Button>

        {showTempAction ? (
          <Button
            variant="outlined"
            size="small"
            onClick={onOpenTemp}
            startIcon={<ThermostatIcon />}
            sx={{ minHeight: 44, fontWeight: 700 }}
          >
            検温
          </Button>
        ) : null}

        <Button
          variant={canCheckOut ? 'contained' : 'outlined'}
          disabled={isSaving || !canCheckOut || isAbsent || isRunMode}
          onClick={onCheckOut}
          sx={{ minHeight: 44, minWidth: 92, fontWeight: 700, ...secondarySx }}
        >
          {visit.checkOutAtText && isDone ? `退所 ${visit.checkOutAtText}` : '退所'}
          {isSaving && canCheckOut ? savingSpinner : null}
        </Button>
      </Box>

      <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'text.secondary' }}>
        {visit.rangeText ?? '—'}
      </Typography>

      <Button
        variant="text"
        color="inherit"
        onClick={onAbsence}
        disabled={isSaving || !canAbsence || isRunMode}
        sx={{ minHeight: 44, minWidth: 64, fontWeight: 700, ...secondarySx }}
      >
        欠席
      </Button>

      <IconButton onClick={onDetail} sx={{ width: 44, height: 44 }}>
        <MoreHorizIcon />
      </IconButton>
    </Box>
  );
}
