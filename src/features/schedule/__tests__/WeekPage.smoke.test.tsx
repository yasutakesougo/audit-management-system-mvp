 import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { Schedule } from '@/lib/mappers';
import WeekPage from '../WeekPage';

const MOCK_WEEK_START_ISO = '2025-01-06T00:00:00Z';
const MOCK_WEEK_END_ISO = '2025-01-12T23:59:59Z';

vi.mock('../adapter', () => ({
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
}));

vi.mock('../WeekView', () => {
  const MockWeekView = ({ schedules, onSelectSlot, onSelectEvent }: {
    schedules: Schedule[];
    onSelectSlot(start: Date, end: Date): void;
    onSelectEvent(schedule: Schedule): void;
  }) => (
    <div data-testid="mock-week-view">
      <button type="button" onClick={() => onSelectSlot(new Date('2025-01-06T09:00:00Z'), new Date('2025-01-06T10:00:00Z'))}>
        slot-trigger
      </button>
      {schedules.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelectEvent(item)}>
          編集:{item.title ?? '予定'}
        </button>
      ))}
    </div>
  );

  return {
    WeekView: MockWeekView,
    default: MockWeekView,
    getWeekRange: () => ({ start: new Date(MOCK_WEEK_START_ISO), end: new Date(MOCK_WEEK_END_ISO) }),
  };
});

const reloadMock = vi.fn();
let schedulesRef: Schedule[] = [];

vi.mock('@/stores/useSchedules', () => ({
  useSchedules: vi.fn(() => ({
    data: schedulesRef,
    loading: false,
    error: null,
    source: 'sharepoint',
    fallbackKind: null,
    fallbackError: null,
    reload: reloadMock,
  })),
}));

import { createSchedule, updateSchedule } from '../adapter';

const createScheduleMock = vi.mocked(createSchedule);
const updateScheduleMock = vi.mocked(updateSchedule);

describe('WeekPage smoke test', () => {
  const sampleStart = new Date('2025-01-06T09:00:00Z').toISOString();
  const sampleEnd = new Date('2025-01-06T10:00:00Z').toISOString();

  beforeEach(() => {
    schedulesRef = [
      {
        id: 1,
        etag: null,
        title: '初期予定',
        startUtc: sampleStart,
        endUtc: sampleEnd,
        startLocal: sampleStart,
        endLocal: sampleEnd,
        startDate: sampleStart.slice(0, 10),
        endDate: sampleEnd.slice(0, 10),
        allDay: false,
        location: null,
        staffId: null,
        userId: null,
        status: 'draft',
        notes: 'メモ',
        recurrenceRaw: null,
        recurrence: undefined,
        created: sampleStart,
        modified: sampleStart,
        category: 'User',
        serviceType: null,
        personType: null,
        personId: 'U-001',
        personName: '初期予定',
        staffIds: [],
        staffNames: [],
        dayPart: null,
      } satisfies Schedule,
    ];
    createScheduleMock.mockResolvedValue(undefined);
    updateScheduleMock.mockResolvedValue(undefined);
    reloadMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('supports create and edit flows', async () => {
    render(<WeekPage />);

    fireEvent.click(screen.getByText('+ 新規作成'));

    expect(await screen.findByRole('heading', { name: '予定を作成' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/利用者\s*ID/), { target: { value: 'NEW-001' } });
    fireEvent.change(screen.getByLabelText('タイトル'), { target: { value: '新しい予定' } });
    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '詳細メモ' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(createScheduleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'NEW-001',
          title: '新しい予定',
          note: '詳細メモ',
        })
      )
    );

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));

    const editTrigger = await screen.findByRole('button', { name: '編集:初期予定' });
    fireEvent.click(editTrigger);

    expect(await screen.findByRole('heading', { name: '予定を編集' })).toBeInTheDocument();
  expect((screen.getByLabelText(/利用者\s*ID/) as HTMLInputElement).value).toBe('U-001');

    fireEvent.change(screen.getByLabelText('メモ'), { target: { value: '更新済みメモ' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() =>
      expect(updateScheduleMock).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          note: '更新済みメモ',
        })
      )
    );
    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(2));
  });
});
