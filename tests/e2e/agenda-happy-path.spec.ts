import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bootAgenda } from './_helpers/bootAgenda';
import { TESTIDS } from '../../src/testids';

type AgendaSeed = {
  handoffTimeline?: Array<{
    userDisplayName: string;
    timeBand: string;
  }>;
  dashboard?: {
    summaryChips?: string[];
  };
};

const agendaSeedPath = resolve(process.cwd(), 'tests/e2e/_fixtures/agenda.dashboard.dev.v1.json');
const agendaSeed = JSON.parse(readFileSync(agendaSeedPath, 'utf-8')) as AgendaSeed;

const DASHBOARD_URL = '/dashboard';
const TIMELINE_RECORDS = Array.isArray(agendaSeed.handoffTimeline) ? agendaSeed.handoffTimeline : [];
const TIMELINE_USERS = TIMELINE_RECORDS.map((record) => record.userDisplayName);
const SUMMARY_CHIPS = agendaSeed.dashboard?.summaryChips ?? [];
const MORNING_COUNT = TIMELINE_RECORDS.filter((record) => ['朝', '午前'].includes(record.timeBand)).length;
const EVENING_COUNT = TIMELINE_RECORDS.filter((record) => ['午後', '夕方'].includes(record.timeBand)).length;

/**
 * Dashboard → Agenda (handoff timeline) → Schedule (day view)
 * should surface the exact same deterministic fixtures when the shared seeds are enabled.
 */
test.describe('Agenda happy path', () => {
  test('links dashboard summary, timeline, and schedule day view via shared seeds', async ({ page }) => {
    await bootAgenda(page, {
      seed: {
        agenda: true,
        schedulesToday: true,
      },
      envOverrides: {
        // Ensure schedule routes keep using the SharePoint stub instead of demo shortcuts.
        VITE_SKIP_SHAREPOINT: '0',
        VITE_FORCE_SHAREPOINT: '1',
      },
    });

    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    // Dashboard chips reflect the seeded counts (1 pending / 1 in-progress / 1 done / total 3).
    for (const label of SUMMARY_CHIPS) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible();
    }

    // Handoff summary card uses dedicated test IDs so fixtures can assert totals quickly.
    const summaryRoot = page.getByTestId(TESTIDS['dashboard-handoff-summary']);
    await expect(
      summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-total'])
    ).toContainText('3');
    await expect(
      summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-alert'])
    ).not.toHaveText(/0件?/);
    await expect(
      summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-action'])
    ).not.toHaveText(/0件?/);

    // Jump into Agenda (handoff timeline) from the dashboard CTA.
    const timelineLink = page.getByRole('link', { name: '申し送りタイムライン' }).first();
    await expect(timelineLink).toBeVisible();
    await timelineLink.click();
    await expect(page).toHaveURL(/\/handoff-timeline/);

    // The deterministic timeline seed renders the three expected handoffs.
    await expect(page.getByTestId(TESTIDS['agenda-page-root'])).toBeVisible();
    const timelineItems = page.getByTestId(TESTIDS['agenda-timeline-item']);
    await expect(timelineItems).toHaveCount(TIMELINE_RECORDS.length);
    for (const name of TIMELINE_USERS) {
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    }

    // Filter to afternoon/evening events to prove deterministic time-band seeds.
    const eveningToggle = page.getByTestId(TESTIDS['agenda-filter-evening']);
    await eveningToggle.click();
    await expect(page.getByTestId(TESTIDS['agenda-timeline-item'])).toHaveCount(EVENING_COUNT);

    const morningToggle = page.getByTestId(TESTIDS['agenda-filter-morning']);
    await morningToggle.click();
    await expect(page.getByTestId(TESTIDS['agenda-timeline-item'])).toHaveCount(MORNING_COUNT);

    // Return to dashboard to trigger the schedule CTA.
    await page.goto(DASHBOARD_URL);

    const scheduleLink = page.getByRole('link', { name: 'スケジュール' }).first();
    await expect(scheduleLink).toBeVisible();
    await scheduleLink.click();
    await expect(page).toHaveURL(/\/schedules\/week/);

    await expect(page).toHaveURL(/\/schedules\/week/);
  });
});
