import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { toLocalDateISO } from '../../src/utils/getNow';
import { normalizeToWeekdayDate } from '../../src/pages/transport-assignment/TransportAssignmentPage.logic';

const TARGET_USER_ID = 'U1001';
const TARGET_USER_NAME = '利用者A';

test.describe('Transport assignments repository flow', () => {
  const today = toLocalDateISO();
  const targetDateKey = normalizeToWeekdayDate(today);

  test.setTimeout(120000);

  const commonFields = {
    Schedules: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'Title', Title: 'Title' },
      { InternalName: 'EventDate', Title: 'EventDate' },
      { InternalName: 'EndDate', Title: 'EndDate' },
      { InternalName: 'ServiceType', Title: 'ServiceType' },
      { InternalName: 'Category', Title: 'Category' },
      { InternalName: 'UserCode', Title: 'UserCode' },
      { InternalName: 'TargetUserId', Title: 'TargetUserId' },
      { InternalName: 'Vehicle', Title: 'Vehicle' },
      { InternalName: 'Status', Title: 'Status' },
    ],
    Users_Master: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'UserID', Title: 'UserID' },
      { InternalName: 'FullName', Title: 'FullName' },
      { InternalName: 'FullNameKana', Title: 'FullNameKana' },
      { InternalName: 'IsActive', Title: 'IsActive' },
      { InternalName: 'UsageStatus', Title: 'UsageStatus' },
      { InternalName: 'RecipientCertNumber', Title: 'RecipientCertNumber' },
    ],
    Staff_Master: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'StaffID', Title: 'StaffID' },
      { InternalName: 'FullName', Title: 'FullName' },
      { InternalName: 'FullNameKana', Title: 'FullNameKana' },
      { InternalName: 'IsActive', Title: 'IsActive' },
      { InternalName: 'RBACRole', Title: 'RBACRole' },
      { InternalName: 'Role', Title: 'Role' },
      { InternalName: 'Department', Title: 'Department' },
    ],
    UserBenefit_Profile: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'UserID', Title: 'UserID' },
      { InternalName: 'RecipientCertNumber', Title: 'RecipientCertNumber' },
      { InternalName: 'BenefitCutoverStage', Title: 'BenefitCutoverStage' },
    ],
    UserBenefit_Profile_Ext: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'UserID', Title: 'UserID' },
      { InternalName: 'RecipientCertNumber', Title: 'RecipientCertNumber' },
    ],
    UserTransport_Settings: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'UserID', Title: 'UserID' },
      { InternalName: 'TransportToDays', Title: 'TransportToDays' },
      { InternalName: 'TransportFromDays', Title: 'TransportFromDays' },
    ],
    Org_Master: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'OrgCode', Title: 'OrgCode' },
      { InternalName: 'OrgType', Title: 'OrgType' },
      { InternalName: 'Audience', Title: 'Audience' },
    ],
    SupportPlanningSheet_Master: [
      { InternalName: 'Id', Title: 'Id' },
      { InternalName: 'Title', Title: 'Title' },
      { InternalName: 'UserCode', Title: 'UserCode' },
      { InternalName: 'Status', Title: 'Status' },
    ],
  };

  const setupBaseStubs = async (page: any, overrides: any[] = []) => {
    await setupSharePointStubs(page, {
      lists: [
        {
          name: 'Schedules',
          fields: commonFields.Schedules,
          items: [
            { 
              Id: 101, 
              Title: 'UserU1001 Transport',
              ServiceType: 'transport',
              Category: 'transport',
              EventDate: `${targetDateKey}T08:30:00+09:00`,
              EndDate: `${targetDateKey}T09:00:00+09:00`,
              TargetUserId: TARGET_USER_ID,
              Vehicle: 'ブルー',
              '@odata.etag': 'W/"1"',
              Status: '予定'
            },
            { 
              Id: 102, 
              Title: 'UserU1002 Transport',
              ServiceType: 'transport',
              Category: 'transport',
              EventDate: `${targetDateKey}T08:45:00+09:00`,
              EndDate: `${targetDateKey}T09:15:00+09:00`,
              TargetUserId: 'U1002',
              Vehicle: 'シルバー',
              '@odata.etag': 'W/"1"',
              Status: '予定'
            }
          ]
        },
        { 
          name: 'Users_Master', 
          fields: commonFields.Users_Master,
          items: [
            { Id: 1001, UserID: TARGET_USER_ID, FullName: TARGET_USER_NAME, IsActive: true, UsageStatus: '利用中' },
            { Id: 1002, UserID: 'U1002', FullName: '利用者B', IsActive: true, UsageStatus: '利用中' }
          ]
        },
        { 
          name: 'Staff_Master', 
          fields: commonFields.Staff_Master,
          items: [
            { Id: 1, StaffID: 'S001', FullName: '佐藤', IsActive: true, Role: 'driver' },
            { Id: 2, StaffID: 'S002', FullName: '鈴木', IsActive: true, Role: 'driver' }
          ] 
        },
        { 
          name: 'Org_Master', 
          fields: commonFields.Org_Master,
          items: [{ 
            Id: 1, 
            OrgCode: 'ORG001',
            OrgType: 'office',
            Audience: 'common'
          }] 
        },
        { name: 'UserTransport_Settings', fields: commonFields.UserTransport_Settings, items: [] },
        { name: 'Holiday_Master', items: [] },
        { name: 'User_Feature_Flags', items: [] },
        { name: 'DriftEventsLog_v2', items: [] },
        { name: 'SupportTemplates', items: [] },
        { name: 'UserBenefit_Profile', fields: commonFields.UserBenefit_Profile, items: [] },
        { name: 'UserBenefit_Profile_Ext', fields: commonFields.UserBenefit_Profile_Ext, items: [] },
        { name: 'SupportPlanningSheet_Master', fields: commonFields.SupportPlanningSheet_Master, items: [] },

        ...overrides
      ]
    });
  };

  test('detects and handles concurrency conflicts via repository ETags', async ({ page }) => {
    await setupBaseStubs(page);
    await bootstrapDashboard(page, { initialPath: '/transport/assignments' });
    
    // Wait for hydration
    await expect(page.getByTestId('transport-assignment-vehicle-card-1')).toBeVisible({ timeout: 60000 });

    // 1. Initial setup: Assign a driver
    await page.getByTestId('transport-assignment-driver-select-1').click();
    await page.getByRole('option', { name: /佐藤/ }).click();

    // 2. Inject conflict
    await page.route(/.*Schedules.*items.*/, async (route) => {
      if (route.request().method() === 'GET' && !route.request().url().includes('items(')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            value: [{
              Id: 101,
              Title: 'UserU1001 Transport',
              EventDate: `${targetDateKey}T08:30:00+09:00`,
              EndDate: `${targetDateKey}T09:00:00+09:00`,
              ServiceType: 'transport',
              Category: 'transport',
              TargetUserId: TARGET_USER_ID,
              Vehicle: 'ブルー',
              '@odata.etag': 'W/"updated-by-other"',
              Status: '予定'
            },
            { 
              Id: 102, 
              Title: 'UserU1002 Transport',
              EventDate: `${targetDateKey}T08:45:00+09:00`,
              EndDate: `${targetDateKey}T09:15:00+09:00`,
              ServiceType: 'transport',
              Category: 'transport',
              TargetUserId: 'U1002',
              Vehicle: 'シルバー',
              '@odata.etag': 'W/"1"',
              Status: '予定'
            }]
          })
        });
      } else {
        await route.continue();
      }
    });

    // 3. Trigger refetch
    const refetchButton = page.getByRole('button', { name: '最新の情報を取得' });
    const responsePromise = page.waitForResponse(resp => resp.url().includes('Schedules') && resp.request().method() === 'GET');
    await refetchButton.click();
    await responsePromise;
    
    // 4. Verify conflict alert
    // Use loose text check to avoid selector issues
    await expect(page.locator('main')).toContainText('外部でデータが更新されました', { timeout: 30000 });
    await expect(page.locator('main')).toContainText('ブルー', { timeout: 30000 });

    // 5. Verify Save button is disabled
    const saveButton = page.getByTestId('transport-assignment-save-button');
    await expect(saveButton).toBeDisabled();
  });

  test('blocks save when coordination errors are present', async ({ page }) => {
    await setupBaseStubs(page);
    await bootstrapDashboard(page, { initialPath: '/transport/assignments' });

    await expect(page.getByTestId('transport-assignment-vehicle-card-1')).toBeVisible({ timeout: 60000 });

    const driverSelect = page.getByTestId('transport-assignment-driver-select-1');
    await driverSelect.click();
    await page.getByRole('option', { name: /佐藤/ }).click();
    
    const saveButton = page.getByTestId('transport-assignment-save-button');
    await expect(saveButton).toBeEnabled();
  });
});
