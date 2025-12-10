import type { BaseShiftWarning } from '@/features/schedule/types';
import TimelineEventCard from '@/features/schedule/views/TimelineEventCard';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

describe('TimelineEventCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders full metadata, warning styles, and supporting chips', () => {
    const warnings: BaseShiftWarning[] = [
      { staffId: 'staff-001', staffName: '佐藤 花子', reasons: ['day'] },
      { staffId: 'staff-002', reasons: ['day'] },
    ];

    render(
      <TimelineEventCard
        title="訪問リハビリ"
        subtitle="担当: 山田"
        startISO="2025-03-10T00:00:00.000Z"
        endISO="2025-03-10T03:30:00.000Z"
        allDay
        status="申請中"
        recurrenceRule="RRULE:FREQ=DAILY"
        serviceLabel="日中活動"
        baseShiftWarnings={warnings}
        containerProps={{
          className: 'extra-border',
          style: { borderColor: 'rgb(79, 70, 229)' },
        }}
      />
    );

    const card = screen.getByTestId('schedule-item');
    expect(card).toHaveAttribute('aria-label');
    expect(card.getAttribute('aria-label')).toContain('注意 佐藤 花子、staff-002のシフトに注意が必要です');
    expect(card.getAttribute('aria-label')).toContain('時間 終日 (Asia/Tokyo)');
    expect(card.className).toMatch(/extra-border/);
    expect(card).toHaveAttribute('title', '終日 (Asia/Tokyo)');

    expect(screen.getByText('訪問リハビリ')).toBeInTheDocument();
    expect(screen.getByText('担当: 山田')).toBeVisible();
    expect(screen.getAllByText('終日')).toHaveLength(2);
    expect(screen.getByText('日中活動')).toBeVisible();
    expect(screen.getByText('RRULE:FREQ=DAILY')).toBeVisible();
    expect(screen.getByTestId('schedule-status')).toHaveAttribute('data-status', '申請中');
    expect(screen.getByText('基本勤務パターン外: 佐藤 花子、staff-002のシフトに注意が必要です')).toBeVisible();

    // Inline warning icon should render for shift alerts
    expect(screen.getByTestId('schedule-warning-indicator')).toBeVisible();
  });

  it('handles half-day events without all-day chip and guards invalid times', () => {
    render(
      <TimelineEventCard
        title="午前半休"
        startISO="invalid"
        endISO="invalid"
        dayPart="AM"
        allDay
        containerProps={{ tabIndex: -1 }}
      />
    );

    // Half-day tag should render while the all-day chip is suppressed.
    expect(screen.getByText('午前休')).toBeVisible();
    expect(screen.queryByText('終日')).not.toBeInTheDocument();

    // Invalid times fall back to neutral placeholder.
    expect(screen.getByText('--:--–--:--')).toBeVisible();

    const card = screen.getByTestId('schedule-item');
    expect(card).toHaveAttribute('tabindex', '-1');
    expect(card.getAttribute('aria-label')).toContain('時間 --:--–--:-- (Asia/Tokyo)');
    expect(card.getAttribute('aria-label')).toContain('区分 午前休');
    expect(card).toHaveAttribute('title', '--:--–--:-- (Asia/Tokyo)');
  });

  it('renders overnight events with timezone annotations', () => {
    render(
      <TimelineEventCard
        title="夜勤帯"
        subtitle="担当: 鈴木"
        startISO="2025-03-10T13:30:00.000Z"
        endISO="2025-03-10T15:10:00.000Z"
      />
    );
    expect(screen.getByText('担当: 鈴木')).toBeVisible();
    expect(screen.getByText('22:30–翌 00:10 (Asia/Tokyo)')).toBeVisible();

    const card = screen.getByTestId('schedule-item');
    expect(card.getAttribute('aria-label')).toContain('時間 22:30 から 翌 00:10 (Asia/Tokyo)');
    expect(card).toHaveAttribute('title', '22:30 から 翌 00:10 (Asia/Tokyo)');
  });
});
