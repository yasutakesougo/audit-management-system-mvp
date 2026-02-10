import WeekView, { type WeekViewProps } from '@/features/schedules/WeekView';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

type WeekItem = NonNullable<WeekViewProps['items']>[number];

describe('WeekView service summary chips', () => {
  const range = { from: '2025-03-03', to: '2025-03-10' };

  it('aggregates counts by service type for the week range', () => {
    const items: WeekItem[] = [
      {
        id: 'other-1',
        title: '区分未設定 午前',
        start: '2025-03-03T01:00:00.000Z',
        end: '2025-03-03T02:00:00.000Z',
        serviceType: 'other',
      },
      {
        id: 'other-2',
        title: '区分未設定 送迎',
        start: '2025-03-03T03:00:00.000Z',
        end: '2025-03-03T04:00:00.000Z',
        serviceType: 'other',
      },
      {
        id: 'other-3',
        title: '区分未設定 午後',
        start: '2025-03-03T05:00:00.000Z',
        end: '2025-03-03T06:00:00.000Z',
        serviceType: 'other',
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

    const summary = screen.getByTestId('schedules-week-service-summary');

    const otherChip = within(summary).getByTestId('schedules-week-service-summary-other');
    expect(otherChip).toHaveTextContent('その他 3件');

    const meetingChip = within(summary).getByTestId('schedules-week-service-summary-meeting');
    expect(meetingChip).toHaveTextContent('会議 1件');

    expect(within(summary).queryByTestId('schedules-week-service-summary-normal')).toBeNull();
    expect(within(summary).queryByTestId('schedules-week-service-summary-transport')).toBeNull();
  });
});
