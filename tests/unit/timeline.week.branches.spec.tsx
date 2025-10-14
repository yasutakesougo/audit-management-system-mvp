import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TimelineWeek from '@/features/schedule/views/TimelineWeek';
import type { ScheduleOrg, ScheduleStaff, ScheduleUserCare } from '@/features/schedule/types';

vi.mock('@/features/schedule/views/TimelineEventCard', () => ({
  default: ({
    title,
    subtitle,
    containerProps,
  }: {
    title: string;
    subtitle?: string;
    containerProps?: Record<string, unknown>;
  }) => (
    <div data-testid="timeline-event-card" data-title={title} data-subtitle={subtitle} {...(containerProps ?? {})}>
      {title}
    </div>
  ),
}));

const buildUserEvent = (overrides: Partial<ScheduleUserCare>): ScheduleUserCare => ({
  id: overrides.id ?? 'user-week',
  etag: overrides.etag ?? 'etag-user-week',
  category: 'User',
  title: overrides.title ?? '利用者予定',
  start: overrides.start ?? '2025-03-01T00:00:00.000Z',
  end: overrides.end ?? '2025-03-01T02:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '下書き',
  serviceType: overrides.serviceType ?? 'ショートステイ',
  personType: overrides.personType ?? 'External',
  externalPersonName: overrides.externalPersonName ?? '山田 太郎',
  staffIds: overrides.staffIds ?? ['S-10'],
  staffNames: overrides.staffNames ?? ['担当A'],
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  dayKey: overrides.dayKey,
});

const buildStaffEvent = (overrides: Partial<ScheduleStaff>): ScheduleStaff => ({
  id: overrides.id ?? 'staff-week',
  etag: overrides.etag ?? 'etag-staff-week',
  category: 'Staff',
  title: overrides.title ?? '職員予定',
  start: overrides.start ?? '2025-03-10T00:00:00.000Z',
  end: overrides.end ?? '2025-03-10T02:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '承認済み',
  subType: overrides.subType ?? '年休',
  staffIds: overrides.staffIds ?? ['S-20'],
  staffNames: overrides.staffNames ?? ['佐藤 職員'],
  dayPart: overrides.dayPart ?? 'PM',
  dayKey: overrides.dayKey,
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
  baseShiftWarnings: overrides.baseShiftWarnings,
});

