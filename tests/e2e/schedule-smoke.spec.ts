import { expect, test } from '@playwright/test';

const buildGraphEvents = (startIso: string | null, endIso: string | null) => {
  const fallbackStart = new Date();
  fallbackStart.setHours(9, 0, 0, 0);

  const rangeStart = startIso ? new Date(startIso) : fallbackStart;
  const base = Number.isNaN(rangeStart.getTime()) ? fallbackStart : rangeStart;

  const slot = (offsetHours: number, durationHours: number) => {
    const start = new Date(base);
    start.setTime(start.getTime() + offsetHours * 60 * 60 * 1000);
    const end = new Date(start);
    end.setTime(start.getTime() + durationHours * 60 * 60 * 1000);

    return {
      id: `graph-demo-${offsetHours}`,
      subject: `Graph demo visit +${offsetHours}h`,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
    };
  };

  const events = [slot(0, 2), slot(3, 1.5), slot(6, 2)];

  if (!endIso) {
    return events;
  }

  const endTs = new Date(endIso).getTime();
  if (Number.isNaN(endTs)) {
    return events;
  }

  return events.filter((event) => new Date(event.start.dateTime).getTime() < endTs);
};

test.describe('Schedule smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
      };
      window.localStorage.setItem('feature:schedules', '1');
    });

    await page.route('https://graph.microsoft.com/v1.0/me/calendarView*', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization,content-type,prefer',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
          },
        });
        return;
      }

      if (method !== 'GET') {
        await route.fulfill({ status: 405, headers: { 'Access-Control-Allow-Origin': '*' } });
        return;
      }

      const url = new URL(request.url());
      const startIso = url.searchParams.get('startDateTime');
      const endIso = url.searchParams.get('endDateTime');
      const value = buildGraphEvents(startIso, endIso);

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ value }),
      });
    });
  });

  test('shows tabs and demo appointments on week view', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.getByTestId('tab-week')).toBeVisible();
    await expect(page.getByTestId('tab-day')).toBeVisible();
    await expect(page.getByTestId('tab-timeline')).toBeVisible();

    const items = page.getByTestId('schedule-item');
    await expect(items.first()).toBeVisible();
  });
});

