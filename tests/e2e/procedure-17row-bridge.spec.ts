import { expect, test, type Page } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

type SharePointStubEvidence = {
  apiRequests: string[];
  authRequests: string[];
  failures: string[];
};

async function primeProcedureEnv(page: Page): Promise<SharePointStubEvidence> {
  const evidence: SharePointStubEvidence = { apiRequests: [], authRequests: [], failures: [] };
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/_api/')) evidence.apiRequests.push(url);
    if (url.includes('login.microsoftonline.com')) evidence.authRequests.push(url);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/_api/') || url.includes('sharepoint.com')) evidence.failures.push(url);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/_api/') && response.status() >= 400) {
      evidence.failures.push(`${response.status()} ${url}`);
    }
  });

  await page.addInitScript(() => {
    const win = window as typeof window & { __ENV__?: Record<string, string> };
    win.__ENV__ = {
      ...(win.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '0',
      VITE_SKIP_SHAREPOINT: '0',
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DEMO_MODE: '0',
      VITE_USE_DEMO: '0',
      VITE_WRITE_ENABLED: '1',
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/Audit',
      VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read',
    };
    window.localStorage.removeItem('skipLogin');
    window.localStorage.setItem('demo', '0');
    window.localStorage.setItem('writeEnabled', '1');
    window.localStorage.removeItem('dataProvider');
    window.localStorage.removeItem('VITE_DATA_PROVIDER');
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({ status: 200, headers: jsonHeaders, body: JSON.stringify({ value: [] }) }),
  );

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 12345, Title: 'Mock User' } },
    fallback: { status: 200, body: { value: [] } },
    lists: [
      {
        name: 'Users_Master',
        items: [
          {
            Id: 7,
            UserID: 'U-007',
            FullName: '伊藤 雄介',
            IsHighIntensitySupportTarget: true,
            IsSupportProcedureTarget: true,
            IsActive: true,
            UsageStatus: 'active',
          },
        ],
      },
      {
        name: 'SupportPlanningSheet_Master',
        items: [
          {
            Id: 1007,
            Title: '支援計画 U-007',
            UserCode: 'U-007',
            ISPId: '7',
            Status: 'active',
            VersionNo: 1,
            IsCurrent: true,
            SupportPolicy: '伊藤さんの対応方針',
            ConcreteApproaches: '伊藤さんの具体策',
            EnvironmentalAdjustments: '伊藤さんの環境調整',
            FormDataJson: JSON.stringify({
              title: '支援計画 U-007',
              observationFacts: '伊藤さんの行動観察',
              interpretationHypothesis: '伊藤さんの分析',
              supportIssues: '伊藤さんの課題',
            }),
            PlanningJson: JSON.stringify({ procedureSteps: [] }),
          },
        ],
      },
      {
        name: 'SupportProcedureRecord_Daily',
        items: [],
      },
    ],
  });

  return evidence;
}

function expectSharePointStubEvidence(evidence: SharePointStubEvidence): void {
  expect(evidence.apiRequests.length).toBeGreaterThan(0);
  expect(evidence.authRequests).toEqual([]);
  expect(evidence.failures).toEqual([]);
}

