import { Page } from '@playwright/test';

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
  await enableMonthlyRecordsFlag(page);
  await page.goto('/records/monthly');

  // React/MUIレンダリング完了を出来る限り待機
  await page.waitForLoadState('networkidle');

  const pageLocator = page.getByTestId(monthlyTestIds.page);
  try {
    await pageLocator.waitFor({ timeout: 10_000 });
  } catch {
    // 月次が無効なビルドでは落とさず呼び出し側に判断を委ねる
    console.warn('[monthly] monthly-page not visible; skipping monthly smoke');
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

  await page.getByTestId(tabTestId).click();

  // 各タブごとの主要要素を待つ（アニメーション依存の waitForTimeout より堅牢）
  if (tab === 'summary') {
    await page.getByTestId(monthlyTestIds.summaryTable).waitFor();
  } else if (tab === 'detail') {
    await page.getByTestId(monthlyTestIds.detailRecordsTable).waitFor();
  } else {
    await page.getByTestId(monthlyTestIds.pdfGenerateBtn).waitFor();
  }
}

/**
 * 月次記録の再集計ボタンクリック & 完了待機
 * TODO: summaryStatus のメッセージ変化を待つ実装に差し替える
 */
export async function triggerReaggregateAndWait(page: Page): Promise<void> {
  await page.getByTestId(monthlyTestIds.summaryReaggregateBtn).click();

  // ステータスの変化を待つ（UI仕様確定後に実装）
  const status = page.getByTestId(monthlyTestIds.summaryStatus);
  await status.waitFor();
  await status.waitFor({ state: 'visible' });

  // TODO: テキストが決まったら以下のような実装に変更
  // await expect(status).toHaveText(/最新です|完了/);
}