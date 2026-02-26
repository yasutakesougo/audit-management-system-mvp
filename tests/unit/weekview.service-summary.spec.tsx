import { WeekView } from '@/features/schedules';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

type WeekItem = NonNullable<React.ComponentProps<typeof WeekView>['items']>[number];

describe.skip('WeekView service summary chips', () => {
  const range = { from: '2025-03-03', to: '2025-03-10' };

  it('aggregates counts by service type for the week range', () => {
    const items: WeekItem[] = [
      {
        id: 'other-1',
        title: '区分未設定 午前',
        start: '2025-03-03T01:00:00.000Z',
        end: '2025-03-03T02:00:00.000Z',
        category: 'Org',
        serviceType: 'other',
        etag: 'w/"1"',
      },
      {
        id: 'other-2',
        title: '区分未設定 送迎',
        start: '2025-03-03T03:00:00.000Z',
        end: '2025-03-03T04:00:00.000Z',
        category: 'Org',
        serviceType: 'other',
        etag: 'w/"2"',
      },
      {
        id: 'other-3',
        title: '区分未設定 午後',
        start: '2025-03-03T05:00:00.000Z',
        end: '2025-03-03T06:00:00.000Z',
        category: 'Org',
        serviceType: 'other',
        etag: 'w/"3"',
      },
      {
        id: 'meeting-other-day',
        title: '会議',
        start: '2025-03-04T01:00:00.000Z',
        end: '2025-03-04T02:00:00.000Z',
        category: 'Org',
        serviceType: 'meeting',
        etag: 'w/"4"',
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