test.describe('Procedure 17-row Bridge Verification', () => {
  test.describe.configure({ mode: 'serial' });

  const TEST_PLAN_ID = '1007';

  const openPlanningSheetEditor = async (page: Page) => {
    await page.goto(`/support-planning-sheet/${TEST_PLAN_ID}?provider=sharepoint`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/support-planning-sheet/${TEST_PLAN_ID}`));

    const editButton = page.getByTestId('planning-sheet-btn-edit');
    await expect(editButton).toBeVisible({ timeout: 30000 });
    await editButton.click();
  };

  const startDailyWizard = async (page: Page) => {
    const params = new URLSearchParams({
      planningSheetId: TEST_PLAN_ID,
      provider: 'sharepoint',
    });
    await page.goto(`/daily/support?${params.toString()}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/daily\/support/);

    // This bridge test verifies the planning-sheet data path, not the default
    // user-filter contract. Make the stubbed user selectable regardless of
    // tenant-specific lifecycle/high-intensity field mappings.
    await page.getByRole('button', { name: '強度行動障害支援対象者のみ表示' }).click();
    await page.getByRole('combobox', { name: 'ステータス' }).click();
    await page.getByRole('option', { name: '（全て）' }).click();

    const availableHighIntensityUser = page.getByRole('button', { name: /伊藤 雄介/ }).first();
    await expect(availableHighIntensityUser).toBeVisible({ timeout: 30000 });
    await availableHighIntensityUser.click();

    await expect(page.getByText('時間帯を選択してください')).toBeVisible({ timeout: 30000 });
  };
  test('reflects structured planning steps to 17-row daily record', async ({ page }) => {
    const stubEvidence = await primeProcedureEnv(page);

    // 1. 支援計画シートエディタで手順を設定
    await openPlanningSheetEditor(page);
    
    // 概要タブで必須フィールドを埋める（バリデーション回避）
    await page.getByRole('tab', { name: '概要' }).click();
    await page.getByLabel('行動観察').fill('行動観察テスト');
    await page.getByLabel('分析・仮説').fill('分析・仮説テスト');
    await page.getByLabel('支援課題').fill('支援課題テスト');
    await page.getByLabel('対応方針').fill('対応方針テスト');
    await page.getByLabel('関わり方の具体策').fill('関わり方の具体策テスト');

    // 支援設計タブを選択
    await page.getByRole('tab', { name: '支援設計' }).click();

    // 手順が既にある場合は削除してクリーンにする
    const deleteButtons = await page.getByRole('button', { name: '削除' }).all();
    for (const btn of deleteButtons) {
      await btn.click();
    }

    // ステップ1: 起床 (Row 1: 9:30頃)
    await page.getByRole('button', { name: 'ステップ追加' }).click();
    await page.getByLabel('手順内容').last().fill('通所準備');
    await page.getByLabel('タイミング').last().fill('9:30');
    await page.getByLabel('本人の動き（活動詳解）').last().fill('顔を洗う');
    await page.getByLabel('支援者の支援（手順詳解）').last().fill('タオルを渡す');
    await page.getByLabel('留意事項（様子・条件）').last().fill('機嫌が良い');

    // ステップ2: 朝の会 (Row 2)
    await page.getByRole('button', { name: 'ステップ追加' }).click();
    await page.getByLabel('手順内容').last().fill('朝の会');
    await page.getByLabel('タイミング').last().fill('10:00');
    await page.getByLabel('本人の動き（活動詳解）').last().fill('本人AMテスト');
    await page.getByLabel('支援者の支援（手順詳解）').last().fill('支援者AMテスト');

    // 保存
    const saveBtn = page.getByTestId('planning-sheet-btn-save');
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
    await saveBtn.click();
    await expect(page.getByText('保存しました')).toBeVisible();

    // 2. 日次記録（Viewer）で反映を確認
    await startDailyWizard(page);

    // ProcedurePanel の存在確認
    const panel = page.getByTestId('procedure-panel');
    await expect(panel).toBeVisible();

    // 17行（ベース）がレンダリングされているか確認
    await expect(page.locator('[data-row-no="1"]')).toBeVisible();
    await expect(page.locator('[data-row-no="2"]')).toBeVisible();

    // 構造化フィールドの反映を確認
    // ステップ1: 通所・朝の準備 (Row 1)
    const step1 = page.locator('[data-row-no="1"]').first();
    await expect(step1.getByText('本人', { exact: true })).toBeVisible();
    await expect(step1.getByText('顔を洗う')).toBeVisible();
    await expect(step1.getByText('支援', { exact: true })).toBeVisible();
    await expect(step1.getByText('タオルを渡す')).toBeVisible();

    // ステップ2: 朝の会 (Row 2)
    const step2 = page.locator('[data-row-no="2"]').first();
    await expect(step2.getByText('本人', { exact: true })).toBeVisible();
    await expect(step2.getByText('本人AMテスト')).toBeVisible();
    await expect(step2.getByText('支援', { exact: true })).toBeVisible();
    await expect(step2.getByText('支援者AMテスト')).toBeVisible();
    expectSharePointStubEvidence(stubEvidence);
  });

  test('backward compatibility: legacy text aggregation', async ({ page }) => {
    const stubEvidence = await primeProcedureEnv(page);

    // 1. 支援計画シートエディタで構造化手順を削除し、古いテキストフィールドのみ埋める
    await openPlanningSheetEditor(page);
    
    // 概要タブの必須フィールド
    await page.getByRole('tab', { name: '概要' }).click();
    await page.getByLabel('行動観察').fill('行動観察テスト');
    await page.getByLabel('分析・仮説').fill('分析・仮説テスト');
    await page.getByLabel('支援課題').fill('支援課題テスト');
    await page.getByLabel('対応方針').fill('テストの支援方針');
    await page.getByLabel('関わり方の具体策').fill('テストの具体策');
    
    // 支援設計タブでデフォルトのステップを削除
    await page.getByRole('tab', { name: '支援設計' }).click();
    const deleteButtons = await page.getByRole('button', { name: '削除' }).all();
    for (const btn of deleteButtons) {
      await btn.click();
    }

    // 保存
    await page.getByTestId('planning-sheet-btn-save').click();
    await expect(page.getByText('保存しました')).toBeVisible();

    // 2. 日次記録のウィザードで反映を確認
    await startDailyWizard(page);
    
    // AM日中活動行 (Row 5) に集約されているか確認
    const step5 = page.locator('[data-row-no="5"]').first();
    await expect(step5).toBeVisible();
    await expect(step5.getByText('支援', { exact: true })).toBeVisible();
    await expect(step5.getByText(/テストの具体策/)).toBeVisible();
    await expect(step5.getByText('本人', { exact: true })).toBeVisible();
    await expect(step5.getByText(/テストの支援方針/)).toBeVisible();
    expectSharePointStubEvidence(stubEvidence);
  });
});
