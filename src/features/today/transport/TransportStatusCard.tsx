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

import { motionTokens } from '@/app/theme';
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
    keyframes,
} from '@mui/material';
import React, { useEffect, useRef } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
import {
  buildVehicleBoardGroups,
  DEFAULT_TRANSPORT_VEHICLE_IDS,
  hasMissingVehicleCourse,
  hasMissingVehicleDriver,
} from './transportAssignments';
import { TRANSPORT_COURSE_OPTIONS, type TransportCourse } from './transportCourse';

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
  /** ExceptionCenter からのハイライト対象ユーザーID */
  highlightUserId?: string | null;
};

// ─── Highlight animation ─────────────────────────────────────────────────────

const highlightPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.4); }
  50% { box-shadow: 0 0 8px 4px rgba(25, 118, 210, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(25, 118, 210, 0); }
`;

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
            transition: `width ${motionTokens.duration.slow} ${motionTokens.easing.smooth}`,
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

function VehicleAssignmentBoard({ legs }: { legs: TransportLeg[] }) {
  const groups = buildVehicleBoardGroups(legs, DEFAULT_TRANSPORT_VEHICLE_IDS);
  const totalRiders = groups.reduce((sum, group) => sum + group.riders.length, 0);
  const courseSummary = groups.reduce(
    (acc, group) => {
      const riderCount = group.riders.length;
      if (riderCount === 0) return acc;

      if (group.courseId) {
        acc[group.courseId] += riderCount;
      } else {
        acc.unset += riderCount;
      }
      return acc;
    },
    {
      isogo: 0,
      kan2: 0,
      kanazawa: 0,
      unset: 0,
    } satisfies Record<TransportCourse, number> & { unset: number },
  );
  const hasCourseSummary =
    courseSummary.isogo > 0 || courseSummary.kan2 > 0 || courseSummary.kanazawa > 0 || courseSummary.unset > 0;

  const resolveCourseChipColor = (courseId: TransportCourse | null): 'success' | 'secondary' | 'info' | 'default' => {
    if (courseId === 'isogo') return 'success';
    if (courseId === 'kan2') return 'secondary';
    if (courseId === 'kanazawa') return 'info';
    return 'default';
  };

  return (
    <Box data-testid="transport-vehicle-board" sx={{ px: 2, py: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight="bold" color="text.secondary">
          車両別配車
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {groups.length} 台 / 乗車 {totalRiders} 名
        </Typography>
      </Stack>
      {hasCourseSummary ? (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          sx={{ mb: 1 }}
          data-testid="transport-course-summary"
        >
          {TRANSPORT_COURSE_OPTIONS.map((course) =>
            courseSummary[course.value] > 0 ? (
              <Chip
                key={course.value}
                label={`${course.label} ${courseSummary[course.value]}名`}
                size="small"
                color={resolveCourseChipColor(course.value)}
                variant="outlined"
                data-testid={`transport-course-summary-${course.value}`}
                sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
              />
            ) : null,
          )}
          {courseSummary.unset > 0 ? (
            <Chip
              label={`コース未設定 ${courseSummary.unset}名`}
              size="small"
              color="warning"
              variant="outlined"
              data-testid="transport-course-summary-unset"
              sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
            />
          ) : null}
        </Stack>
      ) : null}

      <Stack spacing={1}>
        {groups.map((group, index) => {
          const missingDriver = hasMissingVehicleDriver(group);
          const missingCourse = hasMissingVehicleCourse(group);
          const needsAttention = missingDriver || missingCourse;
          const hasAttendant = Boolean(group.attendantName);
          const crewModeLabel = hasAttendant ? '2名体制' : '1名体制';
          return (
            <Box
              key={group.vehicleId}
              data-testid={`transport-vehicle-row-${index}`}
              sx={{
                p: 1,
                borderRadius: 1,
                bgcolor: needsAttention ? 'warning.50' : 'grey.50',
                border: '1px solid',
                borderColor: needsAttention ? 'warning.main' : 'divider',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                <Typography variant="caption" fontWeight="bold">
                  🚗 {group.vehicleId}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {group.courseLabel ? (
                    <Chip
                      label={group.courseLabel}
                      size="small"
                      color={resolveCourseChipColor(group.courseId)}
                      variant="outlined"
                      data-testid={`transport-vehicle-course-${index}`}
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                    />
                  ) : null}
                  {missingCourse ? (
                    <Chip
                      label="コース未設定"
                      size="small"
                      color="warning"
                      variant="outlined"
                      data-testid={`transport-vehicle-course-warning-${index}`}
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                    />
                  ) : null}
                  <Typography variant="caption" color={group.driverName ? 'text.primary' : 'warning.main'}>
                    運転: {group.driverName ?? '未設定'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    添乗: {group.attendantName ?? 'なし'}
                  </Typography>
                  {group.riders.length > 0 && (
                    <Chip
                      label={crewModeLabel}
                      size="small"
                      color={hasAttendant ? 'primary' : 'default'}
                      variant={hasAttendant ? 'filled' : 'outlined'}
                      data-testid={`transport-vehicle-crew-mode-${index}`}
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                    />
                  )}
                  {needsAttention && (
                    <Stack direction="row" spacing={0.25} alignItems="center" data-testid={`transport-vehicle-warning-${index}`}>
                      <WarningAmberIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      <Typography variant="caption" color="warning.main" fontWeight="bold">
                        要確認
                      </Typography>
                    </Stack>
                  )}
                  {group.riders.length === 0 && (
                    <Chip
                      label="空車"
                      size="small"
                      color="default"
                      variant="outlined"
                      sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                    />
                  )}
                </Stack>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {group.riders.length > 0
                  ? `乗車 (${group.riders.length}名): ${group.riders.map((leg) => leg.userName).join(' / ')}`
                  : '乗車: 0名'}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

/** Single transport leg row */
const TransportLegRow = React.memo(function TransportLegRow({
  leg,
  isOverdue,
  isHighlighted,
  onTransition,
}: {
  leg: TransportLeg;
  isOverdue: boolean;
  isHighlighted?: boolean;
  onTransition: (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  // ハイライト対象なら自動スクロール
  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);
  const isSelf = leg.status === 'self';
  const isTerminal = isTerminalStatus(leg.status);

  return (
    <Box
      ref={rowRef}
      data-testid={`transport-leg-${leg.userId}-${leg.direction}`}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 2,
        borderRadius: 1,
        bgcolor: isHighlighted
          ? 'rgba(25, 118, 210, 0.08)'
          : isOverdue
            ? 'error.50'
            : 'transparent',
        borderLeft: isHighlighted
          ? '3px solid'
          : isOverdue
            ? '3px solid'
            : 'none',
        borderColor: isHighlighted
          ? 'primary.main'
          : isOverdue
            ? 'error.main'
            : 'transparent',
        animation: isHighlighted
          ? `${highlightPulse} 1.5s ease-in-out 3`
          : 'none',
        transition: motionTokens.transition.bgColorSlow,
        '&:hover': {
          bgcolor: isHighlighted
            ? 'rgba(25, 118, 210, 0.12)'
            : isOverdue
              ? 'error.100'
              : 'action.hover',
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
  highlightUserId,
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
        <Stack spacing={0.5} alignItems="flex-end">
          <Button
            component={RouterLink}
            to="/transport/assignments"
            size="small"
            variant="outlined"
            data-testid="transport-edit-assignments-link"
            sx={{
              minHeight: 28,
              px: 1.25,
              fontSize: '0.75rem',
              textTransform: 'none',
              lineHeight: 1.2,
            }}
          >
            配車表を編集
          </Button>
          <Typography variant="caption" color="text.secondary">
            {currentTime} 現在
          </Typography>
        </Stack>
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

      {/* Vehicle assignment board */}
      <VehicleAssignmentBoard legs={sortedLegs} />

      {sortedLegs.length > 0 && <Divider />}

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
            isHighlighted={highlightUserId === leg.userId}
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
