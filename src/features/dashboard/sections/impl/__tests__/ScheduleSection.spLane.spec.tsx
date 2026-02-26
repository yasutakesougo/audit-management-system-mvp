import type { SpLaneModel } from '@/features/dashboard/useDashboardSummary';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ScheduleSection } from '../ScheduleSection';

describe('ScheduleSection (Constant SP Lane)', () => {
  it('always renders schedules-sp-lane as the 4th lane frame', () => {
    const spLane: SpLaneModel = {
      state: 'disabled',
      title: 'SharePoint 外部連携',
      reason: '機能フラグがオフです',
    };

    render(
      <MemoryRouter>
        <ScheduleSection
          title="今日の予定"
          schedulesEnabled={true}
          scheduleLanesToday={{ userLane: [], staffLane: [], organizationLane: [] }}
          spLane={spLane}
        />
      </MemoryRouter>
    );

    const lane = screen.getByTestId('schedules-sp-lane');
    expect(lane).toBeInTheDocument();
    expect(lane).toHaveAttribute('data-state', 'disabled');
    expect(screen.getByText('連携オフ')).toBeInTheDocument();
  });
});
