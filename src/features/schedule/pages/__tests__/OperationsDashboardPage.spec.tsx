// src/features/schedule/pages/__tests__/OperationsDashboardPage.spec.tsx
import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { TESTIDS } from '@/testids';
import type { Schedule } from '../../types';
import OperationsDashboardPage from '../OperationsDashboardPage';

describe('OperationsDashboardPage', () => {
  it('renders safety hud and panels for given schedules', () => {
    const today = dayjs().startOf('day');

    const schedules: Schedule[] = [
      {
        id: 's1',
        etag: '1',
        category: 'User',
        title: '生活介護',
        start: today.add(9, 'hour').toISOString(),
        end: today.add(10, 'hour').toISOString(),
        allDay: false,
        status: '承認済み',
        location: 'フロアA',
        notes: '',
        serviceType: '一時ケア',
        personType: 'Internal',
        staffIds: ['staff-001'],
      },
      {
        id: 's2',
        etag: '1',
        category: 'Staff',
        title: '研修',
        start: today.add(9, 'hour').toISOString(),
        end: today.add(11, 'hour').toISOString(),
        allDay: false,
        status: '承認済み',
        location: '会議室',
        notes: '',
        subType: '研修',
        staffIds: ['staff-001'],
      } as Schedule,
    ];

    render(<OperationsDashboardPage schedules={schedules} />);

    // ページ本体
    expect(screen.getByTestId(TESTIDS['operations-dashboard-page'])).toBeInTheDocument();

    // Safety HUD
    expect(screen.getByTestId(TESTIDS['operations-safety-hud'])).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS['operations-safety-hud-total'])).toHaveTextContent(
      '予定の重なり',
    );

    // 職員負荷・車両パネル
    expect(screen.getByTestId(TESTIDS['operations-staff-load-panel'])).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS['operations-vehicle-panel'])).toBeInTheDocument();
  });
});