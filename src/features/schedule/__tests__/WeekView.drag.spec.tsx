import type { Schedule } from '@/lib/mappers';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeekView } from '../WeekView';

vi.mock('@/hydration/features', () => ({
  HYDRATION_FEATURES: { schedules: { recompute: 'recompute' } },
  estimatePayloadSize: () => 0,
  startFeatureSpan: () => () => {},
}));

vi.mock('@/features/schedule/components/ScheduleConflictGuideDialog', () => ({
  ScheduleConflictGuideDialog: () => <div data-testid="conflict-dialog" />,
}));

vi.mock('@/features/schedule/conflictChecker', () => ({
  hasConflict: () => false,
}));

describe('WeekView drag + drop', () => {
  const buildSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
    id: overrides.id ?? 1,
    etag: overrides.etag ?? 'etag-1',
    title: overrides.title ?? 'Drag Event',
    startUtc: overrides.startUtc ?? '2025-01-06T00:00:00.000Z',
    endUtc: overrides.endUtc ?? '2025-01-06T01:30:00.000Z',
    startLocal: overrides.startLocal ?? '2025-01-06T09:00:00',
    endLocal: overrides.endLocal ?? '2025-01-06T10:30:00',
    startDate: overrides.startDate ?? '2025-01-06',
    endDate: overrides.endDate ?? '2025-01-06',
    allDay: overrides.allDay ?? false,
    location: overrides.location ?? null,
    staffId: overrides.staffId ?? null,
    userId: overrides.userId ?? 1,
    status: overrides.status ?? 'draft',
    notes: overrides.notes ?? null,
    recurrenceRaw: overrides.recurrenceRaw ?? null,
    recurrence: overrides.recurrence,
    created: overrides.created ?? undefined,
    modified: overrides.modified ?? undefined,
    category: overrides.category ?? 'User',
    serviceType: overrides.serviceType ?? '通常利用',
    personType: overrides.personType ?? 'Internal',
    personId: overrides.personId ?? 'user-1',
    personName: overrides.personName ?? '利用者 一郎',
    staffIds: overrides.staffIds ?? [],
    staffNames: overrides.staffNames ?? [],
    dayPart: overrides.dayPart ?? null,
    billingFlags: overrides.billingFlags ?? [],
    targetUserIds: overrides.targetUserIds ?? [],
    targetUserNames: overrides.targetUserNames ?? [],
    relatedResourceIds: overrides.relatedResourceIds ?? [],
    relatedResourceNames: overrides.relatedResourceNames ?? [],
    rowKey: overrides.rowKey ?? null,
    dayKey: overrides.dayKey ?? '2025-01-06',
    monthKey: overrides.monthKey ?? '2025-01',
    createdAt: overrides.createdAt ?? null,
    updatedAt: overrides.updatedAt ?? null,
    assignedStaffIds: overrides.assignedStaffIds ?? [],
    assignedStaffNames: overrides.assignedStaffNames ?? [],
  });

  it('emits drag-end payload with preserved duration', () => {
    const dragEnd = vi.fn();
    const schedule = buildSchedule();

    render(
      <WeekView
        weekStart={new Date('2025-01-06T00:00:00.000Z')}
        schedules={[schedule]}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
        onEventDragEnd={dragEnd}
      />,
    );

    const eventWrapper = screen.getAllByTestId('schedule-item')[0];
    const eventButton = within(eventWrapper).getByRole('button');

    fireEvent.dragStart(eventButton);

    const targetSlot = screen.getByLabelText('1月7日 11:00 から 11:30 の枠');
    fireEvent.dragEnter(targetSlot);
    fireEvent.dragOver(targetSlot);
    fireEvent.drop(targetSlot);
    fireEvent.dragEnd(eventButton);

    expect(dragEnd).toHaveBeenCalledTimes(1);
    const [payloadSchedule, range] = dragEnd.mock.calls[0];
    expect(payloadSchedule.id).toBe(schedule.id);
    expect(range.start.toISOString()).toBe('2025-01-07T11:00:00.000Z');
    expect(range.end.toISOString()).toBe('2025-01-07T12:30:00.000Z');
  });
});
