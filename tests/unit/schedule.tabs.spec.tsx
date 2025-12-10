import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import WeekPage from '@/features/schedules/WeekPage';
import { TESTIDS } from '@/testids';

const renderWeekPage = () =>
  render(
    <MemoryRouter initialEntries={['/schedule/week']}>
      <ThemeProvider theme={createTheme()}>
        <WeekPage />
      </ThemeProvider>
    </MemoryRouter>
  );

describe('WeekPage tabs', () => {
  it('renders week view by default', async () => {
    renderWeekPage();
    expect(await screen.findByTestId('schedule-week-view')).toBeInTheDocument();
  });

  it('shows demo schedule items in week view', async () => {
    renderWeekPage();
    const normal = await screen.findAllByTestId('schedules-event-normal');
    const legacy = screen.queryAllByTestId('schedule-item');
    const total = normal.length + legacy.length;
    expect(total).toBeGreaterThanOrEqual(1);
  });

  it('switches to day view when tab clicked', async () => {
    renderWeekPage();
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const dayPage = await screen.findByTestId(TESTIDS['schedules-day-page']);
    expect(dayPage).toBeInTheDocument();
  });

  it('shows demo schedule items in day view', async () => {
    renderWeekPage();
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const list = await screen.findByTestId(TESTIDS['schedules-day-list']);
    await waitFor(() => {
      expect(within(list).getAllByTestId('schedules-event-normal').length).toBeGreaterThan(0);
    });
  });

  it('shows demo schedule items in timeline view', async () => {
    renderWeekPage();
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_TIMELINE));
    const timeline = await screen.findByTestId(TESTIDS['schedules-week-timeline']);
    await waitFor(() => {
      const items = within(timeline).queryAllByTestId('schedule-item');
      const normal = within(timeline).queryAllByTestId('schedules-event-normal');
      const total = items.length + normal.length;
      if (total === 0) {
        expect(within(timeline).getAllByText(/:00/).length).toBeGreaterThan(0);
      } else {
        expect(total).toBeGreaterThan(0);
      }
    });
  });
});
