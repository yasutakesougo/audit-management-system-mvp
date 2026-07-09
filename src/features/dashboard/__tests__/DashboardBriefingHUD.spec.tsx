import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DashboardBriefingHUD from '../DashboardBriefingHUD';
import type { BriefingAlert } from '../sections/types';

const alerts: BriefingAlert[] = [
  {
    id: 'absent',
    type: 'absent',
    severity: 'error',
    label: '本日欠席',
    count: 2,
    targetAnchorId: 'sec-attendance',
    description: 'テスト利用者',
  },
  {
    id: 'late',
    type: 'late',
    severity: 'warning',
    label: '遅刻・早退',
    count: 1,
    targetAnchorId: 'sec-attendance',
  },
  {
    id: 'health',
    type: 'health_concern',
    severity: 'info',
    label: 'ケア要注視',
    count: 1,
    targetAnchorId: 'sec-safety',
  },
];

describe('DashboardBriefingHUD', () => {
  it('does not render when there are no alerts', () => {
    render(
      <DashboardBriefingHUD
        alerts={[]}
        isBriefingTime={false}
        briefingType="morning"
        onNavigateTo={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('dashboard-briefing-hud')).not.toBeInTheDocument();
  });

  it('renders alert counts and severity styles for a live morning briefing', () => {
    render(
      <DashboardBriefingHUD
        alerts={alerts}
        isBriefingTime
        briefingType="morning"
        onNavigateTo={vi.fn()}
      />,
    );

    expect(screen.getByText('🌅 朝会サマリー')).toBeVisible();
    expect(screen.getByText('ライブ')).toBeVisible();
    expect(screen.getByTestId('briefing-alert-absent')).toHaveTextContent('本日欠席: 2件');
    expect(screen.getByTestId('briefing-alert-absent')).toHaveClass('MuiChip-colorError');
    expect(screen.getByTestId('briefing-alert-late')).toHaveClass('MuiChip-colorWarning');
    expect(screen.getByTestId('briefing-alert-health')).toHaveClass('MuiChip-colorInfo');
    expect(screen.getByRole('alert')).toHaveTextContent('欠席: テスト利用者');
  });

  it('navigates to the alert target when a chip is clicked', () => {
    const onNavigateTo = vi.fn();
    render(
      <DashboardBriefingHUD
        alerts={[alerts[0]]}
        isBriefingTime={false}
        briefingType="morning"
        onNavigateTo={onNavigateTo}
      />,
    );

    fireEvent.click(screen.getByTestId('briefing-alert-absent'));
    expect(onNavigateTo).toHaveBeenCalledOnce();
    expect(onNavigateTo).toHaveBeenCalledWith('sec-attendance');
  });

  it('renders the evening label without the live indicator outside briefing time', () => {
    render(
      <DashboardBriefingHUD
        alerts={[alerts[0]]}
        isBriefingTime={false}
        briefingType="evening"
        onNavigateTo={vi.fn()}
      />,
    );

    expect(screen.getByText('🌆 夕会サマリー')).toBeVisible();
    expect(screen.queryByText('ライブ')).not.toBeInTheDocument();
  });
});
