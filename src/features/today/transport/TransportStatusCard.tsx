/**
 * TransportStatusCard — Bento Grid widget for /today
 *
 * Phase 3 of Issue #635.
 *
 * Displays transport status for a single direction (to/from) with:
 * - Direction tabs with auto-switch at 13:00
 * - Progress bar (arrived / total)
 * - Scrollable list of transport legs
 * - One-tap action buttons (48x48px touch targets)
 * - Overdue highlight for delayed users
 * - Separate section for self-transport users
 *
 * All state management is delegated to useTransportStatus hook.
 */

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from '@mui/material';
import React from 'react';
import {
    DIRECTION_EMOJI,
    DIRECTION_LABEL,
    STATUS_COLOR,
    STATUS_LABEL,
    isTerminalStatus,
    type TransportDirection,
    type TransportDirectionSummary,
    type TransportLeg,
    type TransportLegStatus,
} from './transportTypes';

// ─── Props ──────────────────────────────────────────────────────────────────

export type TransportStatusCardProps = {
  /** All legs for today (both directions) */
  legs: TransportLeg[];
  /** Summary for 'to' direction */
  toSummary: TransportDirectionSummary;
  /** Summary for 'from' direction */
  fromSummary: TransportDirectionSummary;
  /** Currently active direction tab */
  activeDirection: TransportDirection;
  /** Switch direction tab */
  onDirectionChange: (dir: TransportDirection) => void;
  /** Transition a leg to next status */
  onTransition: (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus) => void;
  /** Current time HH:mm (for display) */
  currentTime: string;
};

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Progress header showing arrived/total ratio */
function DirectionProgress({ summary }: { summary: TransportDirectionSummary }) {
  const progress = summary.total > 0 ? (summary.arrived / summary.total) * 100 : 0;
  const isComplete = summary.total > 0 && summary.arrived === summary.total;

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="body2" fontWeight="bold" color="text.secondary">
          到着状況
        </Typography>
        <Typography
          variant="body2"
          fontWeight="bold"
          color={isComplete ? 'success.main' : 'primary.main'}
        >
          {summary.arrived} / {summary.total} 名
          {isComplete && ' ✅'}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'grey.200',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            bgcolor: isComplete ? 'success.main' : 'primary.main',
            transition: 'width 0.4s ease-in-out',
          },
        }}
      />
      {summary.overdueUserIds.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
          <WarningAmberIcon sx={{ fontSize: 14, color: 'error.main' }} />
          <Typography variant="caption" color="error.main" fontWeight="bold">
            {summary.overdueUserIds.length}名が予定時刻を超過
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

/** Single transport leg row */
const TransportLegRow = React.memo(function TransportLegRow({
  leg,
  isOverdue,
  onTransition,
}: {
  leg: TransportLeg;
  isOverdue: boolean;
  onTransition: (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus) => void;
}) {
  const isSelf = leg.status === 'self';
  const isTerminal = isTerminalStatus(leg.status);

  return (
    <Box
      data-testid={`transport-leg-${leg.userId}-${leg.direction}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 2,
        borderRadius: 1,
        bgcolor: isOverdue ? 'error.50' : 'transparent',
        borderLeft: isOverdue ? '3px solid' : 'none',
        borderColor: isOverdue ? 'error.main' : 'transparent',
        transition: 'background-color 0.3s ease',
        '&:hover': {
          bgcolor: isOverdue ? 'error.100' : 'action.hover',
        },
      }}
    >
      {/* Avatar with status color */}
      <Avatar
        sx={{
          width: 36,
          height: 36,
          fontSize: '0.85rem',
          bgcolor: STATUS_COLOR[leg.status],
          opacity: isSelf ? 0.5 : 1,
        }}
      >
        {leg.userName.slice(0, 1)}
      </Avatar>

      {/* Name + time info */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight="bold"
          noWrap
          sx={{
            textDecoration: leg.status === 'absent' ? 'line-through' : 'none',
            opacity: isSelf ? 0.6 : 1,
          }}
        >
          {leg.userName}
          {isOverdue && (
            <WarningAmberIcon
              sx={{ fontSize: 14, color: 'error.main', ml: 0.5, verticalAlign: 'middle' }}
            />
          )}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {leg.scheduledTime && (
            <Typography variant="caption" color="text.secondary">
              {leg.scheduledTime} 予定
            </Typography>
          )}
          {leg.actualTime && (
            <Typography variant="caption" color="success.main" fontWeight="bold">
              {leg.actualTime} 到着
            </Typography>
          )}
        </Stack>
      </Box>

      {/* Status chip */}
      <Chip
        label={STATUS_LABEL[leg.status]}
        size="small"
        sx={{
          bgcolor: STATUS_COLOR[leg.status],
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '0.7rem',
          height: 24,
          minWidth: 56,
        }}
      />

      {/* Action buttons (touch-friendly: 48x48) */}
      {!isTerminal && leg.status === 'pending' && (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="出発">
            <IconButton
              data-testid={`transport-depart-${leg.userId}`}
              onClick={() => onTransition(leg.userId, leg.direction, 'in-progress')}
              color="primary"
              sx={{
                width: 44,
                height: 44,
                border: '2px solid',
                borderColor: 'primary.main',
                '&:active': { transform: 'scale(0.95)' },
              }}
            >
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="欠席">
            <IconButton
              data-testid={`transport-absent-${leg.userId}`}
              onClick={() => onTransition(leg.userId, leg.direction, 'absent')}
              color="error"
              sx={{
                width: 44,
                height: 44,
                border: '1px solid',
                borderColor: 'error.light',
                opacity: 0.7,
                '&:active': { transform: 'scale(0.95)' },
              }}
            >
              <PersonOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {!isTerminal && leg.status === 'in-progress' && (
        <Button
          data-testid={`transport-arrive-${leg.userId}`}
          variant="contained"
          color="success"
          size="small"
          startIcon={<CheckCircleOutlineIcon />}
          onClick={() => onTransition(leg.userId, leg.direction, 'arrived')}
          sx={{
            minWidth: 80,
            minHeight: 44,
            fontWeight: 'bold',
            borderRadius: 2,
            textTransform: 'none',
            boxShadow: 2,
            '&:active': { transform: 'scale(0.97)' },
          }}
        >
          到着
        </Button>
      )}
    </Box>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

export function TransportStatusCard({
  legs,
  toSummary,
  fromSummary,
  activeDirection,
  onDirectionChange,
  onTransition,
  currentTime,
}: TransportStatusCardProps) {
  const activeSummary = activeDirection === 'to' ? toSummary : fromSummary;
  const activeLegs = legs.filter((l) => l.direction === activeDirection);

  // Separate: trackable (shuttle etc.) vs self-transport
  const trackableLegs = activeLegs.filter((l) => l.status !== 'self');
  const selfLegs = activeLegs.filter((l) => l.status === 'self');

  // Sort: overdue first, then pending, then in-progress, then arrived/absent
  const statusOrder: Record<TransportLegStatus, number> = {
    'pending': 1,
    'in-progress': 2,
    'arrived': 3,
    'absent': 4,
    'self': 5,
  };

  const sortedLegs = [...trackableLegs].sort((a, b) => {
    const aOverdue = activeSummary.overdueUserIds.includes(a.userId) ? 0 : 1;
    const bOverdue = activeSummary.overdueUserIds.includes(b.userId) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <Card
      data-testid="transport-status-card"
      elevation={2}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <DirectionsBusIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" fontWeight="bold">
            送迎状況
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {currentTime} 現在
        </Typography>
      </Box>

      {/* Direction Tabs */}
      <Tabs
        value={activeDirection === 'to' ? 0 : 1}
        onChange={(_, v) => onDirectionChange(v === 0 ? 'to' : 'from')}
        data-testid="transport-direction-tabs"
        variant="fullWidth"
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            fontWeight: 'bold',
            textTransform: 'none',
            fontSize: '0.85rem',
          },
        }}
      >
        <Tab
          label={`${DIRECTION_EMOJI.to} ${DIRECTION_LABEL.to} (${toSummary.arrived}/${toSummary.total})`}
          data-testid="transport-tab-to"
        />
        <Tab
          label={`${DIRECTION_EMOJI.from} ${DIRECTION_LABEL.from} (${fromSummary.arrived}/${fromSummary.total})`}
          data-testid="transport-tab-from"
        />
      </Tabs>

      <Divider />

      {/* Progress */}
      <DirectionProgress summary={activeSummary} />

      <Divider />

      {/* Leg List */}
      <CardContent
        sx={{
          p: 0,
          maxHeight: 320,
          overflowY: 'auto',
          '&:last-child': { pb: 0 },
        }}
      >
        {sortedLegs.length === 0 && selfLegs.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              送迎対象ユーザーがいません
            </Typography>
          </Box>
        )}

        {/* Trackable users (shuttle, guide_helper, family, etc.) */}
        {sortedLegs.map((leg) => (
          <TransportLegRow
            key={`${leg.userId}-${leg.direction}`}
            leg={leg}
            isOverdue={activeSummary.overdueUserIds.includes(leg.userId)}
            onTransition={onTransition}
          />
        ))}

        {/* Self-transport section */}
        {selfLegs.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ px: 2, py: 0.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                ⚪ 自力通所 ({selfLegs.length}名)
              </Typography>
            </Box>
            {selfLegs.map((leg) => (
              <TransportLegRow
                key={`${leg.userId}-${leg.direction}`}
                leg={leg}
                isOverdue={false}
                onTransition={onTransition}
              />
            ))}
          </>
        )}
      </CardContent>

      {/* Footer: stats summary */}
      <Divider />
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: 'grey.50',
          display: 'flex',
          justifyContent: 'space-around',
        }}
      >
        <Chip
          label={`待機 ${activeSummary.pending}`}
          size="small"
          variant="outlined"
          sx={{ borderColor: STATUS_COLOR.pending, color: STATUS_COLOR.pending }}
        />
        <Chip
          label={`移動中 ${activeSummary.inProgress}`}
          size="small"
          variant="outlined"
          sx={{ borderColor: STATUS_COLOR['in-progress'], color: STATUS_COLOR['in-progress'] }}
        />
        <Chip
          label={`到着 ${activeSummary.arrived}`}
          size="small"
          variant="outlined"
          sx={{ borderColor: STATUS_COLOR.arrived, color: STATUS_COLOR.arrived }}
        />
        {activeSummary.absent > 0 && (
          <Chip
            label={`欠席 ${activeSummary.absent}`}
            size="small"
            variant="outlined"
            sx={{ borderColor: STATUS_COLOR.absent, color: STATUS_COLOR.absent }}
          />
        )}
      </Box>
    </Card>
  );
}
