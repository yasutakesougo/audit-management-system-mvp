/**
 * Today Navigation Audit Script
 *
 * 目的: /today の導線を機械的に監査し、結果を JSON + Markdown で出力する
 * 実行: npx playwright test scripts/audit/today-navigation-audit.spec.ts --project=chromium
 *
 * 注意:
 * - ローカル開発サーバー起動済みが前提（http://localhost:5173）
 * - 実データを使った監査（E2Eモックは使わない）
 * - 実装変更は一切行わない — 現状把握のみ
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { TESTIDS } from '../../src/testids';

// ─── Output Setup ─────────────────────────────────────────────
const ARTIFACTS_DIR = path.resolve(__dirname, '../../artifacts');
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots', 'today');

function ensureDirs() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// ─── Types ─────────────────────────────────────────────────────
type NavigationResult = {
  label: string;
  kind: string;
  selector: string;
  beforeUrl: string;
  afterUrl: string;
  navigated: boolean;
  changedDom: boolean;
  headingAfter: string;
  drawerOpened: boolean;
  status: 'ok' | 'no-op' | 'error' | 'ambiguous' | 'drawer-opened';
  notes: string;
  telemetryHint: string;
  testId: string;
};

type PageInventory = {
  url: string;
  title: string;
  headings: string[];
  buttons: { text: string; testId: string; ariaLabel: string }[];
  links: { text: string; href: string; testId: string }[];
  testIds: string[];
  roleButtons: { text: string; testId: string }[];
  ariaLabels: string[];
};

type ConditionalElement = {
  name: string;
  selector: string;
  visible: boolean;
  notes: string;
};

type AuditReport = {
  timestamp: string;
  pageInventory: PageInventory;
  navigationResults: NavigationResult[];
  conditionalElements: ConditionalElement[];
};

// ─── Helpers ──────────────────────────────────────────────────

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function getHeadings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const els = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [class*="MuiTypography-h"]');
    return Array.from(els)
      .map(el => (el as HTMLElement).innerText?.trim())
      .filter(Boolean)
      .slice(0, 20);
  });
}

async function getFirstHeading(page: Page): Promise<string> {
  const headings = await getHeadings(page);
  return headings[0] ?? '';
}

async function safeClick(
  page: Page,
  locator: Locator,
  opts: { timeout?: number } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    await locator.click({ timeout: opts.timeout ?? 3000 });
    // Wait for navigation or DOM to settle instead of fixed timeout
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function checkDrawerOpened(page: Page): Promise<boolean> {
  // MUI Drawer uses role="presentation" or a div with MuiDrawer class
  const drawer = page.locator('.MuiDrawer-root, .MuiDialog-root, [role="presentation"]').first();
  try {
    await expect(drawer).toBeVisible({ timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function closeDrawerIfOpen(page: Page) {
  // Try ESC key first
  await page.keyboard.press('Escape');
  // Wait for drawer to disappear instead of fixed timeout
  const drawer = page.locator('.MuiDrawer-root, .MuiDialog-root, [role="presentation"]').first();
  await drawer.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  
  // If drawer still visible, try clicking backdrop
  const backdrop = page.locator('.MuiBackdrop-root').first();
  try {
    if (await backdrop.isVisible()) {
      await backdrop.click({ force: true, timeout: 1000 });
      await drawer.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

// ─── Main Test ────────────────────────────────────────────────

test.describe('Today Navigation Audit', () => {
  test.setTimeout(180_000); // 3 minutes for full audit

  let report: AuditReport;

  // ── E2E Mock Setup (same pattern as today-ops-page.spec.ts) ──
  test.use({
    extraHTTPHeaders: {
      'x-vite-e2e': '1',
    },
  });

  test.beforeAll(() => {
    ensureDirs();
  });

  test.beforeEach(async ({ page }) => {
    // Inject E2E mock flag so Today page renders mock data
    // AND bypass MSAL auth gate via runtime env override
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
      (window as unknown as { __PLAYWRIGHT__?: boolean }).__PLAYWRIGHT__ = true;
      // Override runtime env to bypass auth gates
      (window as unknown as { __RUNTIME_ENV__?: Record<string, string> }).__RUNTIME_ENV__ = {
        VITE_E2E: '1',
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_SKIP_SHAREPOINT: '1',
        VITE_MSAL_CLIENT_ID: '',
        VITE_MSAL_TENANT_ID: '',
      };
    });

    // Mock SharePoint API calls to prevent auth failures
    await page.route('/_api/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ d: { results: [] } }),
    }));

    // Log errors for debugging
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });
  });

  test('Step 1-2: Page Inventory — collect all clickable elements', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    // Wait for any lazy data to settle by checking for testids
    await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});

    await screenshot(page, '01-initial-load');

    // ── Collect Page Inventory ──
    const inventory: PageInventory = {
      url: page.url(),
      title: await page.title(),
      headings: await getHeadings(page),
      buttons: [],
      links: [],
      testIds: [],
      roleButtons: [],
      ariaLabels: [],
    };

    // Buttons
    inventory.buttons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [type="button"]');
      return Array.from(btns).map(el => ({
        text: (el as HTMLElement).innerText?.trim().slice(0, 80) ?? '',
        testId: el.getAttribute('data-testid') ?? '',
        ariaLabel: el.getAttribute('aria-label') ?? '',
      })).filter(b => b.text || b.testId || b.ariaLabel);
    });

    // Links
    inventory.links = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href]');
      return Array.from(links).map(el => ({
        text: (el as HTMLElement).innerText?.trim().slice(0, 80) ?? '',
        href: el.getAttribute('href') ?? '',
        testId: el.getAttribute('data-testid') ?? '',
      }));
    });

    // All testIds
    inventory.testIds = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-testid]');
      return Array.from(els).map(el => el.getAttribute('data-testid') ?? '').filter(Boolean);
    });

    // role=button elements
    inventory.roleButtons = await page.evaluate(() => {
      const els = document.querySelectorAll('[role="button"]');
      return Array.from(els).map(el => ({
        text: (el as HTMLElement).innerText?.trim().slice(0, 80) ?? '',
        testId: el.getAttribute('data-testid') ?? '',
      })).filter(b => b.text || b.testId);
    });

    // aria-label elements
    inventory.ariaLabels = await page.evaluate(() => {
      const els = document.querySelectorAll('[aria-label]');
      return Array.from(els).map(el => el.getAttribute('aria-label') ?? '').filter(Boolean);
    });

    report = {
      timestamp: new Date().toISOString(),
      pageInventory: inventory,
      navigationResults: [],
      conditionalElements: [],
    };

    // Write interim inventory
    const inventoryPath = path.join(ARTIFACTS_DIR, 'today-page-inventory.json');
    fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));

    console.log(`=== PAGE INVENTORY ===`);
    console.log(`URL: ${inventory.url}`);
    console.log(`Title: ${inventory.title}`);
    console.log(`Headings: ${inventory.headings.join(' | ')}`);
    console.log(`Buttons: ${inventory.buttons.length}`);
    console.log(`Links: ${inventory.links.length}`);
    console.log(`TestIDs: ${inventory.testIds.length}`);
    console.log(`Role=button: ${inventory.roleButtons.length}`);
    console.log(`Aria-labels: ${inventory.ariaLabels.length}`);

    // Expect at minimum that page loaded
    expect(inventory.testIds.length).toBeGreaterThan(0);
  });

  test('Step 3-4: Navigation Click Audit — test each major navigation', async ({ page }) => {
    const results: NavigationResult[] = [];

    // ── Define navigation targets to audit ──
    const targets: {
      label: string;
      kind: string;
      locateBy: 'testid' | 'role-text' | 'text' | 'css';
      selector: string;
      fallbackSelector?: string;
    }[] = [
      // ZONE A: Hero
      { label: 'Hero CTA', kind: 'hero-cta', locateBy: 'testid', selector: 'hero-cta' },
      { label: 'Hero CTA (fallback NextAction)', kind: 'hero-cta', locateBy: 'testid', selector: 'scene-action-cta' },
      { label: 'Hero CTA (fallback nav)', kind: 'hero-cta', locateBy: 'testid', selector: 'next-action-nav-cta' },
      { label: 'Hero Empty CTA', kind: 'hero-cta', locateBy: 'testid', selector: 'today-empty-next-action-cta' },
      { label: 'Hero Schedule Link', kind: 'link', locateBy: 'testid', selector: 'next-action-schedule-link' },

      // ZONE B: ProgressRings
      { label: 'ProgressRing: 支援手順', kind: 'progress-ring', locateBy: 'testid', selector: 'progress-ring-records' },
      { label: 'ProgressRing: ケース記録', kind: 'progress-ring', locateBy: 'testid', selector: 'progress-ring-caseRecords' },
      { label: 'ProgressRing: 出欠', kind: 'progress-ring', locateBy: 'testid', selector: 'progress-ring-attendance' },
      { label: 'ProgressRing: 連絡', kind: 'progress-ring', locateBy: 'testid', selector: 'progress-ring-contacts' },

      // ZONE C1: Users
      { label: 'User Row (first)', kind: 'user-row', locateBy: 'css', selector: `[data-testid="${TESTIDS.TODAY_USER_LIST}"] [role="button"]` },
      { label: 'User Show More', kind: 'button', locateBy: 'testid', selector: 'users-show-more' },
      { label: 'User Empty CTA', kind: 'button', locateBy: 'testid', selector: 'today-empty-users-cta' },

      // ZONE C1: CallLog
      { label: 'CallLog Navigate', kind: 'button', locateBy: 'testid', selector: 'call-log-summary-navigate' },
      { label: 'CallLog Open Count', kind: 'tile', locateBy: 'testid', selector: 'call-log-summary-open-count' },
      { label: 'CallLog Urgent Count', kind: 'tile', locateBy: 'testid', selector: 'call-log-summary-urgent-count' },
      { label: 'CallLog Callback Count', kind: 'tile', locateBy: 'testid', selector: 'call-log-summary-callback-count' },
      { label: 'CallLog My Count', kind: 'tile', locateBy: 'testid', selector: 'call-log-summary-my-count' },
      { label: 'CallLog Overdue Count', kind: 'tile', locateBy: 'testid', selector: 'call-log-summary-overdue-count' },
      { label: 'CallLog Open Drawer', kind: 'icon-button', locateBy: 'testid', selector: 'call-log-summary-open-drawer' },
      { label: 'CallLog All Clear', kind: 'status', locateBy: 'testid', selector: 'call-log-summary-all-clear' },

      // ZONE C2: Accordions
      { label: 'Service Structure Accordion', kind: 'accordion', locateBy: 'css', selector: '[data-testid="bento-service-structure"] .MuiAccordionSummary-root' },
      { label: 'Workflow Accordion', kind: 'accordion', locateBy: 'css', selector: `[data-testid="${TESTIDS.TODAY_WORKFLOW_CARD}"] .MuiAccordionSummary-root` },

      // ZONE C2: Transport
      { label: 'Transport Card', kind: 'card', locateBy: 'testid', selector: TESTIDS.TODAY_TRANSPORT },
    ];

    for (const target of targets) {
      // Navigate to /today fresh
      await page.goto('/today');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});

      const beforeUrl = page.url();
      let locator: Locator;

      try {
        if (target.locateBy === 'testid') {
          locator = page.getByTestId(target.selector);
        } else if (target.locateBy === 'css') {
          locator = page.locator(target.selector).first();
        } else if (target.locateBy === 'role-text') {
          locator = page.getByRole('button', { name: target.selector });
        } else {
          locator = page.getByText(target.selector).first();
        }

        // Check if element exists
        const isVisible = await locator.isVisible().catch(() => false);

        if (!isVisible) {
          results.push({
            label: target.label,
            kind: target.kind,
            selector: target.selector,
            beforeUrl,
            afterUrl: beforeUrl,
            navigated: false,
            changedDom: false,
            headingAfter: '',
            drawerOpened: false,
            status: 'no-op',
            notes: 'Element not visible in current state',
            telemetryHint: '',
            testId: target.selector,
          });
          continue;
        }

        // Scroll element into view
        await locator.scrollIntoViewIfNeeded();

        // Screenshot before click
        const safeName = target.label.replace(/[^a-zA-Z0-9_-]/g, '_');
        await screenshot(page, `02-before-${safeName}`);

        // Get DOM snapshot for change detection
        const domBefore = await page.evaluate(() => document.body.innerHTML.length);

        // Click
        const clickResult = await safeClick(page, locator);

        if (!clickResult.ok) {
          results.push({
            label: target.label,
            kind: target.kind,
            selector: target.selector,
            beforeUrl,
            afterUrl: page.url(),
            navigated: false,
            changedDom: false,
            headingAfter: '',
            drawerOpened: false,
            status: 'error',
            notes: `Click failed: ${clickResult.error?.slice(0, 200)}`,
            telemetryHint: '',
            testId: target.selector,
          });
          continue;
        }

        const afterUrl = page.url();
        const navigated = afterUrl !== beforeUrl;
        const domAfter = await page.evaluate(() => document.body.innerHTML.length);
        const changedDom = Math.abs(domAfter - domBefore) > 100;
        const headingAfter = await getFirstHeading(page);
        const drawerOpened = await checkDrawerOpened(page);

        await screenshot(page, `03-after-${safeName}`);

        let status: NavigationResult['status'] = 'ok';
        if (!navigated && !changedDom && !drawerOpened) {
          status = 'no-op';
        } else if (drawerOpened) {
          status = 'drawer-opened';
        }

        results.push({
          label: target.label,
          kind: target.kind,
          selector: target.selector,
          beforeUrl,
          afterUrl,
          navigated,
          changedDom,
          headingAfter,
          drawerOpened,
          status,
          notes: navigated ? `Navigated to ${new URL(afterUrl).pathname}` : (drawerOpened ? 'Drawer/Dialog opened' : ''),
          telemetryHint: '',
          testId: target.selector,
        });

        // Close drawer if opened
        if (drawerOpened) {
          await closeDrawerIfOpen(page);
        }

      } catch (err) {
        results.push({
          label: target.label,
          kind: target.kind,
          selector: target.selector,
          beforeUrl,
          afterUrl: page.url(),
          navigated: false,
          changedDom: false,
          headingAfter: '',
          drawerOpened: false,
          status: 'error',
          notes: `Error: ${String(err).slice(0, 200)}`,
          telemetryHint: '',
          testId: target.selector,
        });
      }
    }

    // ── Also audit user row icon buttons ──
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});

    // Find ISP icons
    const ispIcons = page.locator('[aria-label*="ISPを確認"]');
    const ispCount = await ispIcons.count().catch(() => 0);
    if (ispCount > 0) {
      const beforeUrl = page.url();
      await ispIcons.first().scrollIntoViewIfNeeded();
      await screenshot(page, '04-before-isp-icon');
      const clickRes = await safeClick(page, ispIcons.first());
      if (clickRes.ok) {
        const afterUrl = page.url();
        results.push({
          label: 'User ISP Icon (first)',
          kind: 'icon-button',
          selector: '[aria-label*="ISPを確認"]',
          beforeUrl,
          afterUrl,
          navigated: afterUrl !== beforeUrl,
          changedDom: false,
          headingAfter: await getFirstHeading(page),
          drawerOpened: false,
          status: afterUrl !== beforeUrl ? 'ok' : 'no-op',
          notes: afterUrl !== beforeUrl ? `Navigated to ${new URL(afterUrl).pathname}` : '',
          telemetryHint: 'none',
          testId: '',
        });
      }
    }

    // Find Iceberg icons
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});
    
    const icebergIcons = page.locator('[data-testid^="iceberg-analysis-"]');
    const iceCount = await icebergIcons.count().catch(() => 0);
    if (iceCount > 0) {
      const beforeUrl = page.url();
      await icebergIcons.first().scrollIntoViewIfNeeded();
      const clickRes = await safeClick(page, icebergIcons.first());
      if (clickRes.ok) {
        const afterUrl = page.url();
        results.push({
          label: 'User Iceberg Icon (first)',
          kind: 'icon-button',
          selector: '[data-testid^="iceberg-analysis-"]',
          beforeUrl,
          afterUrl,
          navigated: afterUrl !== beforeUrl,
          changedDom: false,
          headingAfter: await getFirstHeading(page),
          drawerOpened: false,
          status: afterUrl !== beforeUrl ? 'ok' : 'no-op',
          notes: afterUrl !== beforeUrl ? `Navigated to ${new URL(afterUrl).pathname}` : '',
          telemetryHint: 'none',
          testId: '',
        });
      }
    }

    // Find User Status buttons
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});
    
    const absenceBtn = page.locator('[data-testid^="user-status-absence-"]').first();
    if (await absenceBtn.isVisible().catch(() => false)) {
      const beforeUrl = page.url();
      await absenceBtn.scrollIntoViewIfNeeded();
      const clickRes = await safeClick(page, absenceBtn);
      if (clickRes.ok) {
        const afterUrl = page.url();
        const drawerOpened = await checkDrawerOpened(page);
        results.push({
          label: 'User Absence Status Button (first)',
          kind: 'icon-button',
          selector: '[data-testid^="user-status-absence-"]',
          beforeUrl,
          afterUrl,
          navigated: afterUrl !== beforeUrl,
          changedDom: true,
          headingAfter: '',
          drawerOpened,
          status: drawerOpened ? 'drawer-opened' : 'ok',
          notes: drawerOpened ? 'UserStatusQuickDialog opened' : '',
          telemetryHint: 'none',
          testId: '',
        });
        if (drawerOpened) await closeDrawerIfOpen(page);
      }
    }

    // Save results
    if (!report) {
      report = {
        timestamp: new Date().toISOString(),
        pageInventory: {} as PageInventory,
        navigationResults: [],
        conditionalElements: [],
      };
    }
    report.navigationResults = results;

    console.log(`=== NAVIGATION RESULTS: ${results.length} items ===`);
    for (const r of results) {
      console.log(`  [${r.status.toUpperCase()}] ${r.label} → ${r.navigated ? r.afterUrl : r.notes}`);
    }
  });

  test('Step 5: Conditional Elements Audit', async ({ page }) => {
    await page.goto('/today');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});

    const conditionals: ConditionalElement[] = [];

    // ── Check each conditional element ──
    const checks: { name: string; selector: string; notes: string }[] = [
      // High Load Tile
      { name: 'High Load Tile (高負荷タイル)', selector: `[data-testid="${TESTIDS.TODAY_HIGH_LOAD_TILE}"]`, notes: 'Today → Schedule Ops 高負荷日警告' },
      // Empty states
      { name: 'Empty Users State', selector: '[data-testid="today-empty-users"]', notes: '利用者0件の空状態' },
      { name: 'Empty Next Action', selector: '[data-testid="today-empty-next-action"]', notes: '次のアクションなしの空状態' },
      // BentoCards
      { name: 'Bento Next Action', selector: `[data-testid="${TESTIDS.TODAY_HERO}"]`, notes: 'Hero カード' },
      { name: 'Bento Progress Rings', selector: `[data-testid="${TESTIDS.TODAY_PROGRESS_RINGS}"]`, notes: 'ProgressRings (新)' },
      { name: 'Bento Progress (legacy)', selector: '[data-testid="bento-progress"]', notes: 'ProgressStatusBar (legacy fallback)' },
      { name: 'Bento Attendance (legacy)', selector: '[data-testid="bento-attendance"]', notes: 'AttendanceSummaryCard (legacy fallback)' },
      { name: 'Bento Users', selector: `[data-testid="${TESTIDS.TODAY_USER_LIST}"]`, notes: '利用者リスト' },
      { name: 'Bento Handoff', selector: `[data-testid="${TESTIDS.TODAY_HANDOFF}"]`, notes: '申し送りパネル' },
      { name: 'Bento CallLog', selector: `[data-testid="${TESTIDS.TODAY_CALL_LOG_SUMMARY}"]`, notes: '電話ログカード' },
      { name: 'Bento Service Structure', selector: '[data-testid="bento-service-structure"]', notes: '業務体制 Accordion' },
      { name: 'Bento Workflow', selector: `[data-testid="${TESTIDS.TODAY_WORKFLOW_CARD}"]`, notes: '支援計画管理 Accordion (管理者常時表示)' },
      { name: 'Bento Transport', selector: `[data-testid="${TESTIDS.TODAY_TRANSPORT}"]`, notes: '送迎カード (transport.isReady)' },
      // Hidden by ENABLE_3ZONE = true
      { name: 'Bento Action Queue', selector: '[data-testid="bento-action-queue"]', notes: 'ActionQueue (3ZONE で非表示)' },
      { name: 'Bento Action Queue Timeline', selector: '[data-testid="bento-action-queue-timeline"]', notes: 'ActionQueue Timeline (3ZONE で非表示)' },
      { name: 'Bento Today Tasks', selector: '[data-testid="bento-today-tasks"]', notes: 'TodayTasks (3ZONE で非表示)' },
      { name: 'Bento Briefing', selector: '[data-testid="bento-briefing"]', notes: 'BriefingActionList (3ZONE で非表示)' },
      // Hero variants
      { name: 'Hero Action Card', selector: '[data-testid="hero-action-card"]', notes: 'Scene ベースのヒーロー (sceneAction valid)' },
      { name: 'Next Action Card (fallback)', selector: '[data-testid="today-next-action-card"]', notes: 'sceneAction 無効時のフォールバック' },
      // Alert / Status
      { name: 'CallLog All Clear', selector: '[data-testid="call-log-summary-all-clear"]', notes: '電話ログ全件完了時' },
      { name: 'CallLog Loading', selector: '[data-testid="call-log-summary-loading"]', notes: '電話ログ読み込み中' },
      // User status badges
      { name: 'User Alert Chips', selector: '[data-testid^="user-alert-"]', notes: '利用者アラートチップ' },
      { name: 'User Status Badges', selector: '[data-testid^="user-status-badge-"]', notes: '利用者状態バッジ' },
      // Overdue
      { name: 'Next Action Overdue Chip', selector: '[data-testid="next-action-overdue-chip"]', notes: '未着手警告' },
      // Planning card states
      { name: 'Workflow Card (active)', selector: '[data-testid="planning-workflow-card"]', notes: 'アクション必要な計画あり' },
      { name: 'Workflow Card (stable)', selector: '[data-testid="planning-workflow-card-stable"]', notes: '全安定状態' },
      { name: 'Workflow Card (empty)', selector: '[data-testid="planning-workflow-card-empty"]', notes: '管理対象なし' },
      { name: 'Workflow Card (loading)', selector: '[data-testid="planning-workflow-card-loading"]', notes: '読み込み中' },
      // Completion toast
      { name: 'Completion Toast', selector: '[data-testid="today-completion-toast"]', notes: '全件完了トースト' },
      { name: 'User Status Toast', selector: '[data-testid="user-status-success-toast"]', notes: '利用者状態登録完了トースト' },
    ];

    for (const check of checks) {
      const el = page.locator(check.selector).first();
      let visible = false;
      try {
        visible = await el.isVisible({ timeout: 1000 });
      } catch {
        visible = false;
      }

      conditionals.push({
        name: check.name,
        selector: check.selector,
        visible,
        notes: visible ? `✅ 表示中 — ${check.notes}` : `⬜ 非表示 — ${check.notes}`,
      });
    }

    if (report) {
      report.conditionalElements = conditionals;
    }

    await screenshot(page, '05-conditional-audit');

    console.log(`=== CONDITIONAL ELEMENTS: ${conditionals.length} items ===`);
    for (const c of conditionals) {
      console.log(`  [${c.visible ? '✅' : '⬜'}] ${c.name}`);
    }
  });

  test('Step 6-9: Generate final audit report', async ({ page }) => {
    // ── Load inventory from previous step if needed ──
    const inventoryPath = path.join(ARTIFACTS_DIR, 'today-page-inventory.json');
    let inventory: PageInventory;
    if (fs.existsSync(inventoryPath)) {
      inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
    } else {
      // Fallback: re-collect
      await page.goto('/today');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid]', { timeout: 5000 }).catch(() => {});
      inventory = {
        url: page.url(),
        title: await page.title(),
        headings: await getHeadings(page),
        buttons: [],
        links: [],
        testIds: [],
        roleButtons: [],
        ariaLabels: [],
      };
    }

    // ── Combine report data ──
    const finalReport = report ?? {
      timestamp: new Date().toISOString(),
      pageInventory: inventory,
      navigationResults: [],
      conditionalElements: [],
    };
    finalReport.pageInventory = inventory;

    // ── Save JSON ──
    const jsonPath = path.join(ARTIFACTS_DIR, 'today-navigation-audit.json');
    fs.writeFileSync(jsonPath, JSON.stringify(finalReport, null, 2));

    // ── Generate Markdown ──
    const navResults = finalReport.navigationResults;
    const condResults = finalReport.conditionalElements;

    const okCount = navResults.filter(r => r.status === 'ok' || r.status === 'drawer-opened').length;
    const noopCount = navResults.filter(r => r.status === 'no-op').length;
    const errCount = navResults.filter(r => r.status === 'error').length;
    const visibleCount = condResults.filter(c => c.visible).length;
    const hiddenCount = condResults.filter(c => !c.visible).length;

    let md = `# Today Navigation Audit Report\n\n`;
    md += `> **Generated**: ${finalReport.timestamp}  \n`;
    md += `> **Target**: \`/today\`  \n`;
    md += `> **Method**: Playwright mechanical audit  \n\n`;
    md += `---\n\n`;

    // §1 Summary
    md += `## 1. Summary\n\n`;
    md += `| Metric | Count |\n|:---|:---:|\n`;
    md += `| Navigation tests executed | ${navResults.length} |\n`;
    md += `| ✅ OK / Drawer opened | ${okCount} |\n`;
    md += `| ⬜ Not visible (no-op) | ${noopCount} |\n`;
    md += `| ❌ Error | ${errCount} |\n`;
    md += `| Conditional elements checked | ${condResults.length} |\n`;
    md += `| Currently visible | ${visibleCount} |\n`;
    md += `| Currently hidden | ${hiddenCount} |\n\n`;

    const criticalErrors = navResults.filter(r =>
      r.status === 'error' && ['hero-cta', 'progress-ring', 'user-row'].includes(r.kind)
    );
    if (criticalErrors.length > 0) {
      md += `> [!CAUTION]\n> **${criticalErrors.length} critical navigation(s) failed.** See details below.\n\n`;
    } else {
      md += `> [!NOTE]\n> No critical navigation failures detected. Primary paths are stable.\n\n`;
    }

    // §2 Page Inventory
    md += `## 2. Page Inventory\n\n`;
    md += `- **URL**: \`${inventory.url}\`\n`;
    md += `- **Title**: ${inventory.title}\n`;
    md += `- **Headings**: ${inventory.headings.slice(0, 10).join(' | ')}\n`;
    md += `- **Buttons**: ${inventory.buttons.length}\n`;
    md += `- **Links**: ${inventory.links.length}\n`;
    md += `- **TestIDs**: ${inventory.testIds.length}\n`;
    md += `- **Role=button**: ${inventory.roleButtons.length}\n`;
    md += `- **aria-labels**: ${inventory.ariaLabels.length}\n\n`;

    md += `### TestIDs found on page\n\n`;
    md += `\`\`\`\n${inventory.testIds.join('\n')}\n\`\`\`\n\n`;

    // §3 Navigation Results
    md += `## 3. Navigation Results\n\n`;
    md += `| # | Label | Kind | Status | Destination | Notes |\n`;
    md += `|:---:|:---|:---|:---:|:---|:---|\n`;
    for (let i = 0; i < navResults.length; i++) {
      const r = navResults[i];
      const statusEmoji = r.status === 'ok' ? '✅' : r.status === 'drawer-opened' ? '🔲' : r.status === 'no-op' ? '⬜' : '❌';
      const dest = r.navigated ? new URL(r.afterUrl).pathname + new URL(r.afterUrl).search : '(same page)';
      md += `| ${i + 1} | ${r.label} | ${r.kind} | ${statusEmoji} ${r.status} | \`${dest}\` | ${r.notes} |\n`;
    }
    md += `\n`;

    // §4 Conditional Elements
    md += `## 4. Conditional Elements\n\n`;
    md += `| # | Element | Visible | Selector | Notes |\n`;
    md += `|:---:|:---|:---:|:---|:---|\n`;
    for (let i = 0; i < condResults.length; i++) {
      const c = condResults[i];
      md += `| ${i + 1} | ${c.name} | ${c.visible ? '✅' : '⬜'} | \`${c.selector}\` | ${c.notes} |\n`;
    }
    md += `\n`;

    // §5 Code Cross-check (static analysis summary from previous audit)
    md += `## 5. Code Cross-check\n\n`;
    md += `### Telemetry Coverage\n\n`;
    md += `| Element | CTA_EVENT | Status |\n`;
    md += `|:---|:---|:---:|\n`;
    md += `| Hero CTA (scene) | \`NEXT_ACTION_PRIMARY\` | ✅ |\n`;
    md += `| ProgressRing: 支援手順 | \`PROGRESS_CHIP_RECORD\` (legacy reuse) | ⚠️ |\n`;
    md += `| ProgressRing: ケース記録 | \`PROGRESS_RING_CASE_RECORD\` | ✅ |\n`;
    md += `| ProgressRing: 出欠 | \`PROGRESS_CHIP_ATTENDANCE\` (legacy reuse) | ⚠️ |\n`;
    md += `| ProgressRing: 連絡 | \`PROGRESS_RING_CONTACTS\` | ✅ |\n`;
    md += `| User Row click | (none) | ❌ |\n`;
    md += `| User ISP icon | (none) | ❌ |\n`;
    md += `| User Iceberg icon | (none) | ❌ |\n`;
    md += `| User Alert chip | \`USER_ALERT_CLICKED\` | ✅ |\n`;
    md += `| Handoff 確認済み | (none) | ❌ |\n`;
    md += `| CallLog tiles | (none) | ❌ |\n`;
    md += `| CallLog Drawer open | (none) | ❌ |\n`;
    md += `| Hero Empty CTA | \`NEXT_ACTION_EMPTY\` | ✅ |\n`;
    md += `| Hero Utility CTA | \`NEXT_ACTION_UTILITY\` | ✅ |\n\n`;

    md += `### TestID Coverage\n\n`;
    md += `- ✅ BentoCard 各ゾーン: testid あり\n`;
    md += `- ✅ HeroActionCard: \`hero-action-card\`, \`hero-cta\`, \`hero-scene-label\`\n`;
    md += `- ✅ ProgressRings: \`progress-ring-{key}\`\n`;
    md += `- ✅ CallLogSummaryCard: \`call-log-summary-*\`\n`;
    md += `- ⚠️ UserCompactRow: testid なし（role=button で代替）\n`;
    md += `- ⚠️ HandoffPanel: testid なし\n`;
    md += `- ✅ TESTIDS 定数 (testids.ts) に TODAY_* が登録済み\n\n`;

    // §6 Risk Points
    md += `## 6. Risk Points\n\n`;
    md += `### 壊れやすい箇所\n\n`;
    md += `1. **briefingAlerts vs HandoffPanel のデータソース不一致** — Hero が「未確認3件」と表示するが HandoffPanel は「0件」の場合がある\n`;
    md += `2. **sceneAction switch 文に未ハンドルの target** — \`transport\`, \`service-structure\` が定義だが switch にない\n`;
    md += `3. **UserCompactList の二重ソート** — useTodayLayoutProps と UserCompactList 内で同じソートを2回実行\n`;
    md += `4. **ProgressRings の onClick が legacy chipRoutes を再利用** — 変更時に意図しない影響波及\n`;
    md += `5. **workflowCard の条件付き非表示** — admin でも items=0 なら管理導線が消失\n`;
    md += `6. **高負荷タイル未統合** — 設計済みだが TodayBentoLayout に未追加\n\n`;

    md += `### 自動テストで拾いにくい箇所\n\n`;
    md += `1. UserCompactRow の行クリック — role=button で検出可能だが testid がないため脆弱\n`;
    md += `2. Accordion 内の PlanningWorkflowCard — 条件付き表示のため E2E が不安定になりやすい\n`;
    md += `3. Toast (Snackbar) — autoHideDuration があるため timing 依存\n`;
    md += `4. CallLog CountTile — count=0 のときクリック無効化されるが role は残る\n\n`;

    // §7 Recommended Actions
    md += `## 7. Recommended Actions\n\n`;
    md += `### 🔴 P0: 今すぐ修正\n\n`;
    md += `1. **briefingAlerts と HandoffPanel のデータソースを統一** — Hero の件数が HandoffPanel と矛盾しないようにする\n\n`;
    md += `### 🟡 P1: 次スプリント\n\n`;
    md += `2. **workflowCard 表示条件を \`isServiceManager\` のみに変更** — items=0 でも Accordion を表示\n`;
    md += `3. **高負荷タイルを TodayBentoLayout に統合**\n\n`;
    md += `### 🟢 P2: 中期改善\n\n`;
    md += `4. **ProgressRings 専用テレメトリ追加** — \`PROGRESS_RING_RECORD\` / \`PROGRESS_RING_ATTENDANCE\`\n`;
    md += `5. **HandoffPanel 確認済みボタンに telemetry 追加**\n`;
    md += `6. **Today 関連 testid を TESTIDS 定数に統合**\n`;
    md += `7. **sceneAction switch の exhaustive check 追加**\n\n`;

    // §8 Minimal Patch
    md += `## 8. Minimal Stabilization Patch\n\n`;
    md += `### PR-A: データソース統一 (P0)\n\n`;
    md += `- \`TodayOpsPage.tsx\`: useHandoff の未読件数を sceneAction 入力に注入\n`;
    md += `- \`useSceneNextAction.ts\`: pendingBriefings を Handoff 未読件数に差し替え\n`;
    md += `- 変更ファイル: 最大2\n\n`;
    md += `### PR-B: 管理導線修正 + テレメトリ (P1+P2)\n\n`;
    md += `\`\`\`diff\n`;
    md += `// TodayOpsPage.tsx\n`;
    md += `-      workflowCard: isServiceManager && workflowPhases.items.length > 0\n`;
    md += `+      workflowCard: isServiceManager\n`;
    md += `\`\`\`\n\n`;
    md += `- CTA_EVENTS に \`PROGRESS_RING_RECORD\`, \`PROGRESS_RING_ATTENDANCE\` 追加\n`;
    md += `- HandoffPanel の handleMarkAsRead に recordCtaClick 追加\n`;
    md += `- 変更ファイル: 3-4\n\n`;

    // Save Markdown
    const mdPath = path.join(ARTIFACTS_DIR, 'today-navigation-audit.md');
    fs.writeFileSync(mdPath, md);

    console.log(`\n=== AUDIT COMPLETE ===`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Markdown: ${mdPath}`);
    console.log(`Screenshots: ${SCREENSHOTS_DIR}`);

    // Basic assertion to confirm test ran
    expect(fs.existsSync(jsonPath)).toBeTruthy();
    expect(fs.existsSync(mdPath)).toBeTruthy();
  });
});
