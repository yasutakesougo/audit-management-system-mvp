import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import { Box, Button, Chip, IconButton, Typography } from '@mui/material';
import React from 'react';

export type AttendanceRowUser = {
  id: string;
  name: string;
  needsTransport?: boolean;
};

export type AttendanceRowVisit = {
  status: '未' | '通所中' | '退所済' | '当日欠席';
  checkInAtText?: string;
  checkOutAtText?: string;
  rangeText?: string;
};

export type AttendanceRowProps = {
  user: AttendanceRowUser;
  visit: AttendanceRowVisit;
  canAbsence: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onAbsence: () => void;
  onDetail: () => void;
};

export function AttendanceRow({
  user,
  visit,
  canAbsence,
  onCheckIn,
  onCheckOut,
  onAbsence,
  onDetail,
}: AttendanceRowProps): JSX.Element {
  const isAbsent = visit.status === '当日欠席';
  const isDone = visit.status === '退所済' || Boolean(visit.checkOutAtText);
  const canCheckIn = visit.status === '未' && !visit.checkInAtText;
  const canCheckOut = visit.status === '通所中' && !isDone;

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
        {user.needsTransport ? (
          <Chip icon={<DirectionsCarIcon />} label="送迎" size="small" variant="outlined" />
        ) : null}
      </Box>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant={canCheckIn ? 'contained' : 'outlined'}
          disabled={!canCheckIn || isAbsent}
          onClick={onCheckIn}
          sx={{ minHeight: 44, minWidth: 92, fontWeight: 700 }}
        >
          {visit.checkInAtText && !canCheckIn ? `通所 ${visit.checkInAtText}` : '通所'}
        </Button>

        <Button
          variant={canCheckOut ? 'contained' : 'outlined'}
          disabled={!canCheckOut || isAbsent}
          onClick={onCheckOut}
          sx={{ minHeight: 44, minWidth: 92, fontWeight: 700 }}
        >
          {visit.checkOutAtText && isDone ? `退所 ${visit.checkOutAtText}` : '退所'}
        </Button>
      </Box>

      <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'text.secondary' }}>
        {visit.rangeText ?? '—'}
      </Typography>

      <Button
        variant="text"
        color="inherit"
        onClick={onAbsence}
        disabled={!canAbsence}
        sx={{ minHeight: 44, minWidth: 64, fontWeight: 700 }}
      >
        欠席
      </Button>

      <IconButton onClick={onDetail} sx={{ width: 44, height: 44 }}>
        <MoreHorizIcon />
      </IconButton>
    </Box>
  );
}
