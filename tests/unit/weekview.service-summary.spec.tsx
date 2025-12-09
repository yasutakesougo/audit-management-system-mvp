import WeekView, { type WeekViewProps } from '@/features/schedules/WeekView';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

type WeekItem = NonNullable<WeekViewProps['items']>[number];

describe('WeekView service summary chips', () => {
  const range = { from: '2025-03-03', to: '2025-03-10' };

  it('aggregates counts by service type for the active day', () => {
    const items: WeekItem[] = [
      {
        id: 'normal-1',
        title: '通所 午前',
        start: '2025-03-03T01:00:00.000Z',
        end: '2025-03-03T02:00:00.000Z',
        serviceType: 'normal',
      },
      {
        id: 'transport-1',
        title: '送迎',
        start: '2025-03-03T03:00:00.000Z',
        end: '2025-03-03T04:00:00.000Z',
        serviceType: 'transport',
      },
      {
        id: 'normal-2',
        title: '通所 午後',
        start: '2025-03-03T05:00:00.000Z',
        end: '2025-03-03T06:00:00.000Z',
        serviceType: 'normal',
      },
      {
        id: 'meeting-other-day',
        title: '会議',
        start: '2025-03-04T01:00:00.000Z',
        end: '2025-03-04T02:00:00.000Z',
        serviceType: 'meeting',
      },
    ];

    render(<WeekView items={items} loading={false} range={range} activeDateIso="2025-03-03" />);

    expect(screen.getByTestId('schedules-week-service-summary-normal')).toHaveTextContent('通所 2件');
    expect(screen.getByTestId('schedules-week-service-summary-transport')).toHaveTextContent('送迎 1件');
    expect(screen.queryByTestId('schedules-week-service-summary-meeting')).toBeNull();
  });
});
