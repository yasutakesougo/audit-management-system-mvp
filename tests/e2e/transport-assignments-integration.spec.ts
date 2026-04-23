import { expect, test } from '@playwright/test';
import { setupSharePointStubs, resetScheduleStore } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { toLocalDateISO } from '../../src/utils/getNow';


test.describe('Transport assignments integration flow', () => {
  const today = toLocalDateISO();
  const nextDay = '2026-04-24'; // Ensure this is a weekday for the test or normalize it

  test.setTimeout(120000);

  const setupBaseStubs = async (page: any) => {
    // Clear session storage to ensure a clean state for context inheritance
    await page.addInitScript(() => {
      window.sessionStorage.clear();
    });

    await setupSharePointStubs(page, {
      lists: [
        {
          name: 'Schedules',
          fields: [
            { InternalName: 'Id', Title: 'Id' },
            { InternalName: 'Title', Title: 'Title' },
            { InternalName: 'EventDate', Title: 'EventDate' },
            { InternalName: 'EndDate', Title: 'EndDate' },
            { InternalName: 'ServiceType', Title: 'ServiceType' },
            { InternalName: 'Category', Title: 'Category' },
            { InternalName: 'TargetUserId', Title: 'TargetUserId' },
            { InternalName: 'Vehicle', Title: 'Vehicle' },
            { InternalName: 'Status', Title: 'Status' },
          ],
          items: [
            {
              Id: 101,
              Title: 'お迎え',
              EventDate: `${today}T00:00:00Z`,
              EndDate: `${today}T01:00:00Z`,
              ServiceType: '送迎',
              Category: '実施',
              TargetUserId: 'USER001',
              Vehicle: 'ブルー',
              Status: '通常',
              __metadata: { etag: '"1"' }
            }
          ]
        },
        { 
          name: 'Users_Master', 
          fields: [
            { InternalName: 'Id', Title: 'Id' },
            { InternalName: 'UserID', Title: 'UserID' },
            { InternalName: 'FullName', Title: 'FullName' },
            { InternalName: 'IsActive', Title: 'IsActive' },
            { InternalName: 'UsageStatus', Title: 'UsageStatus' },
          ],
          items: [
            { Id: 1, UserID: 'USER001', FullName: 'テスト 利用者', IsActive: true, UsageStatus: '利用中' }
          ]
        },
        { 
          name: 'Staff_Master', 
          fields: [
            { InternalName: 'Id', Title: 'Id' },
            { InternalName: 'StaffID', Title: 'StaffID' },
            { InternalName: 'FullName', Title: 'FullName' },
          ],
          items: [
            { Id: 1, StaffID: 'STAFF001', FullName: 'テスト 職員' }
          ] 
        },
        { name: 'Org_Master', items: [] },
        { name: 'UserTransport_Settings', items: [] },
        { name: 'Holiday_Master', items: [] },
        { name: 'User_Feature_Flags', items: [] },
        { name: 'DriftEventsLog_v2', items: [] },
        { name: 'SupportTemplates', items: [] },
        { name: 'UserBenefit_Profile', items: [] },
        { name: 'UserBenefit_Profile_Ext', items: [] },
        { name: 'SupportPlanningSheet_Master', items: [] },
      ]
    });

    // Capture console logs for debugging
    page.on('console', (msg: any) => {
      if (process.env.DEBUG_TEST) {
        console.log(`[BROWSER:${msg.type()}] ${msg.text()}`);
      }
    });
  };

  test('reads date context from URL parameters', async ({ page }) => {
    await setupBaseStubs(page);
    await bootstrapDashboard(page, { initialPath: `/transport/assignments?date=${nextDay}` });

    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    const dateInput = page.getByLabel('対象日');
    await expect(dateInput).toHaveValue(nextDay);
  });

  test('preserves date context from Today session state', async ({ page }) => {
    await setupBaseStubs(page);
    
    // 1. Start at Today page with a specific date
    await bootstrapDashboard(page, { initialPath: `/today?from=${nextDay}&to=${nextDay}` });
    await expect(page.getByRole('heading', { name: '日々の記録' })).toBeVisible();

    // 2. Manually ensure session storage is set (contract check)
    await page.evaluate(() => {
      window.sessionStorage.setItem('daily.filters.v2', JSON.stringify({
        from: '2026-04-24',
        to: '2026-04-24',
        quickRange: 'all'
      }));
    });

    // 3. Click "送迎実施" in sidebar
    const navItem = page.getByRole('link', { name: '送迎実施' });
    await navItem.click();

    // 4. Verify target date matches
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();
    const dateInput = page.getByLabel('対象日');
    await expect(dateInput).toHaveValue(nextDay);
  });

  test('initial sync status is visible on page load when data exists', async ({ page }) => {
    await setupBaseStubs(page);
    await bootstrapDashboard(page, { initialPath: '/transport/assignments' });

    // Verify "同期済みドメイン情報"
    await expect(page.getByText(/同期済みドメイン情報/)).toBeVisible();
    await expect(page.getByText(/1 件の割り当て/)).toBeVisible();
  });

  test('emits telemetry when concurrency conflict is detected', async ({ page }) => {
    await setupBaseStubs(page);

    // Track telemetry via CustomEvent (robust E2E contract)
    const detectedEvents: any[] = [];
    await page.exposeFunction('onTelemetry', (detail: any) => {
      detectedEvents.push(detail);
    });
    await page.addInitScript(() => {
      window.addEventListener('app:telemetry', (e: any) => {
        (window as any).onTelemetry(e.detail);
      });
    });
    
    // Setup initial state
    await bootstrapDashboard(page, { initialPath: '/transport/assignments' });
    await expect(page.getByTestId('transport-assignment-page')).toBeVisible();

    // Wait for initial data to be loaded so persistedSnapshot is captured
    await expect(page.getByText(/1 件の割り当て/)).toBeVisible();

    // Simulate an external update by updating the global stub store
    resetScheduleStore([
      {
        Id: 101,
        Title: 'お迎え',
        EventDate: `${today}T00:00:00Z`,
        EndDate: `${today}T01:00:00Z`,
        ServiceType: '送迎',
        Category: '送迎',
        TargetUserId: 'USER001',
        cr014_personId: 'USER001',
        cr014_personType: '利用者',
        cr014_personName: '利用者 太郎',
        Vehicle: 'ブルー',
        Status: '通常',
        __metadata: { etag: '"W/updated-externally"' }
      }
    ]);

    // Trigger a refetch
    await page.getByTestId('transport-assignment-refresh-button').click();

    // Verify alert is visible
    await expect(page.getByTestId('concurrency-conflict-alert')).toBeVisible();

    // Verify telemetry
    await expect.poll(async () => {
      const logs = await page.evaluate(() => (window as any).__TELEMETRY_LOG__ || []);
      if (process.env.DEBUG_TEST) console.log(`[TEST:DEBUG] Telemetry Logs: ${logs.map((l: any) => l.event).join(', ')}`);
      return logs.some((l: any) => l.event === 'assignment:concurrency_conflict');
    }, { timeout: 15000 }).toBeTruthy();
  });

  test('emits telemetry when refetching after conflict', async ({ page }) => {
    await setupBaseStubs(page);
    await bootstrapDashboard(page, { initialPath: '/transport/assignments' });
    
    // Wait for initial data to be loaded so persistedSnapshot is captured
    await expect(page.getByText(/1 件の割り当て/)).toBeVisible();

    // Setup conflict by updating the global stub store
    resetScheduleStore([
      {
        Id: 101,
        Title: 'お迎え',
        EventDate: `${today}T00:00:00Z`,
        EndDate: `${today}T01:00:00Z`,
        ServiceType: '送迎',
        Category: '送迎',
        TargetUserId: 'USER001',
        cr014_personId: 'USER001',
        cr014_personType: '利用者',
        cr014_personName: '利用者 太郎',
        Vehicle: 'ブルー',
        Status: '通常',
        __metadata: { etag: '"W/updated-externally"' }
      }
    ]);
    await page.getByTestId('transport-assignment-refresh-button').click();
    await expect(page.getByTestId('concurrency-conflict-alert')).toBeVisible();

    // Click reload button in alert
    await page.getByTestId('concurrency-reload-button').click();

    // Verify telemetry
    await expect.poll(async () => {
      const logs = await page.evaluate(() => (window as any).__TELEMETRY_LOG__ || []);
      return logs.some((l: any) => l.event === 'assignment:refetch_after_conflict');
    }, { timeout: 15000 }).toBeTruthy();
  });
});
