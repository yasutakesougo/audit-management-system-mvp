import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { KioskProcedureDetailScreen } from '../KioskProcedureDetailScreen';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ userId: 'U001', slotKey: '1' }),
    useLocation: () => ({ search: '?kiosk=1&provider=memory&date=2026-05-22' }),
  };
});

vi.mock('@/features/users/useUsers', () => ({
  useUser: () => ({
    data: {
      Id: 1,
      UserID: 'U001',
      FullName: '田中 太郎',
    },
    status: 'success',
  }),
}));

const mockProcedures = [
  {
    id: 'step-1',
    rowNo: 1,
    time: '09:30頃',
    activity: '朝の準備',
    instruction: '準備します。',
  },
  {
    id: 'step-2',
    rowNo: 2,
    time: '10:00頃',
    activity: '体操',
    instruction: '体操します。',
  },
];

vi.mock('@/features/daily/hooks/useProcedureData', () => ({
  useProcedureData: () => ({
    getByUser: () => mockProcedures,
  }),
}));

type ExecutionRecordHookMock = (
  date: string,
  userId: string,
  scheduleItemId: string,
  fallbackScheduleItemIds?: string[],
  fallbackUserIds?: string[],
) => {
  record: undefined;
  setStatus: ReturnType<typeof vi.fn>;
  setMemo: ReturnType<typeof vi.fn>;
  saveRecord: ReturnType<typeof vi.fn>;
  deleteRecord: ReturnType<typeof vi.fn>;
  isLoading: false;
  error: null;
  refresh: ReturnType<typeof vi.fn>;
};

const mockUseExecutionRecord = vi.fn<ExecutionRecordHookMock>(() => ({
  record: undefined,
  setStatus: vi.fn(),
  setMemo: vi.fn(),
  saveRecord: vi.fn(),
  deleteRecord: vi.fn(),
  isLoading: false,
  error: null,
  refresh: vi.fn(),
}));

vi.mock('@/features/daily/hooks/useExecutionRecord', () => ({
  useExecutionRecord: (
    date: string,
    userId: string,
    scheduleItemId: string,
    fallbackScheduleItemIds?: string[],
    fallbackUserIds?: string[],
  ) => mockUseExecutionRecord(date, userId, scheduleItemId, fallbackScheduleItemIds, fallbackUserIds),
}));

vi.mock('../../hooks/useKioskAttendance', () => ({
  useKioskAttendance: () => ({
    isAbsent: false,
    reason: undefined,
    isLoading: false,
    isError: false,
  }),
}));

describe('KioskProcedureDetailScreen ABC link identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the same rowNo 2 procedure for normal save identity and ABC slotId', () => {
    render(
      <MemoryRouter>
        <KioskProcedureDetailScreen />
      </MemoryRouter>,
    );

    expect(mockUseExecutionRecord).toHaveBeenCalledWith(
      '2026-05-22',
      'U001',
      'procedure-2',
      expect.arrayContaining(['2', 'procedure-2', 'step-2']),
      expect.arrayContaining(['U001']),
    );

    fireEvent.click(screen.getByTestId('kiosk-procedure-detail-abc-record'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/abc-record?'),
      {
        state: {
          draftBehavior: '10:00頃 体操の時間帯に問題行動あり',
          draftSlotId: '10:00頃|体操',
        },
      },
    );

    const [url] = mockNavigate.mock.calls[0];
    const params = new URLSearchParams(String(url).split('?')[1]);
    expect(params.get('slotId')).toBe('10:00頃|体操');
    expect(params.get('returnUrl')).toBe('/kiosk/users/U001/procedures/1?date=2026-05-22');
  });
});
