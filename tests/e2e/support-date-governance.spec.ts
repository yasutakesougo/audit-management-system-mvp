import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

import usersFixture from './_fixtures/users.master.dev.v1.json';

test.describe('Support Date Governance — E2E Propagation', () => {
  test('New Planning Sheet propagates SupportStartDate to list view as Official', async ({ page }) => {
    // 0. Setup E2E Environment — Inject complete mocked env.runtime.json
    await page.route('**/env.runtime.json', async (route) => {
      console.log('[E2E] Serving mocked env.runtime.json');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          "MODE": "development",
          "VITE_MSAL_CLIENT_ID": "e2e-client-id",
          "VITE_MSAL_TENANT_ID": "e2e-tenant-id",
          "VITE_SP_RESOURCE": "https://isogokatudouhome.sharepoint.com",
          "VITE_SP_SITE_RELATIVE": "/sites/welfare",
          "VITE_SP_SITE_URL": "https://isogokatudouhome.sharepoint.com/sites/welfare",
          "VITE_SP_BASE_URL": "https://isogokatudouhome.sharepoint.com/sites/welfare",
          "VITE_SCHEDULES_TZ": "Asia/Tokyo",
          "VITE_SKIP_SHAREPOINT": "0",
          "VITE_SKIP_LOGIN": "1",
          "VITE_DEMO_MODE": "0",
          "VITE_DATA_PROVIDER": "sharepoint",
          "VITE_FORCE_SHAREPOINT": "1",
          "VITE_SKIP_PROVISIONING": "1",
          "VITE_FEATURE_SCHEDULES_SP": "1",
          "VITE_FEATURE_SCHEDULES": "1",
          "VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX": "1",
          "VITE_SP_LIST_USERS": "Users_Master",
          "VITE_SP_LIST_STAFF": "Staff_Master",
          "VITE_SP_LIST_ORG_MASTER": "Org_Master",
          "VITE_SP_LIST_OFFICES": "Offices",
          "VITE_SP_LIST_DAILY_RECORD": "SupportRecord_Daily",
          "VITE_SP_LIST_ATTENDANCE": "Daily_Attendance",
          "VITE_SP_LIST_SCHEDULES": "Schedules",
          "VITE_SP_ENABLED": "true",
          "VITE_E2E": "1",
          "VITE_E2E_MSAL_MOCK": "1",
          "VITE_AUDIT_DEBUG": "1"
        })
      });
    });

    await page.addInitScript(() => {
      console.log('[E2E] Initializing MSAL mocks');
      // Mock MSAL global to avoid initialization errors
      (window as any).__MSAL_PUBLIC_CLIENT__ = {
        initialize: async () => {},
        handleRedirectPromise: async () => null,
        getActiveAccount: () => ({ username: 'e2e@example.com', name: 'E2E User' }),
        getAllAccounts: () => [{ username: 'e2e@example.com', name: 'E2E User' }],
        setActiveAccount: () => {},
      };
    });

    // 1. Setup stubs
    // We use UX-001 (氷見 しずく) from the fixture.
    await setupSharePointStubs(page, {
      lists: [
        {
          name: 'Users_Master',
          items: usersFixture.users,
        },
        {
          name: 'SupportPlanningSheet_Master',
          items: [],
          onCreate: (payload: any, { takeNextId }) => ({
            Id: takeNextId(),
            ...payload,
            Created: new Date().toISOString(),
          }),
        },
        {
          name: 'ISP_Master',
          items: [
            { Id: 5001, UserCode: 'UX-001', IsCurrent: true, Title: '現行個別支援計画' }
          ]
        },
        {
          name: 'MonitoringMeetings',
          items: []
        },
        {
          name: 'SupportRecord_Daily',
          items: []
        },
        {
          name: 'Schedules',
          items: []
        }
      ]
    });

    page.on('console', msg => console.log(`[PAGE] ${msg.text()}`));

    // 2. Navigate to the New Planning Sheet form
    // userId=UX-001 should auto-select the user
    await page.goto('/support-planning-sheet/new?userId=UX-001');

    // Wait for the form to be ready (user selection and ISP binding)
    // We check for the presence of the section title which only appears when canProceedToForm is true
    await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible({ timeout: 10000 });
    
    // Also verify the ISP binding success message
    await expect(page.getByText(/現行個別支援計画と紐付けます/)).toBeVisible();

    // 3. Fill Section 1: Basic Information
    const testTitle = `E2E Support Date Governance ${Date.now()}`;
    const testDate = '2026-06-01';
    
    await page.getByLabel('計画タイトル').fill(testTitle);
    
    // SupportStartDate field - use fill with date string YYYY-MM-DD
    const dateInput = page.getByLabel('支援開始日（モニタリング起点）');
    await dateInput.fill(testDate);
    
    // 4. Navigate through all 10 sections to reach the submit button
    // We use forced clicks or wait for animations if necessary, but Playwright usually handles this.
    for (let i = 0; i < 9; i++) {
      const nextBtn = page.getByRole('button', { name: '次へ' });
      await nextBtn.click();
    }

    // 5. Submit the form
    const submitBtn = page.getByRole('button', { name: '支援計画シートを作成' });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 6. Verify navigation to the detail page (or wait for the redirect)
    // The app redirects to /support-planning-sheet/{id}
    await expect(page).toHaveURL(/\/support-planning-sheet\/(sp-)?\d+/);

    // 7. Navigate to the Planning Sheet List to verify the governance status
    await page.goto(`/planning-sheet-list?userId=UX-001`);

    // 8. Find the created sheet in the table and check the Monitoring Origin Status
    const row = page.getByRole('row').filter({ hasText: testTitle });
    await expect(row).toBeVisible();

    // The "起点ステータス" column should show "確定" (Official)
    const originChip = row.getByTestId('monitoring-origin-chip');
    await expect(originChip).toBeVisible();
    await expect(originChip).toContainText('確定');

    // Tooltip check (optional but good for regression)
    await originChip.hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('支援開始日を起点に90日モニタリングを管理しています');
  });

  test('Reverse-Bridge suggestions in Step 8 populate monitoring text fields', async ({ page }) => {
    // 0. Setup E2E Environment — Inject complete mocked env.runtime.json
    await page.route('**/env.runtime.json', async (route) => {
      console.log('[E2E] Serving mocked env.runtime.json');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          "MODE": "development",
          "VITE_MSAL_CLIENT_ID": "e2e-client-id",
          "VITE_MSAL_TENANT_ID": "e2e-tenant-id",
          "VITE_SP_RESOURCE": "https://isogokatudouhome.sharepoint.com",
          "VITE_SP_SITE_RELATIVE": "/sites/welfare",
          "VITE_SP_SITE_URL": "https://isogokatudouhome.sharepoint.com/sites/welfare",
          "VITE_SP_BASE_URL": "https://isogokatudouhome.sharepoint.com/sites/welfare",
          "VITE_SCHEDULES_TZ": "Asia/Tokyo",
          "VITE_SKIP_SHAREPOINT": "0",
          "VITE_SKIP_LOGIN": "1",
          "VITE_DEMO_MODE": "0",
          "VITE_DATA_PROVIDER": "sharepoint",
          "VITE_FORCE_SHAREPOINT": "1",
          "VITE_SKIP_PROVISIONING": "1",
          "VITE_FEATURE_SCHEDULES_SP": "1",
          "VITE_FEATURE_SCHEDULES": "1",
          "VITE_ALLOW_SHAREPOINT_OUTSIDE_SPFX": "1",
          "VITE_SP_LIST_USERS": "Users_Master",
          "VITE_SP_LIST_STAFF": "Staff_Master",
          "VITE_SP_LIST_ORG_MASTER": "Org_Master",
          "VITE_SP_LIST_OFFICES": "Offices",
          "VITE_SP_LIST_DAILY_RECORD": "SupportRecord_Daily",
          "VITE_SP_LIST_ATTENDANCE": "Daily_Attendance",
          "VITE_SP_LIST_SCHEDULES": "Schedules",
          "VITE_SP_ENABLED": "true",
          "VITE_E2E": "1",
          "VITE_E2E_MSAL_MOCK": "1",
          "VITE_AUDIT_DEBUG": "1"
        })
      });
    });

    await page.addInitScript(() => {
      console.log('[E2E] Initializing MSAL and localStorage mocks for Reverse-Bridge');
      // Mock MSAL global
      (window as any).__MSAL_PUBLIC_CLIENT__ = {
        initialize: async () => {},
        handleRedirectPromise: async () => null,
        getActiveAccount: () => ({ username: 'e2e@example.com', name: 'E2E User' }),
        getAllAccounts: () => [{ username: 'e2e@example.com', name: 'E2E User' }],
        setActiveAccount: () => {},
      };

      // Seed localStorage with daily execution logs and weekly observations for Reverse-Bridge
      // Since confidence becomes 'medium' if recordCount >= 3, we seed 3 completed records.
      const dailyRecords = {
        version: 1,
        data: {
          "2026-05-09::UX-001": {
            date: "2026-05-09",
            userId: "UX-001",
            records: [
              {
                id: "2026-05-09-UX-001-sched1",
                date: "2026-05-09",
                userId: "UX-001",
                scheduleItemId: "sched1",
                status: "completed",
                triggeredBipIds: [],
                memo: "食事支援は穏やかに終了。",
                recordedBy: "staff-1",
                recordedAt: "2026-05-09T12:00:00Z"
              }
            ],
            updatedAt: "2026-05-09T12:00:00Z"
          },
          "2026-05-08::UX-001": {
            date: "2026-05-08",
            userId: "UX-001",
            records: [
              {
                id: "2026-05-08-UX-001-sched1",
                date: "2026-05-08",
                userId: "UX-001",
                scheduleItemId: "sched1",
                status: "completed",
                triggeredBipIds: [],
                memo: "日中活動に意欲的に参加。",
                recordedBy: "staff-1",
                recordedAt: "2026-05-08T12:00:00Z"
              }
            ],
            updatedAt: "2026-05-08T12:00:00Z"
          },
          "2026-05-07::UX-001": {
            date: "2026-05-07",
            userId: "UX-001",
            records: [
              {
                id: "2026-05-07-UX-001-sched1",
                date: "2026-05-07",
                userId: "UX-001",
                scheduleItemId: "sched1",
                status: "completed",
                triggeredBipIds: [],
                memo: "夜間の睡眠状態良好。",
                recordedBy: "staff-1",
                recordedAt: "2026-05-07T12:00:00Z"
              }
            ],
            updatedAt: "2026-05-07T12:00:00Z"
          }
        }
      };

      const weeklyObservations = [
        {
          id: "weekly-1",
          userId: "UX-001",
          observerId: "obs-1",
          observerName: "佐藤中核",
          targetStaffId: "staff-1",
          targetStaffName: "田中支援員",
          observationDate: "2026-05-08",
          observationContent: "指示に対する応対が非常に穏やかであった。",
          adviceContent: "良好な関わりを継続する。",
          followUpActions: "なし",
          recordedBy: "staff-1",
          recordedAt: "2026-05-08T12:00:00Z"
        }
      ];

      localStorage.setItem('executionRecord.v1', JSON.stringify(dailyRecords));
      localStorage.setItem('staff.observation.v1', JSON.stringify(weeklyObservations));
    });

    // 1. Setup stubs
    await setupSharePointStubs(page, {
      lists: [
        {
          name: 'Users_Master',
          items: usersFixture.users,
        },
        {
          name: 'SupportPlanningSheet_Master',
          items: [],
          onCreate: (payload: any, { takeNextId }) => ({
            Id: takeNextId(),
            ...payload,
            Created: new Date().toISOString(),
          }),
        },
        {
          name: 'ISP_Master',
          items: [
            { Id: 5001, UserCode: 'UX-001', IsCurrent: true, Title: '現行個別支援計画' }
          ]
        },
        {
          name: 'MonitoringMeetings',
          items: []
        },
        {
          name: 'SupportRecord_Daily',
          items: []
        },
        {
          name: 'Schedules',
          items: []
        }
      ]
    });

    // 2. Navigate to the New Planning Sheet form
    await page.goto('/support-planning-sheet/new?userId=UX-001');

    // Wait for the form basic page to be fully ready
    await expect(page.getByRole('heading', { name: '基本情報' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/現行個別支援計画と紐付けます/)).toBeVisible();

    // Fill in basic title
    await page.getByLabel('計画タイトル').fill('E2E Reverse Bridge Test');

    // 3. Navigate to Step 8 (§9モニタリング) by sequentially clicking '次へ' 8 times
    for (let i = 0; i < 8; i++) {
      const nextBtn = page.getByRole('button', { name: '次へ' });
      await nextBtn.click();
    }

    // 4. Verify that the Reverse-Bridge suggestion panel is rendered
    await expect(page.getByText('L3支援実績からの評価提案（自動生成）')).toBeVisible({ timeout: 5000 });

    // Verify statistics inside the card
    await expect(page.getByText('日次記録数')).toBeVisible();
    await expect(page.getByText('手順実施率')).toBeVisible();
    await expect(page.getByText('BIP誘発率')).toBeVisible();
    await expect(page.getByText('週次観察数')).toBeVisible();

    // Verify Confidence Level badge shows '確信度: 中' (since we have 3 records)
    const confidenceBadge = page.getByText('確信度: 中');
    await expect(confidenceBadge).toBeVisible();

    // Locate text areas for "改善結果" and "次の支援方針"
    const improvementResultField = page.getByLabel('改善結果');
    const nextSupportField = page.getByLabel('次の支援方針');

    // Initially, these fields should be empty
    await expect(improvementResultField).toHaveValue('');
    await expect(nextSupportField).toHaveValue('');

    // 5. Click the unified apply button "改善結果・支援方針に一括反映する"
    const bulkApplyBtn = page.getByRole('button', { name: '改善結果・支援方針に一括反映する' });
    await expect(bulkApplyBtn).toBeVisible();
    await bulkApplyBtn.click();

    // 6. Assert that both fields are successfully populated with the deterministic suggested texts
    const expectedResultText = '支援手順の実施率は非常に高い水準（90%以上）を維持しており、行動発生率も10%未満と極めて低水準に抑制されています。';
    const expectedSupportText = '現行支援の継続: 現在の支援手順（先行制御・環境調整）が効果を発揮しているため、この関わり方を全スタッフ間で一貫して継続します。';

    await expect(improvementResultField).toContainText(expectedResultText);
    await expect(nextSupportField).toContainText(expectedSupportText);
  });
});

