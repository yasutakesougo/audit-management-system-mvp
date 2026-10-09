import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { toLocalDateISO } from '../../src/utils/getNow';
import { setupKioskReleaseContracts } from './_helpers/kioskReleaseContracts';

type KioskReleaseContracts = Awaited<ReturnType<typeof setupKioskReleaseContracts>>;

let contract: KioskReleaseContracts | undefined;

test.describe('Kiosk Procedure Detail', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    contract = await setupKioskReleaseContracts(page, testInfo, {
      allowedRequestFailures: [
        {
          method: 'POST',
          operation: 'requestfailed',
          resourceType: 'fetch',
          errorText: /net::ERR_ABORTED/i,
          url: /_api\/web\/lists\/getbytitle\('DailyRecordRows'\)\/items/i,
        },
      ],
    });

    // 直接 ID: 3 の利用者の最初の手順詳細に遷移する
    await bootKiosk(page, { route: '/kiosk/users/3/procedures/0', userId: '3' });
    
    // 詳細画面が表示されるのを待つ
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    if (!contract) {
      return;
    }

    await contract.assertNoFailures();
    await page.waitForLoadState('load');
    contract = undefined;
  });

  test('should display procedure details and navigate back', async ({ page }) => {
    // 利用者名が表示されているか
    await expect(page.locator('h1')).toContainText('塩田 裕貴');
    
    // 本人と支援者のセクションがあるか
    await expect(page.getByText('本人のすること')).toBeVisible();
    await expect(page.getByText('支援者がすること')).toBeVisible();
    
    // 主操作ボタンが存在するか
    await expect(page.getByRole('button', { name: '記録を保存する' })).toBeVisible();

    // 戻るボタンで一覧に戻れるか
    await page.getByTestId('kiosk-procedure-detail-back').click();
    await expect(page.getByText('の支援手順')).toBeVisible();
  });

  test('should save procedure record and reflect in list', async ({ page }) => {
    // 観察パネルが表示されることを確認
    await expect(page.getByTestId('kiosk-observation-panel')).toBeVisible();

    // 1. 自由記述メモを入力（バリデーション回避のため1つ以上入力が必要）
    await page.getByTestId('kiosk-observation-memo').fill('E2E保存確認');

    // 2. 「記録を保存する」ボタンをクリック（data-testidを使用）
    await page.getByTestId('kiosk-observation-submit').click();

    // 成功メッセージが表示されるのを待つ（タイムアウトに注意）
    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/kiosk\/users\/3\/procedures\/?(\?.*)?/);

    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(page.getByText('実施状況: 1 / 17')).toBeVisible();
  });

  test('should propagate date URL parameter to detail and back on save', async ({ page }) => {
    await bootKiosk(page, { route: '/kiosk/users/3/procedures/0?date=2026-05-07', userId: '3' });
    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/kiosk\/users\/3\/procedures\/0\?date=2026-05-07/);

    await page.getByTestId('kiosk-observation-memo').fill('E2E過去日保存確認');
    await page.getByTestId('kiosk-observation-submit').click();

    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/kiosk\/users\/3\/procedures\?date=2026-05-07/);
    await expect(page.getByText('2026年5月7日 の支援手順')).toBeVisible({ timeout: 10000 });
  });

  test('should save second procedure without colliding with first procedure record', async ({ page }) => {
    const today = toLocalDateISO(new Date());

    // 1. SharePoint stubsを登録
    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 12345, Title: 'Mock User' } },
      fallback: { status: 200, body: { value: [] } },
      lists: [
        {
          name: 'Users_Master',
          items: [
            { Id: 23, UserID: 'U-023', FullName: '桂川 進太朗' }
          ]
        },
        {
          name: 'SupportRecord_Daily',
          items: [
            {
              Id: 1,
              Title: `${today}-U-023`,
              RecordDate: today,
            }
          ]
        },
        {
          name: 'DailyRecordRows',
          items: [
            {
              Id: 1,
              Title: `${today}-U-023-1`,
              Parent_x0020_ID: 1,
              User_x0020_ID: 'U-023',
              Status: 'completed',
              Recorded_x0020_At: new Date().toISOString(),
              RowNo: '1',
            }
          ]
        }
      ]
    });

    // 2. 1番目の手順(scheduleItemId: '1')が完了した状態で2番目の手順(/procedures/1)の詳細画面に直接遷移する
    await bootKiosk(page, {
      route: '/kiosk/users/23/procedures/1?provider=sharepoint',
      userId: '23',
      records: [
        { scheduleItemId: '1', status: 'completed' }
      ],
      envOverrides: {
        VITE_SKIP_SHAREPOINT: '0',
        VITE_FORCE_SHAREPOINT: '1'
      }
    });

    await expect(page.getByText('本人のすること')).toBeVisible({ timeout: 10000 });

    // 3. メモを入力して保存
    await page.getByTestId('kiosk-observation-memo').fill('2番目の手順のメモ');

    // 保存時のリクエストを傍受して、TitleとRowNoが正しいか検証する
    let savedRequestPayload: any = null;
    page.on('request', request => {
      if (request.url().includes('items') && request.method() === 'POST') {
        try {
          const data = JSON.parse(request.postData() || '{}');
          if (data.Title || data.RowNo || data.cr013_rowNo) {
            savedRequestPayload = data;
          }
        } catch {
          // ignore parsing error
        }
      }
    });

    await page.getByTestId('kiosk-observation-submit').click();

    // 4. 一覧画面に戻り、1番目と2番目の手順の両方が記録済みになっていることを確認する
    await expect(page.getByText('記録を保存しました')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/.*\/kiosk\/users\/23\/procedures\/?(\?.*)?/);

    // 1番目と2番目のカードがともに記録済み
    const firstCard = page.locator('[data-testid="kiosk-procedure-card-0"]');
    const secondCard = page.locator('[data-testid="kiosk-procedure-card-1"]');
    await expect(firstCard.getByText('記録済み')).toBeVisible();
    await expect(secondCard.getByText('記録済み')).toBeVisible();

    // 進捗が 2 / 17 になっていることを確認
    await expect(page.getByText('実施状況: 2 / 17')).toBeVisible();

    // 5. ページをリロードして、再取得後も記録済みが維持されることを確認
    await page.reload();
    await expect(firstCard.getByText('記録済み')).toBeVisible({ timeout: 10000 });
    await expect(secondCard.getByText('記録済み')).toBeVisible();
    await expect(page.getByText('実施状況: 2 / 17')).toBeVisible({ timeout: 10000 });

    // 6. 保存されたリクエストのTitleが期待通りかアサート
    console.log('Saved Request Payload:', JSON.stringify(savedRequestPayload));
    if (savedRequestPayload) {
      expect(savedRequestPayload.Title).toContain('U-023-procedure-2');
      expect(savedRequestPayload.User_x0020_ID).toBe('U-023');
      const rowNoKey = Object.keys(savedRequestPayload).find(k => k.toLowerCase().includes('rowno'));
      if (rowNoKey) {
        expect(savedRequestPayload[rowNoKey]).toBe(2);
      }
    }
  });
});

