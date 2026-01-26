import { Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

/**
 * 月次記録機能のFeature Flagを有効化
 * localStorage と環境変数の両方に対応
 */
export async function enableMonthlyRecordsFlag(page: Page): Promise<void> {
  const initScript = () => {
    // localStorage fallback を設定
    localStorage.setItem('feature:monthlyRecords', '1');

    // 開発環境用の環境変数も模擬設定
    const globalEnv = (window as Window & { __ENV__?: Record<string, string> }).__ENV__;
    if (globalEnv) {
      globalEnv.VITE_FEATURE_MONTHLY_RECORDS = '1';
    }
  };

  // 既に開いている page にも即反映させたいので両方に仕込む
  await page.context().addInitScript(initScript);
  await page.addInitScript(initScript);
}

/**
 * 月次記録機能のFeature Flagを無効化（テスト分離用）
 */
export async function disableMonthlyRecordsFlag(page: Page): Promise<void> {
  const initScript = () => {
    localStorage.removeItem('feature:monthlyRecords');

    const globalEnv = (window as Window & { __ENV__?: Record<string, string> }).__ENV__;
    if (globalEnv) {
      delete globalEnv.VITE_FEATURE_MONTHLY_RECORDS;
    }
  };

  // 既に開いている page にも即反映させたいので両方に仕込む
  await page.context().addInitScript(initScript);
  await page.addInitScript(initScript);
}

/**
 * 月次記録ページに移動（Feature Flag 有効化込み）
 */
export async function gotoMonthlyRecordsPage(page: Page): Promise<void> {
  await setupPlaywrightEnv(page, {
    envOverrides: {
      VITE_FEATURE_MONTHLY_RECORDS: '1',
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
      VITE_MSAL_TENANT_ID: 'common',
      VITE_SKIP_LOGIN: '1',
    },
    storageOverrides: {
      'feature:monthlyRecords': '1',
      skipLogin: '1',
    },
  });
  await enableMonthlyRecordsFlag(page);

  // Capture browser errors to diagnose blank screens
  page.on('pageerror', (err) => console.error('[pageerror]', err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[console.error]', msg.text());
    }
  });

  await page.goto('/records/monthly');

  // ルート到達とページの可視化を明示的に待つ（networkidle は CI で不安定なため使わない）
  await page.waitForURL(/\/records\/monthly/, { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  const monthlyRoot = page.getByTestId(monthlyTestIds.page);
  try {
    await monthlyRoot.waitFor({ state: 'visible', timeout: 30_000 });
  } catch (error) {
    const url = page.url();
    const title = await page.title().catch(() => '(title failed)');
    const monthlyPageCount = await monthlyRoot.count().catch(() => -1);
    const storage = await page
      .evaluate(() => ({
        monthlyFlag: localStorage.getItem('feature:monthlyRecords'),
        keys: Object.keys(localStorage),
      }))
      .catch(() => ({ monthlyFlag: null, keys: [] as string[] }));
    const testIds = await page
      .locator('[data-testid]')
      .evaluateAll((els) =>
        els
          .map((el) => (el as HTMLElement).dataset.testid)
          .filter(Boolean)
          .slice(0, 50),
      )
      .catch(() => [] as string[]);
    const bodyHead = await page.locator('body').innerText().then((t) => t.slice(0, 600)).catch(() => '');
    const htmlHead = await page.content().then((h) => h.slice(0, 1200)).catch(() => '');
    const rootInfo = await page
      .evaluate(() => {
        const root = document.querySelector('#root');
        return {
          hasRoot: !!root,
          rootChildCount: root ? root.childElementCount : -1,
          readyState: document.readyState,
        };
      })
      .catch(() => ({ hasRoot: false, rootChildCount: -1, readyState: 'eval-failed' as const }));
    console.error('[monthly] monthly-page wait failed', {
      url,
      title,
      monthlyPageCount,
      storage,
      testIds,
      bodyHead,
      htmlHead,
      rootInfo,
    });
    throw error;
  }
}

/**
 * 月次記録のテストIDを取得
 */
export const monthlyTestIds = {
  page: 'monthly-page',
  summaryTab: 'monthly-tab-summary',
  detailTab: 'monthly-tab-detail',
  pdfTab: 'monthly-tab-pdf',
  summaryTable: 'monthly-summary-table',
  summarySearch: 'monthly-summary-search',
  summaryMonthSelect: 'monthly-summary-month-select',
  summaryRateFilter: 'monthly-summary-rate-filter',
  summaryReaggregateBtn: 'monthly-summary-reaggregate-btn',
  summaryStatus: 'monthly-summary-status',
  detailUserSelect: 'monthly-detail-user-select',
  detailMonthSelect: 'monthly-detail-month-select',
  detailRecordsTable: 'monthly-detail-records-table',
  pdfGenerateBtn: 'monthly-pdf-generate-btn',
} as const;

/**
 * 月次記録のタブ切り替えヘルパー
 */
export async function switchMonthlyTab(page: Page, tab: 'summary' | 'detail' | 'pdf'): Promise<void> {
  const tabTestId = tab === 'summary' ? monthlyTestIds.summaryTab
                  : tab === 'detail' ? monthlyTestIds.detailTab
                  : monthlyTestIds.pdfTab;

  const tabElement = page.getByTestId(tabTestId);
  await tabElement.scrollIntoViewIfNeeded();
  await tabElement.click({ force: true });

  // 各タブごとの主要要素を待つ（アニメーション依存の waitForTimeout より堅牢）
  if (tab === 'summary') {
    const summaryEl = page.getByTestId(monthlyTestIds.summaryTable);
    await summaryEl.waitFor({ state: 'attached' });
    await summaryEl.waitFor({ state: 'visible' }).catch(() => undefined);
  } else if (tab === 'detail') {
    const detailEl = page.getByTestId(monthlyTestIds.detailRecordsTable);
    await detailEl.waitFor({ state: 'attached' });
    await detailEl.waitFor({ state: 'visible' }).catch(() => undefined);
  } else {
    const pdfEl = page.getByTestId(monthlyTestIds.pdfGenerateBtn);
    await pdfEl.waitFor({ state: 'attached' });
    await pdfEl.waitFor({ state: 'visible' }).catch(() => undefined);
  }
}

/**
 * 月次記録の再集計ボタンクリック & 完了待機
 * TODO: summaryStatus のメッセージ変化を待つ実装に差し替える
 */
export async function triggerReaggregateAndWait(page: Page): Promise<void> {
  const reaggregateBtn = page.getByTestId(monthlyTestIds.summaryReaggregateBtn);
  await reaggregateBtn.scrollIntoViewIfNeeded();
  await reaggregateBtn.click({ force: true });

  // ステータスの変化を待つ（UI仕様確定後に実装）
  const status = page.getByTestId(monthlyTestIds.summaryStatus);
  await status.waitFor();
  await status.waitFor({ state: 'visible' });

  // TODO: テキストが決まったら以下のような実装に変更
  // await expect(status).toHaveText(/最新です|完了/);
}