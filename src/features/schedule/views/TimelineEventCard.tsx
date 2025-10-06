import { memo, useMemo, type HTMLAttributes } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';
import { AllDayChip } from '@/features/schedule/AllDayChip';
import { RecurrenceChip } from '@/ui/components/RecurrenceChip';
import { cn } from '@/ui/cn';
import type { BaseShiftWarning, DayPart, Status } from '../types';
import { summarizeBaseShiftWarnings } from '../workPattern';

type Props = {
  title: string;
  startISO: string;
  endISO: string;
  allDay?: boolean;
  status?: Status;
  recurrenceRule?: string | null;
  subtitle?: string;
  dayPart?: DayPart;
  baseShiftWarnings?: BaseShiftWarning[];
  containerProps?: HTMLAttributes<HTMLElement>;
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
  dayPart,
  baseShiftWarnings,
  containerProps,
}: Props) {
  const halfDay = isHalfDay(dayPart);
  const showAllDay = allDay && !halfDay;
  const warningsSummary = useMemo(() => {
    if (!baseShiftWarnings?.length) {
      return '';
    }
    return summarizeBaseShiftWarnings(baseShiftWarnings);
  }, [baseShiftWarnings]);
  const hasWarning = warningsSummary.length > 0;

  const timeRange = useMemo(() => {
    if (showAllDay) {
      return '終日';
    }
    return `${hhmm(startISO)}–${hhmm(endISO)}`;
  }, [showAllDay, startISO, endISO]);

  const aria = useMemo(() => {
    const segments = [
      `件名 ${title}`,
      subtitle ? `補足 ${subtitle}` : '',
      halfDay ? `区分 ${halfDayLabel(dayPart)}` : '',
      `時間 ${timeRange}`,
      status ? `状態 ${status}` : '',
      recurrenceRule ? '繰り返しあり' : '',
      hasWarning && warningsSummary ? `注意 ${warningsSummary}` : '',
    ].filter(Boolean);
    return segments.join('、');
  }, [title, subtitle, halfDay, dayPart, timeRange, status, recurrenceRule, hasWarning, warningsSummary]);

  const subtitleLine = subtitle ? `${subtitle} ・ ${timeRange}` : timeRange;

  const { className: containerClassName, style: containerStyle, ...restContainerProps } = containerProps ?? {};

  const className = cn(
    'relative overflow-hidden rounded-xl border p-2 shadow-sm outline-none transition',
    'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
    hasWarning ? 'border-amber-300 bg-amber-50/90' : 'border-slate-200 bg-white/95',
    containerClassName
  );

  const mergedStyle = hasWarning
    ? {
        ...containerStyle,
        backgroundImage:
          'repeating-linear-gradient(135deg, rgba(251, 191, 36, 0.18) 0, rgba(251, 191, 36, 0.18) 6px, transparent 6px, transparent 12px)',
        backgroundSize: '12px 12px',
      }
    : containerStyle;

  return (
    <article
      {...restContainerProps}
      tabIndex={restContainerProps.tabIndex ?? 0}
      aria-label={(restContainerProps['aria-label'] as string | undefined) ?? aria}
      className={className}
      style={mergedStyle}
    >
      {hasWarning ? (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm"
        >
          <AccessTimeRoundedIcon fontSize="inherit" className="!text-[18px]" />
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
          <div className="truncate text-xs text-slate-600">{subtitleLine}</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
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
        </div>
      </div>
      {hasWarning ? (
        <p className="mt-2 text-xs font-medium text-amber-700">基本勤務パターン外: {warningsSummary}</p>
      ) : null}
    </article>
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
    <span
      role="status"
      aria-label={ariaLabel ?? label}
      className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700"
    >
      {label}
    </span>
  );
}

function hhmm(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
