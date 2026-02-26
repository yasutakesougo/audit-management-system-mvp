import type { MouseEvent } from 'react';

import type { SchedItem, DateRange } from '../data';
import type { ScheduleCategory } from '../domain/types';
import WeekView from '../routes/WeekView';
import DayView from '../routes/DayView';
import MonthPage from '../routes/MonthPage';
import Loading from '@/ui/components/Loading';

export type ScheduleViewContainerProps = {
  mode: 'day' | 'week' | 'month' | 'org';
  isLoading: boolean;
  items: SchedItem[];

  // Week/Org View props
  weekRange: DateRange;
  onDayClick: (dayIso: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onTimeSlotClick: (dayIso: string, time: string) => void;
  activeDateIso: string;
  onItemSelect: (item: SchedItem) => void;
  highlightId: string | null;

  // Day View props
  activeDayRange: DateRange;
  categoryFilter: 'All' | ScheduleCategory;

  // Common
  compact: boolean;
};

const skeletonStyle: React.CSSProperties = {
  height: 16,
  borderRadius: 8,
  background: 'linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.1) 37%, rgba(0,0,0,0.06) 63%)',
  animation: 'shine 1.4s ease infinite',
};

export function ScheduleViewContainer(props: ScheduleViewContainerProps) {
  const {
    mode,
    isLoading,
    items,
    weekRange,
    onDayClick,
    onTimeSlotClick,
    activeDateIso,
    onItemSelect,
    highlightId,
    activeDayRange,
    categoryFilter,
    compact,
  } = props;

  if (isLoading) {
    return (
      <div aria-busy="true" aria-live="polite" style={{ display: 'grid', gap: 16 }}>
        <Loading />
        <div style={skeletonStyle} />
        <div style={skeletonStyle} />
        <div style={skeletonStyle} />
      </div>
    );
  }

  if (mode === 'week' || mode === 'org') {
    return (
      <WeekView
        items={items}
        loading={isLoading}
        range={weekRange}
        onDayClick={onDayClick}
        onTimeSlotClick={onTimeSlotClick}
        activeDateIso={activeDateIso}
        onItemSelect={onItemSelect}
        highlightId={highlightId}
        compact={compact}
      />
    );
  }

  if (mode === 'day') {
    return (
      <DayView
        items={items}
        loading={isLoading}
        range={activeDayRange}
        categoryFilter={categoryFilter}
        emptyCtaLabel={categoryFilter === 'Org' ? '施設予定を追加' : '予定を追加'}
        compact={compact}
      />
    );
  }

  if (mode === 'month') {
    return (
      <MonthPage
        items={items}
        loading={isLoading}
        activeCategory={categoryFilter}
        compact={compact}
      />
    );
  }

  return null;
}
