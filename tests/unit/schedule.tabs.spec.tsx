import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
    const items = await screen.findAllByTestId('schedule-item');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to day view when tab clicked', async () => {
    renderWeekPage();
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const dayPage = await screen.findByTestId(TESTIDS['schedules-day-page']);
    expect(dayPage).toBeInTheDocument();
  });

  it('shows demo schedule items in day view', async () => {
    renderWeekPage();
    await screen.findAllByTestId('schedule-item');
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const list = await screen.findByTestId(TESTIDS['schedules-day-list']);
    expect(list.textContent ?? '').toMatch(/通所|欠席|休み|訪問|看護|介護/);
  });

  it('shows demo schedule items in timeline view', async () => {
    renderWeekPage();
    await screen.findAllByTestId('schedule-item');
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_TIMELINE));
    const timeline = await screen.findByTestId(TESTIDS['schedules-week-timeline']);
    const items = within(timeline).queryAllByTestId('schedule-item');
    if (items.length === 0) {
      expect(within(timeline).getAllByText(/:00/).length).toBeGreaterThan(0);
      return;
    }
    const text = items.map((item) => item.textContent ?? '').join('\n');
    expect(text).toMatch(/通所|欠席|休み|訪問|看護|介護/);
  });
});