// Synthetic SharePoint HTTP acceptance. The boot helper clears browser storage
// on every document load; only the HTTP stub's parent/child state survives reload.
// This proves repository readback, not persistence in the production tenant.
test.describe('Kiosk user 6 SharePoint persistence', () => {
  for (const legacySlot of [undefined, '1', 'row-1']) {
    test(`save and reload observation content (${legacySlot ?? 'new record'})`, async ({ page }, testInfo) => {
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(String(error)));
      const date = '2026-10-09';
      const memo = '合成E2E記録: 利用者6の保存・再取得確認';
      const serializedMemo = `【様子】落ち着いていた\n【対応】見守り\n【変化】改善した\n【メモ】${memo}`;
      const parentFields = ['Title', 'RecordDate', 'ReporterName', 'ReporterRole', 'User_x0020_Rows_x0020_JSON', 'UserCount'];
      const rowFields = ['Title', 'Parent_x0020_ID', 'User_x0020_ID', 'Status', 'Payload', 'Recorded_x0020_At', 'RowNo', 'Memo', 'StaffName', 'BipsJSON'];
      const writes: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
      page.on('request', request => {
        if (!['POST', 'PATCH'].includes(request.method())) return;
        const path = decodeURIComponent(new URL(request.url()).pathname);
        if (!/getbytitle\('(SupportRecord_Daily|DailyRecordRows)'\)\/items/.test(path)) return;
        writes.push({
          method: request.headers()['x-http-method'] ?? request.method(),
          path,
          body: request.postDataJSON() as Record<string, unknown>,
        });
      });

      await setupSharePointStubs(page, {
        currentUser: { status: 200, body: { Id: 12345, Title: 'Synthetic E2E Staff' } },
        fallback: { status: 200, body: { value: [] } },
        lists: [
          {
            name: 'Users_Master',
            items: [{ Id: 6, UserID: 'I005', FullName: '合成利用者6', IsActive: true, UsageStatus: '利用中', ServiceStartDate: '2026-01-01' }],
          },
          {
            name: 'SupportRecord_Daily',
            fields: parentFields.map(InternalName => ({ InternalName })),
            items: legacySlot ? [{ Id: 60, Title: `${date}-I005`, RecordDate: date }] : [],
          },
          {
            name: 'DailyRecordRows',
            fields: rowFields.map(InternalName => ({ InternalName })),
            items: legacySlot ? [{
              Id: 61,
              Title: `${date}-I005-${legacySlot}`,
              Parent_x0020_ID: 60,
              User_x0020_ID: 'I005',
              Status: 'completed',
              RowNo: 1,
              Memo: '既存の合成記録',
              Payload: '既存の合成記録',
              Recorded_x0020_At: '2026-10-09T00:00:00.000Z',
            }] : [],
          },
        ],
      });
      await bootKiosk(page, {
        route: `/kiosk/users/6/procedures?date=${date}&provider=sharepoint`,
        userId: '6',
        procedures: [
          { id: 'procedure-1', time: '09:30', activity: '合成手順1', instruction: '合成支援1' },
          { id: 'procedure-2', time: '10:00', activity: '合成手順2', instruction: '合成支援2' },
        ],
        envOverrides: {
          VITE_SKIP_SHAREPOINT: '0',
          VITE_FORCE_SHAREPOINT: '1',
          VITE_FORCE_DEMO: '0',
          VITE_DEMO_MODE: '0',
          VITE_SKIP_LOGIN: '0',
        },
        storageOverrides: { demo: '0', skipLogin: '0' },
      });

      await expect(page.locator('#app-main-container')).toHaveAttribute('data-provider', 'sharepoint');
      await expect(page.locator('h1')).toContainText('合成利用者6');
      const firstCard = page.getByTestId('kiosk-procedure-card-0');
      const secondCard = page.getByTestId('kiosk-procedure-card-1');
      await firstCard.click();
      await expect(page.getByTestId('kiosk-observation-submit')).toBeEnabled();
      await expect(page.getByTestId('kiosk-observation-memo')).toHaveValue(legacySlot ? '既存の合成記録' : '');
      await page.getByTestId('mood-chip-落ち着いていた').click();
      await page.getByTestId('action-chip-見守り').click();
      await page.getByTestId('result-chip-改善した').click();
      await page.getByTestId('kiosk-observation-memo').fill(memo);
      await page.getByTestId('kiosk-observation-submit').click();
      await expect(page.getByText('記録を保存しました')).toBeVisible();
      await expect(page).toHaveURL(/\/kiosk\/users\/6\/procedures\?date=2026-10-09&provider=sharepoint$/);
      await expect(firstCard.getByText('記録済み', { exact: true })).toBeVisible();
      await expect(page.getByTestId('kiosk-procedure-record-summary-0-memo')).toContainText(memo);
      await expect(secondCard.getByText('未実施', { exact: true })).toBeVisible();

      const readback = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === 'GET' &&
          decodeURIComponent(url.pathname).endsWith("getbytitle('DailyRecordRows')/items") &&
          url.searchParams.get('$filter')?.includes('Parent_x0020_ID eq') === true;
      });
      await page.reload();
      const readbackResponse = await readback;
      expect(readbackResponse.ok()).toBe(true);
      const persistedRows = (await readbackResponse.json()).value as Array<Record<string, unknown>>;
      expect(persistedRows).toHaveLength(1);
      expect(persistedRows[0]).toMatchObject({
        User_x0020_ID: 'I005',
        Status: 'completed',
        Memo: serializedMemo,
        RowNo: 1,
      });
      await expect(firstCard.getByText('記録済み', { exact: true })).toBeVisible();
      await expect(page.getByTestId('kiosk-procedure-record-summary-0-memo')).toContainText(memo);
      await expect(page.getByTestId('kiosk-procedure-record-summary-0-mood')).toContainText('落ち着いていた');
      await expect(page.getByTestId('kiosk-procedure-record-summary-0-action')).toContainText('見守り');
      await expect(page.getByTestId('kiosk-procedure-record-summary-0-result')).toContainText('改善した');
      await expect(secondCard.getByText('未実施', { exact: true })).toBeVisible();
      await firstCard.click();
      await expect(page.getByTestId('kiosk-observation-memo')).toHaveValue(memo);
      await page.reload();
      await expect(page.getByTestId('kiosk-observation-memo')).toHaveValue(memo);
      await expect(page.getByTestId('kiosk-saved-record-summary-mood')).toContainText('落ち着いていた');
      await expect(page.getByTestId('kiosk-saved-record-summary-action')).toContainText('見守り');
      await expect(page.getByTestId('kiosk-saved-record-summary-result')).toContainText('改善した');

      const rowWrites = writes.filter(write => write.path.includes("getbytitle('DailyRecordRows')"));
      expect(rowWrites).toHaveLength(1);
      expect(rowWrites[0].method).toBe(legacySlot ? 'MERGE' : 'POST');
      expect(rowWrites[0].body).toMatchObject({ User_x0020_ID: 'I005', RowNo: 1, Memo: serializedMemo });
      expect(rowWrites[0].body.Title).toBe(`${date}-I005-${legacySlot ?? 'procedure-1'}`);
      if (legacySlot) {
        expect(rowWrites[0].path).toMatch(/\/items\(61\)$/);
        expect(writes.filter(write => write.path.includes("getbytitle('SupportRecord_Daily')"))).toHaveLength(0);
      }
      await testInfo.attach('synthetic-sharepoint-readback.json', {
        body: JSON.stringify({ legacySlot: legacySlot ?? null, writes, persistedRows }, null, 2),
        contentType: 'application/json',
      });
      expect(pageErrors).toEqual([]);
    });
  }
});
