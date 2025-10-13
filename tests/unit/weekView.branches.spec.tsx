import WeekView, { getWeekRange } from '@/features/schedule/WeekView';
import type { Schedule } from '@/lib/mappers';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const buildSchedule = (overrides: Partial<Schedule> = {}): Schedule => ({
  id: overrides.id ?? 1,
  etag: null,
  title: overrides.title ?? '予定',
  startUtc: overrides.startUtc ?? null,
  endUtc: overrides.endUtc ?? null,
  startLocal: overrides.startLocal ?? null,
  endLocal: overrides.endLocal ?? null,
  startDate: overrides.startDate ?? null,
  endDate: overrides.endDate ?? null,
  allDay: overrides.allDay ?? false,
  location: overrides.location ?? null,
  staffId: overrides.staffId ?? null,
  userId: overrides.userId ?? null,
  status: overrides.status ?? 'draft',
  notes: overrides.notes ?? null,
  recurrenceRaw: overrides.recurrenceRaw ?? null,
  recurrence: overrides.recurrence,
  created: overrides.created,
  modified: overrides.modified,
  category: overrides.category ?? null,
  serviceType: overrides.serviceType ?? null,
  personType: overrides.personType ?? null,
  personId: overrides.personId ?? null,
  personName: overrides.personName ?? null,
  staffIds: overrides.staffIds,
  staffNames: overrides.staffNames,
  dayPart: overrides.dayPart ?? null,
  billingFlags: overrides.billingFlags,
  targetUserIds: overrides.targetUserIds,
  targetUserNames: overrides.targetUserNames,
  relatedResourceIds: overrides.relatedResourceIds,
  relatedResourceNames: overrides.relatedResourceNames,
  rowKey: overrides.rowKey ?? null,
  dayKey: overrides.dayKey ?? null,
  monthKey: overrides.monthKey ?? null,
  createdAt: overrides.createdAt ?? null,
  updatedAt: overrides.updatedAt ?? null,
  assignedStaffIds: overrides.assignedStaffIds,
  assignedStaffNames: overrides.assignedStaffNames,
  statusLabel: overrides.statusLabel,
});

const formatSlotLabel = (day: Date, hour: number): string => {
  const start = new Date(day);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  const format = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${start.getMonth() + 1}月${start.getDate()}日 ${format.format(start)} から ${format.format(end)} の枠`;
};

describe('WeekView branches', () => {
  afterEach(() => {
    cleanup();
  });

  it('computes week range anchored to Monday through Sunday', () => {
    const anchor = new Date('2025-03-06T12:00:00Z');
    const range = getWeekRange(anchor);
    expect(range.start.getDay()).toBe(1);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getDay()).toBe(0);
    expect(range.end.getHours()).toBe(23);
    expect(range.end.getMinutes()).toBe(59);
  });

  it('renders schedule positions, forwards selections, and clamps overflows', () => {
    const onSelectSlot = vi.fn();
    const onSelectEvent = vi.fn();
    const weekStart = new Date(Date.UTC(2025, 2, 3));
    const monday = new Date(weekStart);
    const tuesday = new Date(weekStart);
    tuesday.setDate(tuesday.getDate() + 1);
    const wednesday = new Date(weekStart);
    wednesday.setDate(wednesday.getDate() + 2);

    const schedules: Schedule[] = [
      buildSchedule({
        id: 1,
        title: '朝訪問',
        status: 'submitted',
        startLocal: '2025-03-03T09:30:00+09:00',
        endLocal: '2025-03-03T11:00:00+09:00',
        notes: '持参資料',
      }),
      buildSchedule({
        id: 2,
        title: '終日ケア',
        allDay: true,
        status: 'approved',
        startLocal: '2025-03-05T00:00:00+09:00',
        endLocal: '2025-03-05T23:59:00+09:00',
      }),
      buildSchedule({
        id: 3,
        title: '夜間帯',
        status: 'draft',
        startLocal: '2025-03-04T06:30:00+09:00',
        endLocal: '2025-03-04T23:59:00+09:00',
      }),
      buildSchedule({
        id: 4,
        title: 'バックアップ',
        startLocal: null,
        endLocal: null,
        startUtc: '2025-03-04T10:30:00Z',
        endUtc: '2025-03-04T11:00:00Z',
      }),
      buildSchedule({
        id: 5,
        title: '破棄',
        startLocal: null,
        endLocal: null,
        startUtc: null,
        endUtc: null,
      }),
    ];

    render(
      <WeekView
        weekStart={weekStart}
        schedules={schedules}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
      />
    );

    const slotLabel = formatSlotLabel(monday, 9);
    fireEvent.click(screen.getByLabelText(slotLabel));
    expect(onSelectSlot).toHaveBeenCalledTimes(1);
    const [slotStart, slotEnd] = onSelectSlot.mock.calls[0]!;
    expect(slotStart).toBeInstanceOf(Date);
    expect(slotEnd).toBeInstanceOf(Date);
    expect(slotEnd.getHours() - slotStart.getHours()).toBe(1);

    const eventButtons = screen.getAllByTestId('schedule-item');
    expect(eventButtons).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: /朝訪問/ }));
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));

    const allDayButton = screen.getByRole('button', { name: /終日ケア/ });
    expect(allDayButton.style.top).toBe('6px');
    expect(Number.parseFloat(allDayButton.style.height)).toBeGreaterThan(100);

    const spanningButton = screen.getByRole('button', { name: /夜間帯/ });
    expect(spanningButton.style.top).toBe('0px');
    expect(Number.parseFloat(spanningButton.style.height)).toBeGreaterThan(300);

    const fallbackButton = screen.getByRole('button', { name: /バックアップ/ });
    expect(fallbackButton.className).toMatch(/bg-sky-100/);

    expect(screen.queryByText('破棄')).not.toBeInTheDocument();
  });

  it('surfaces loading state over the grid', () => {
    const { rerender } = render(
      <WeekView
        weekStart={new Date(Date.UTC(2025, 2, 3))}
        schedules={[]}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
      />
    );

    expect(screen.queryByText('予定を読み込んでいます…')).not.toBeInTheDocument();

    rerender(
      <WeekView
        weekStart={new Date(Date.UTC(2025, 2, 3))}
        schedules={[]}
        onSelectSlot={vi.fn()}
        onSelectEvent={vi.fn()}
        loading
      />
    );

    expect(screen.getByText('予定を読み込んでいます…')).toBeVisible();
  });
});
