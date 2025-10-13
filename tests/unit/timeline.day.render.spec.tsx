import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';
import TimelineDay from '@/features/schedule/views/TimelineDay';
import { cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/schedule/views/TimelineEventCard', () => ({
  default: ({
    title,
    startISO,
    endISO,
    containerProps,
  }: {
    title: string;
    startISO: string;
    endISO: string;
    containerProps?: Record<string, unknown>;
  }) => (
    <div data-testid="timeline-event-card" data-start={startISO} data-end={endISO} {...(containerProps ?? {})}>
      {title}
    </div>
  ),
}));

const buildUserEvent = (overrides: Partial<ScheduleUserCare>): ScheduleUserCare => ({
  id: overrides.id ?? 'user-1',
  etag: overrides.etag ?? 'etag-user',
  category: 'User',
  title: overrides.title ?? '訪問ケア',
  start: overrides.start ?? '2025-03-10T00:00:00.000Z',
  end: overrides.end ?? '2025-03-10T02:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '下書き',
  serviceType: overrides.serviceType ?? 'ショートステイ',
  personType: overrides.personType ?? 'Internal',
  personId: overrides.personId ?? 'P-1',
  personName: overrides.personName ?? '田中 太郎',
  staffIds: overrides.staffIds ?? ['S-01'],
  staffNames: overrides.staffNames ?? ['佐藤 花子'],
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  location: overrides.location,
  baseShiftWarnings: overrides.baseShiftWarnings,
});

const buildStaffEvent = (overrides: Partial<ScheduleStaff>): ScheduleStaff => ({
  id: overrides.id ?? 'staff-1',
  etag: overrides.etag ?? 'etag-staff',
  category: 'Staff',
  title: overrides.title ?? '職員会議',
  start: overrides.start ?? '2025-03-10T03:00:00.000Z',
  end: overrides.end ?? '2025-03-10T05:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '承認済み',
  subType: overrides.subType ?? '会議',
  staffIds: overrides.staffIds ?? ['S-01'],
  staffNames: overrides.staffNames,
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  baseShiftWarnings: overrides.baseShiftWarnings,
});

const buildOrgEvent = (overrides: Partial<ScheduleOrg>): ScheduleOrg => ({
  id: overrides.id ?? 'org-1',
  etag: overrides.etag ?? 'etag-org',
  category: 'Org',
  title: overrides.title ?? '組織イベント',
  start: overrides.start ?? '2025-03-10T06:00:00.000Z',
  end: overrides.end ?? '2025-03-10T08:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '申請中',
  subType: overrides.subType ?? '会議',
  audience: overrides.audience,
  resourceId: overrides.resourceId,
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
});

describe('TimelineDay rendering branches', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-10T00:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('clamps cross-day events and renders lane groupings', async () => {
    const events = [
      buildUserEvent({ id: 'user-inside', start: '2025-03-10T01:00:00.000Z', end: '2025-03-10T02:30:00.000Z' }),
      buildStaffEvent({
        id: 'staff-cross',
        start: '2025-03-09T12:00:00.000Z',
        end: '2025-03-10T06:00:00.000Z',
      }),
      buildOrgEvent({
        id: 'org-tail',
        start: '2025-03-10T06:00:00.000Z',
        end: '2025-03-11T06:30:00.000Z',
      }),
      buildUserEvent({ id: 'user-invalid', start: 'invalid', end: 'invalid', title: '無効', staffIds: ['S-02'] }),
    ];

    render(<TimelineDay events={events} date={new Date('2025-03-10T12:00:00+09:00')} />);

    const eventCards = screen.getAllByTestId('timeline-event-card');
    expect(eventCards).toHaveLength(3);

    const staffCard = eventCards.find((node) => node.getAttribute('data-category') === 'Staff');
    expect(staffCard?.getAttribute('data-start')).toBe('2025-03-09T15:00:00.000Z');

    const orgCard = eventCards.find((node) => node.getAttribute('data-category') === 'Org');
    expect(orgCard?.getAttribute('data-end')).toBe('2025-03-10T15:00:00.000Z');

    expect(screen.getByRole('rowheader', { name: '利用者レーン' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '職員レーン' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '組織イベント' })).toBeInTheDocument();
  });

  it('shows empty states and scroll reset behaviour', () => {
    render(<TimelineDay events={[]} date={new Date('2025-03-10T12:00:00+09:00')} />);

    const emptyMessages = screen.getAllByText('予定なし');
    expect(emptyMessages).toHaveLength(3);

    const scrollContainer = screen.getByTestId('day-scroll-container');
    const scrollSpy = vi.fn();
    Object.defineProperty(scrollContainer, 'scrollTo', { value: scrollSpy, configurable: true });

    screen.getByRole('button', { name: '先頭へ戻る' }).click();
    expect(scrollSpy).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'smooth' });
  });
});