const buildOrgEvent = (overrides: Partial<ScheduleOrg>): ScheduleOrg => ({
  id: overrides.id ?? 'org-week',
  etag: overrides.etag ?? 'etag-org-week',
  category: 'Org',
  title: overrides.title ?? '組織予定',
  start: overrides.start ?? '2025-03-02T03:00:00.000Z',
  end: overrides.end ?? '2025-03-02T05:00:00.000Z',
  allDay: overrides.allDay ?? false,
  status: overrides.status ?? '申請中',
  subType: overrides.subType ?? '会議',
  dayKey: overrides.dayKey,
  notes: overrides.notes,
  recurrenceRule: overrides.recurrenceRule,
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TimelineWeek branch coverage', () => {
  it('renders grouped lanes and disables today jump when week excludes current day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-20T00:00:00.000Z'));

    const events = [
      buildUserEvent({ start: '2025-03-01T00:00:00.000Z', end: '2025-03-01T01:30:00.000Z', dayKey: '2025-03-01' }),
      buildOrgEvent({ start: '2025-03-02T04:00:00.000Z', end: '2025-03-02T05:00:00.000Z', dayKey: '2025-03-02' }),
    ];

    render(<TimelineWeek events={events} />);

  expect(screen.getByRole('button', { name: '今日の列に移動' })).toBeDisabled();
  expect(screen.getAllByTestId('schedule-item')).toHaveLength(2);
    expect(screen.getAllByText('予定なし').length).toBeGreaterThan(0);
  });

  it('supports drag-and-drop and keyboard moves with today highlighting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-10T00:00:00.000Z'));

    const onEventMove = vi.fn();
    const staffEvent = buildStaffEvent({
      id: 'staff-evt',
      start: '2025-03-10T00:00:00.000Z',
      end: '2025-03-10T02:00:00.000Z',
      dayKey: '2025-03-10',
      staffNames: ['佐藤'],
    });

    render(<TimelineWeek events={[staffEvent]} onEventMove={onEventMove} />);

    expect(screen.getByText(/Shiftキーと左右矢印キー/)).toBeInTheDocument();

    const todayHeader = screen.getByRole('columnheader', { name: /3月10日/ });
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    Object.defineProperty(todayHeader, 'scrollIntoView', { value: scrollSpy, configurable: true });
    Object.defineProperty(todayHeader, 'focus', { value: focusSpy, configurable: true });

  const todayButton = screen.getByRole('button', { name: '今日の列に移動' });
    expect(todayButton).not.toBeDisabled();
    todayButton.click();
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(focusSpy).toHaveBeenCalledTimes(1);

    const eventNode = screen.getByTestId('schedule-item');
    const nextDayCell = screen.getByLabelText(/職員レーン・3月11日/);

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'staff-evt'),
      effectAllowed: '',
      dropEffect: '',
    } as unknown as DataTransfer;

    fireEvent.dragStart(eventNode, { dataTransfer });
    expect(eventNode.getAttribute('aria-grabbed')).toBe('true');
    fireEvent.dragEnter(nextDayCell, { dataTransfer, preventDefault: () => {} });
    fireEvent.drop(nextDayCell, { dataTransfer, preventDefault: () => {} });

    expect(onEventMove).toHaveBeenCalledWith({
      id: 'staff-evt',
      from: { category: 'Staff', dayKey: '2025-03-10' },
      to: { category: 'Staff', dayKey: '2025-03-11' },
    });

    onEventMove.mockClear();
    fireEvent.keyDown(eventNode, { key: 'ArrowRight', shiftKey: true, preventDefault: () => {} });
    expect(onEventMove).toHaveBeenCalledWith({
      id: 'staff-evt',
      from: { category: 'Staff', dayKey: '2025-03-10' },
      to: { category: 'Staff', dayKey: '2025-03-11' },
    });
  });

  it('ignores keyboard moves without the modifier and keeps subtitles per category', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00.000Z'));

    const onEventMove = vi.fn();
    const events = [
      buildUserEvent({ id: 'user', staffNames: ['A', 'B'], start: '2025-03-01T02:00:00.000Z', dayKey: '2025-03-01' }),
      buildStaffEvent({ id: 'staff', dayPart: 'AM', subType: '年休', staffNames: ['C'], start: '2025-03-03T00:00:00.000Z', dayKey: '2025-03-03' }),
      buildOrgEvent({ id: 'org', start: '2025-03-02T03:00:00.000Z', dayKey: '2025-03-02' }),
    ];

    render(<TimelineWeek events={events} onEventMove={onEventMove} />);

    const cards = screen.getAllByTestId('schedule-item');
    const userCard = cards.find((card) => card.getAttribute('data-id') === 'user');
    const staffCard = cards.find((card) => card.getAttribute('data-id') === 'staff');
    const orgCard = cards.find((card) => card.getAttribute('data-id') === 'org');

  expect(userCard).toBeDefined();
  expect(userCard?.getAttribute('data-subtitle')).toContain('ショートステイ');
  expect(userCard?.getAttribute('data-subtitle')).toContain('A・B');

  expect(staffCard).toBeDefined();
  expect(staffCard?.getAttribute('data-subtitle')).toContain('年休（午前休）');
  expect(staffCard?.getAttribute('data-subtitle')).toContain('C');

  expect(orgCard).toBeDefined();
  expect(orgCard?.getAttribute('data-subtitle') ?? '').not.toBe('');

    const staffEvent = screen
      .getAllByTestId('schedule-item')
      .find((node) => node.getAttribute('data-id') === 'staff');
    fireEvent.keyDown(staffEvent!, { key: 'ArrowRight', shiftKey: false, preventDefault: () => {} });
    expect(onEventMove).not.toHaveBeenCalled();
  });

  it('does not trigger moves when drop data is missing or unknown', () => {
    const onEventMove = vi.fn();
    const events = [buildUserEvent({ id: 'user-x', dayKey: '2025-03-01', start: '2025-03-01T00:00:00.000Z' })];

    render(<TimelineWeek events={events} onEventMove={onEventMove} />);

  const targetCell = screen.getAllByLabelText(/利用者レーン・/)[0];
    fireEvent.drop(targetCell, {
      preventDefault: () => {},
      dataTransfer: { getData: vi.fn(() => '') },
    });
    expect(onEventMove).not.toHaveBeenCalled();

    fireEvent.drop(targetCell, {
      preventDefault: () => {},
      dataTransfer: { getData: vi.fn(() => 'missing') },
    });
    expect(onEventMove).not.toHaveBeenCalled();
  });

  it('rejects drops when categories differ or when the event lacks a valid day key', () => {
    const onEventMove = vi.fn();
  const validEvent = buildUserEvent({ id: 'user-y', dayKey: '2025-03-01', start: '2025-03-01T00:00:00.000Z' });
  const invalidEvent = buildUserEvent({ id: 'user-z', start: 'invalid-date', dayKey: undefined });

    render(<TimelineWeek events={[validEvent, invalidEvent]} onEventMove={onEventMove} />);

    const userNode = screen.getAllByTestId('schedule-item').find((node) => node.getAttribute('data-id') === 'user-y');
  const staffCell = screen.getAllByLabelText(/職員レーン・/)[0];

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'user-y'),
      effectAllowed: '',
      dropEffect: '',
    } as unknown as DataTransfer;

    fireEvent.dragStart(userNode!, { dataTransfer });
    fireEvent.drop(staffCell, { dataTransfer, preventDefault: () => {} });
    expect(onEventMove).not.toHaveBeenCalled();

    const userCell = screen.getAllByLabelText(/利用者レーン・/)[0];
    fireEvent.drop(userCell, {
      dataTransfer: { getData: vi.fn(() => 'user-z') },
      preventDefault: () => {},
    });
    expect(onEventMove).not.toHaveBeenCalled();
  });

  it('ignores drops onto the original location', () => {
    const onEventMove = vi.fn();
    const event = buildUserEvent({ id: 'user-same', dayKey: '2025-03-01', start: '2025-03-01T00:00:00.000Z' });

    render(<TimelineWeek events={[event]} onEventMove={onEventMove} />);

    const node = screen.getByTestId('schedule-item');
  const cell = screen.getAllByLabelText(/利用者レーン・/)[0];

    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'user-same'),
      effectAllowed: '',
      dropEffect: '',
    } as unknown as DataTransfer;

    fireEvent.dragStart(node, { dataTransfer });
    fireEvent.drop(cell, { dataTransfer, preventDefault: () => {} });
    expect(onEventMove).not.toHaveBeenCalled();
  });
});
