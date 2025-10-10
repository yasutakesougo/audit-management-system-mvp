import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WeekPage from '@/features/schedules/WeekPage';

describe('WeekPage tabs', () => {
  it('renders week view by default', async () => {
    render(<WeekPage />);
    expect(await screen.findByTestId('schedule-week-view')).toBeInTheDocument();
  });

  it('shows demo schedule items in week view', async () => {
    render(<WeekPage />);
    const items = await screen.findAllByTestId('schedule-item');
    expect(items.length).toBeGreaterThan(0);
    const lists = await screen.findAllByTestId('schedule-week-list');
    expect(
      lists.some((list) => Boolean(within(list).queryByText('訪問介護（午前）'))),
    ).toBe(true);
  });

  it('switches to day view when tab clicked', async () => {
    render(<WeekPage />);
    fireEvent.click(screen.getAllByTestId('tab-day')[0]);
    const dayViews = await screen.findAllByTestId('schedule-day-view');
    expect(dayViews.length).toBeGreaterThan(0);
  });

  it('shows demo schedule items in day view', async () => {
    render(<WeekPage />);
    fireEvent.click(screen.getAllByTestId('tab-day')[0]);
    const [list] = await screen.findAllByTestId('schedule-day-list');
    expect(list.textContent).toContain('訪問介護');
  });

  it('switches to timeline view when tab clicked', async () => {
    render(<WeekPage />);
    fireEvent.click(screen.getAllByTestId('tab-timeline')[0]);
    const timelineViews = await screen.findAllByTestId('schedule-timeline-view');
    expect(timelineViews.length).toBeGreaterThan(0);
  });

  it('shows demo schedule items in timeline view', async () => {
    render(<WeekPage />);
    fireEvent.click(screen.getAllByTestId('tab-timeline')[0]);
    const lists = await screen.findAllByTestId('schedule-timeline-list');
    expect(
      lists.some((list) => Boolean(within(list).queryByText('訪問介護（午前）'))),
    ).toBe(true);
  });
});
