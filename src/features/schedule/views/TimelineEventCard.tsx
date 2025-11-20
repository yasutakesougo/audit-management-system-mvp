import { AllDayChip } from '@/features/schedule/AllDayChip';
import { RecurrenceChip } from '@/ui/components/RecurrenceChip';
import { formatScheduleRange } from '@/utils/formatScheduleTime';
import { resolveSchedulesTz } from '@/utils/scheduleTz';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import type { ChipProps } from '@mui/material/Chip';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Paper, { type PaperProps } from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { memo, useMemo, type HTMLAttributes } from 'react';
import type { SystemStyleObject } from '@mui/system';
import { getScheduleColorTokens, type ScheduleColorSource } from '../serviceColors';
import type { BaseShiftWarning, DayPart, Status } from '../types';
import { summarizeBaseShiftWarnings } from '../workPattern';

type DataAttributes = Partial<Record<`data-${string}`, string | number | boolean | undefined>>;

type Props = {
  title: string;
  startISO: string;
  endISO: string;
  allDay?: boolean;
  status?: Status;
  recurrenceRule?: string | null;
  subtitle?: string;
  serviceLabel?: string;
  dayPart?: DayPart;
  colorSource?: ScheduleColorSource;
  baseShiftWarnings?: BaseShiftWarning[];
  containerProps?: PaperProps & HTMLAttributes<HTMLDivElement> & DataAttributes;
};

const statusTones: Record<NonNullable<Props['status']>, Pick<ChipProps, 'color' | 'variant' | 'size'>> = {
  下書き: { color: 'default', variant: 'outlined', size: 'small' },
  申請中: { color: 'warning', variant: 'outlined', size: 'small' },
  承認済み: { color: 'success', variant: 'outlined', size: 'small' },
  完了: { color: 'success', variant: 'outlined', size: 'small' },
};

