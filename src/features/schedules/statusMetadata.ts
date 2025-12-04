import type { ScheduleStatus } from './data';

export const SCHEDULE_STATUS_OPTIONS: Array<{ value: ScheduleStatus; label: string }> = [
  { value: 'Planned', label: '予定どおり' },
  { value: 'Postponed', label: '延期' },
  { value: 'Cancelled', label: '中止' },
];

type StatusMeta = {
  label: string;
  chipBg: string;
  chipColor: string;
  dotColor: string;
  opacity: number;
  isDisabled?: boolean;
};

const STATUS_META: { [K in ScheduleStatus]: StatusMeta } = {
  Planned: {
    label: '予定どおり',
    chipBg: 'rgba(76, 175, 80, 0.12)',
    chipColor: 'rgba(27, 94, 32, 0.95)',
    dotColor: 'rgba(76,175,80,0.9)',
    opacity: 1,
  },
  Postponed: {
    label: '延期',
    chipBg: 'rgba(255, 183, 77, 0.2)',
    chipColor: 'rgba(230, 81, 0, 0.95)',
    dotColor: 'rgba(255,152,0,0.9)',
    opacity: 1,
  },
  Cancelled: {
    label: '中止',
    chipBg: 'rgba(239, 154, 154, 0.25)',
    chipColor: 'rgba(183, 28, 28, 0.95)',
    dotColor: 'rgba(198,40,40,0.9)',
    opacity: 0.55,
    isDisabled: true,
  },
};

export const getScheduleStatusMeta = (status?: ScheduleStatus | null): StatusMeta => {
  const key: ScheduleStatus = status ?? 'Planned';
  return STATUS_META[key];
};

export const getScheduleStatusLabel = (status?: ScheduleStatus | null): string | undefined => {
  const meta = getScheduleStatusMeta(status);
  return meta?.label;
};
