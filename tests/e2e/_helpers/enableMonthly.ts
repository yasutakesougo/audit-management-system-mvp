import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, Page } from '@playwright/test';
import { setupPlaywrightEnv } from './setupPlaywrightEnv';

/**
 * Fixture ファイルのパス定義
 */
const MONTHLY_FIXTURE_DEV = resolve(
  process.cwd(),
  'tests/e2e/_fixtures/monthly.records.dev.v1.json'
);
const MONTHLY_FIXTURE_EMPTY = resolve(
  process.cwd(),
  'tests/e2e/_fixtures/monthly.records.empty.v1.json'
);

/**
 * E2E Seed データ型定義
 */
interface E2ESeedWindow extends Window {
  __E2E_SEED__?: string;
  __E2E_FIXTURE_MONTHLY_RECORDS__?: unknown;
}

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
 * @param page Playwright page object
 * @param opts.path カスタムパス（デフォルト: '/records/monthly'）。クエリパラメータも含められる
 * @param opts.debug ログを出力するか（デフォルト: false）
 * @param opts.seed E2E用デモシード設定
 */
export async function gotoMonthlyRecordsPage(
  page: Page,
  opts?: { path?: string; debug?: boolean; seed?: { monthlyRecords?: boolean | 'empty' } }
): Promise<void> {
  const path = opts?.path ?? '/records/monthly';
  const debug = opts?.debug ?? false;
  const seedType = opts?.seed?.monthlyRecords;

  // ===== Seed 注入（E2E限定） =====
  if (seedType) {
    const fixturePath = seedType === 'empty' ? MONTHLY_FIXTURE_EMPTY : MONTHLY_FIXTURE_DEV;
    const seedName = seedType === 'empty' ? 'monthly.records.empty.v1' : 'monthly.records.dev.v1';
    const seedJson = JSON.parse(readFileSync(fixturePath, 'utf-8'));

    await page.addInitScript((data) => {
      const w = window as E2ESeedWindow;
      w.__E2E_SEED__ = data.seedName;
      w.__E2E_FIXTURE_MONTHLY_RECORDS__ = data.seedJson;
    }, { seedName, seedJson });
  }

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

  await page.goto(path);

  // ルート到達とページの可視化を明示的に待つ（networkidle は CI で不安定なため使わない）
  await page.waitForURL(/\/records\/monthly/, { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);
  
  // ===== デバッグ: query が保持されているか確認（DEBUG時のみ） =====
  if (debug) {
    console.log(`[gotoMonthlyRecordsPage] after goto, url="${page.url()}"`);
  }

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
  detailKpiRoot: 'monthly-detail-kpi-root',
  detailRecordsTable: 'monthly-detail-records-table',
  detailEmptyState: 'monthly-detail-empty-state',
  pdfGenerateBtn: 'monthly-pdf-generate-btn',
} as const;

/**
 * 月次記録のタブ切り替えヘルパー（確定版）
 * 重要: aria-selected + panel hidden の両方を保証する
 * @param debug デバッグログを出力するか（デフォルト: false）
 */
export async function switchMonthlyTab(
  page: Page,
  tab: 'summary' | 'detail' | 'pdf',
  debug: boolean = false
): Promise<void> {
  // ===== デバッグ用: タブ一覧をダンプ（DEBUG時のみ） =====
  async function dumpTabs() {
    if (!debug) return;
    const tabs = page.getByRole('tab');
    const n = await tabs.count();
    console.log(`[monthly.switchMonthlyTab] tabs.count=${n}`);
    for (let i = 0; i < n; i++) {
      const t = tabs.nth(i);
      const name = (await t.textContent())?.trim() || '(empty)';
      const selected = await t.getAttribute('aria-selected');
      const controls = await t.getAttribute('aria-controls');
      console.log(
        `[monthly.switchMonthlyTab] tab[${i}] name="${name}" aria-selected=${selected} aria-controls=${controls}`
      );
    }
  }

  await dumpTabs();

  // ===== タブを特定（完全一致寄せ）=====
  const tabName = tab === 'summary' ? /^組織サマリー$/ : tab === 'detail' ? /^利用者別詳細$/ : /^月次PDF$/;

  const tabEl = page.getByRole('tab', { name: tabName });
  await expect(tabEl).toBeVisible({ timeout: 30_000 });

  if (debug) console.log(`[monthly.switchMonthlyTab] clicking tab="${tab}"`);
  await tabEl.click();

  // ✅ 超重要：クリック後に「選択された」状態を待つ
  if (debug) console.log(`[monthly.switchMonthlyTab] waiting for aria-selected="true"`);
  await expect(tabEl).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });

  // ===== panel ID を取得 =====
  const panelId = await tabEl.getAttribute('aria-controls');
  if (!panelId) {
    throw new Error(`[switchMonthlyTab] tab aria-controls not found for tab="${tab}"`);
  }
  if (debug) console.log(`[monthly.switchMonthlyTab] panelId="${panelId}"`);

  // ===== panel が hidden を外すまで待つ =====
  const panel = page.locator(`#${panelId}`);
  await expect(panel).toBeAttached({ timeout: 30_000 });
  if (debug) console.log(`[monthly.switchMonthlyTab] panel attached, waiting for hidden to be removed`);
  await expect(panel).not.toHaveAttribute('hidden', '', { timeout: 30_000 });
  if (debug) console.log(`[monthly.switchMonthlyTab] hidden removed, waiting for visible`);
  await expect(panel).toBeVisible({ timeout: 30_000 });

  if (debug) console.log(`[monthly.switchMonthlyTab] ✅ tab switch complete for tab="${tab}"`);
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
  
  // First check if element exists at all (more resilient to slow CI)
  await expect
    .poll(async () => status.count(), { timeout: 30_000, intervals: [1_000, 2_000, 5_000] })
    .toBeGreaterThan(0);
  
  // Then wait for visibility
  await expect(status.first()).toBeVisible({ timeout: 90_000 });

  // TODO: テキストが決まったら以下のような実装に変更
  // await expect(status).toHaveText(/最新です|完了/);
}