const TimelineEventCard = memo(function TimelineEventCard({
  title,
  startISO,
  endISO,
  allDay,
  status,
  recurrenceRule,
  subtitle,
  serviceLabel,
  dayPart,
  colorSource,
  baseShiftWarnings,
  containerProps,
}: Props) {
  const theme = useTheme();
  const halfDay = isHalfDay(dayPart);
  const showAllDay = allDay && !halfDay;
  const warningsSummary = useMemo(() => {
    if (!baseShiftWarnings?.length) {
      return '';
    }
    return summarizeBaseShiftWarnings(baseShiftWarnings);
  }, [baseShiftWarnings]);
  const hasWarning = warningsSummary.length > 0;
  const scheduleTz = useMemo(() => resolveSchedulesTz(), []);

  const { displayTimeRange, ariaTimeRange } = useMemo(() => {
    if (showAllDay) {
      const suffix = scheduleTz ? ` (${scheduleTz})` : '';
      return { displayTimeRange: '終日', ariaTimeRange: `終日${suffix}` };
    }

    const range = formatScheduleRange(startISO, endISO, scheduleTz);
    const display = range.valid && range.tz ? `${range.text} (${range.tz})` : range.text;

    return {
      displayTimeRange: display,
      ariaTimeRange: range.aria,
    };
  }, [showAllDay, startISO, endISO, scheduleTz]);

  const aria = useMemo(() => {
    const segments = [
      `件名 ${title}`,
      subtitle ? `補足 ${subtitle}` : '',
      halfDay ? `区分 ${halfDayLabel(dayPart)}` : '',
      `時間 ${ariaTimeRange}`,
      status ? `状態 ${status}` : '',
      recurrenceRule ? '繰り返しあり' : '',
      hasWarning && warningsSummary ? `注意 ${warningsSummary}` : '',
    ].filter(Boolean);
    return segments.join('、');
  }, [title, subtitle, halfDay, dayPart, ariaTimeRange, status, recurrenceRule, hasWarning, warningsSummary]);

  const derivedColorSource = useMemo<ScheduleColorSource>(() => {
    if (colorSource) return colorSource;
    if (serviceLabel) {
      return { serviceType: serviceLabel, title };
    }
    return { title };
  }, [colorSource, serviceLabel, title]);
  const colorTokens = getScheduleColorTokens(theme, derivedColorSource);
  const hoverSurface = alpha(colorTokens.accent, theme.palette.mode === 'dark' ? 0.35 : 0.18);

  const {
    component: containerComponent = 'article',
    sx: containerSx,
    elevation: containerElevation,
    tabIndex,
    title: titleProp,
    ...restContainerProps
  } = containerProps ?? {};
  const ariaLabelProp = (containerProps as { ['aria-label']?: string } | undefined)?.['aria-label'];
  const dataTestIdProp = (containerProps as { ['data-testid']?: string } | undefined)?.['data-testid'];
  const baseSx: SxProps<Theme> = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 2,
    border: '1px solid',
    borderColor: hasWarning ? alpha(theme.palette.warning.main, 0.45) : colorTokens.border,
    backgroundColor: hasWarning ? alpha(theme.palette.warning.light, 0.2) : colorTokens.bg,
    boxShadow: hasWarning ? `0 0 0 1px ${alpha(theme.palette.warning.main, 0.35)}` : '0 1px 2px rgba(15, 23, 42, 0.14)',
    padding: theme.spacing(1.25, 1.5),
    cursor: 'pointer',
    transition: 'background-color 120ms ease, box-shadow 150ms ease, transform 120ms ease',
    color: theme.palette.text.primary,
    '&:hover': {
      backgroundColor: hasWarning ? alpha(theme.palette.warning.light, 0.35) : hoverSurface,
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
    },
    '&:focus-visible': {
      outline: `2px solid ${colorTokens.accent}`,
      outlineOffset: 2,
    },
  };
  const mergedSx: SxProps<Theme> = mergeSx(baseSx, containerSx);

  return (
    <Paper
      {...restContainerProps}
      component={containerComponent}
      elevation={containerElevation ?? (hasWarning ? 3 : 1)}
      data-testid={dataTestIdProp ?? 'schedule-item'}
      tabIndex={tabIndex ?? 0}
      aria-label={ariaLabelProp ?? aria}
      title={titleProp ?? ariaTimeRange}
      sx={mergedSx}
    >
      {hasWarning ? (
        <Box
          aria-hidden="true"
          data-testid="schedule-warning-indicator"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.warning.main,
            color: theme.palette.getContrastText(theme.palette.warning.main),
            boxShadow: 2,
          }}
        >
          <AccessTimeRoundedIcon fontSize="inherit" sx={{ fontSize: 18 }} />
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 4,
            borderRadius: 999,
            backgroundColor: hasWarning ? theme.palette.warning.main : colorTokens.accent,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ color: hasWarning ? theme.palette.warning.main : theme.palette.text.primary }}
              >
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary" noWrap>
                  {subtitle}
                </Typography>
              ) : null}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0.75 }}>
              {halfDay ? <InlineTag label={halfDayLabel(dayPart)} ariaLabel={`半休 ${halfDayLabel(dayPart)}`} /> : null}
              {showAllDay ? <AllDayChip /> : null}
              {recurrenceRule ? <RecurrenceChip meta={{ rrule: recurrenceRule }} /> : null}
              {status ? (
                <Chip
                  data-testid="schedule-status"
                  data-status-chip="true"
                  data-status={status}
                  label={status}
                  {...statusTones[status]}
                  aria-label={`状態 ${status}`}
                />
              ) : null}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {displayTimeRange}
            </Typography>
            {serviceLabel ? (
              <Box
                component="span"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 999,
                  fontSize: (theme) => theme.typography.caption.fontSize,
                  fontWeight: 600,
                  backgroundColor: colorTokens.pillBg,
                  color: colorTokens.pillText,
                  whiteSpace: 'nowrap',
                }}
              >
                {serviceLabel}
              </Box>
            ) : null}
          </Box>
          {hasWarning ? (
            <Typography variant="caption" color="warning.dark" fontWeight={600} sx={{ mt: 0.5 }}>
              基本勤務パターン外: {warningsSummary}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Paper>
  );
});

TimelineEventCard.displayName = 'TimelineEventCard';

export default TimelineEventCard;

const halfDayLabel = (dayPart: DayPart | undefined) => {
  switch (dayPart) {
    case 'AM':
      return '午前休';
    case 'PM':
      return '午後休';
    default:
      return '半休';
  }
};

const isHalfDay = (dayPart: DayPart | undefined): dayPart is Exclude<DayPart, 'Full'> => dayPart === 'AM' || dayPart === 'PM';

function InlineTag({ label, ariaLabel }: { label: string; ariaLabel?: string }) {
  return (
    <Box
      component="span"
      role="status"
      aria-label={ariaLabel ?? label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: '1px solid',
        borderColor: 'warning.light',
        backgroundColor: (theme) => alpha(theme.palette.warning.light, 0.2),
        color: 'warning.dark',
        fontSize: '0.65rem',
        fontWeight: 600,
        px: 1,
        py: 0.25,
      }}
    >
      {label}
    </Box>
  );
}

function resolveSx(theme: Theme, sx: SxProps<Theme> | null | undefined): SystemStyleObject<Theme> {
  if (!sx) return {};
  if (Array.isArray(sx)) {
    return sx.reduce<SystemStyleObject<Theme>>((acc, item) => ({
      ...acc,
      ...resolveSx(theme, item),
    }), {});
  }
  if (typeof sx === 'function') {
    return resolveSx(theme, sx(theme));
  }
  return sx as SystemStyleObject<Theme>;
}

function mergeSx(base: SxProps<Theme>, extra?: SxProps<Theme>): SxProps<Theme> {
  if (!extra) return base;
  return (theme) => ({
    ...resolveSx(theme, base),
    ...resolveSx(theme, extra),
  });
}
