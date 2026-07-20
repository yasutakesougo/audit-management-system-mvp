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
      allowedRequestFailures: [/__vite_ping/i, /net::ERR_ABORTED/i],
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
