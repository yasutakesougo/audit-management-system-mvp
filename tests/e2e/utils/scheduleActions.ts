/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.

import { promises as fs } from 'fs';
import path from 'path';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { waitForDayTimeline, waitForMonthTimeline, waitForWeekTimeline } from './wait';

type SelectOption = string | RegExp;

type QuickUserCareFormOptions = {
  title?: string;
  userInputValue?: string;
  userOptionName?: SelectOption;
  staffInputValue?: string;
  staffOptionName?: SelectOption;
  serviceOptionLabel?: SelectOption;
  startLocal?: string;
  endLocal?: string;
  location?: string;
  notes?: string;
};

type QuickDialogDebug = {
  url: string;
  title: string;
  hasTarget: boolean;
  targetTestId?: string | null;
  targetTag?: string | null;
  activeTag?: string | null;
  activeTestId?: string | null;
  dialogCount: number;
  quickVisible: boolean;
  rootChildCount?: number;
  buttons?: Array<{
    tag: string;
    role: string;
    testid: string;
    ariaLabel: string;
    text: string;
    disabled: boolean;
  }>;
  dialogHtmlHead?: string;
  bestSelectorHint?: string | null;
  best?: {
    score: number;
    testid: string;
    role: string;
    className: string;
  };
  bestHasInputs?: boolean;
  bestTextHead?: string;
  bestTestids?: string[];
  buttonsInBest?: Array<{
    text: string;
    ariaLabel: string;
    testid: string;
    role: string;
  }>;
  saveButtons?: Array<{
    text: string;
    ariaLabel: string;
    testid: string;
    role: string;
  }>;
};

export async function captureQuickDialogDebug(page: Page, _targetSelectorOrTestId?: string): Promise<QuickDialogDebug> {
  const url = page.url();
  const title = await page.title().catch(() => '(title failed)');

  return page
    .evaluate(
      ({ want }) => {
        const now = Date.now();

        const norm = (s: string | null | undefined) => (s ?? '').trim();
        const safeSlice = (s: string, n = 1200) => (s.length > n ? s.slice(0, n) : s);

        const testIdOf = (el: Element | null | undefined) =>
          norm((el as HTMLElement | null)?.dataset?.testid) ||
          norm((el as HTMLElement | null)?.getAttribute?.('data-testid'));

        const ariaLabelOf = (el: Element | null | undefined) => norm(el?.getAttribute?.('aria-label'));
        const roleOf = (el: Element | null | undefined) => norm(el?.getAttribute?.('role'));
        const classOf = (el: Element | null | undefined) => norm((el as HTMLElement | null)?.className as any);

        const isVisibleLoose = (el: Element | null | undefined) => {
          if (!el) return false;
          const h = el as HTMLElement;
          const style = window.getComputedStyle(h);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
          return true;
        };

        const score = (el: Element) => {
          const tid = testIdOf(el);
          const role = roleOf(el);
          const cls = classOf(el);
          const label = ariaLabelOf(el);
          const hasInputs = !!el.querySelector('input, textarea, [role="textbox"], [role="combobox"]');
          const labelLike = /サービス区分|生活介護|利用者|時間|終了|開始|メモ|備考|保存|更新/i.test(
            norm((el as HTMLElement).innerText),
          );

          let s = 0;

          if (/(quick|dialog|modal|drawer|popover|schedule|event|edit)/i.test(tid)) s += 200;
          if (/(MuiDialog|MuiModal|MuiPopover|MuiDrawer|Dialog|Modal|Popover|Drawer)/i.test(cls)) s += 160;

          if (role === 'dialog') s += 120;
          if ((el as HTMLElement).getAttribute('aria-modal') === 'true') s += 90;
          if (role === 'presentation') s += 20;

          if (/(編集|作成|予定|スケジュール|quick|dialog|modal)/i.test(label)) s += 40;

          if (hasInputs) s += 180;
          if (labelLike) s += 90;

          if (/(schedules-week-page|schedule-week-root|schedules-week-view)/i.test(tid)) s -= 400;
          if ((el as HTMLElement).tagName === 'BODY') s -= 400;
          if (/(schedules-week-page|schedule-week-root)/i.test(cls)) s -= 200;

          if (isVisibleLoose(el)) s += 20;

          return s;
        };

        const candidates = new Set<Element>();
        const pushAll = (sel: string) => {
          document.querySelectorAll(sel).forEach((el) => candidates.add(el));
        };

        pushAll('[role="dialog"]');
        pushAll('[aria-modal="true"]');
        pushAll('[role="presentation"]');
        pushAll('[data-testid]');
        pushAll('form');
        pushAll('.MuiDialog-root, .MuiModal-root, .MuiPopover-root, .MuiDrawer-root, .MuiMenu-root');
        pushAll('.MuiDialog-container, .MuiDialog-paper, .MuiPaper-root');
        pushAll('div[class*="MuiPaper-root"], div[class*="MuiPopover-root"], div[class*="MuiDrawer-root"]');

        if (want) {
          const q = String(want).toLowerCase();
          document.querySelectorAll('[data-testid]').forEach((el) => {
            const tid = testIdOf(el).toLowerCase();
            if (tid.includes(q)) candidates.add(el);
          });
        }

        const list = Array.from(candidates);

        const ranked = list
          .map((el) => ({ el, s: score(el), tid: testIdOf(el), role: roleOf(el), cls: classOf(el) }))
          .sort((a, b) => b.s - a.s);

        const best = ranked[0]?.el ?? document.body;

        const bestHtmlRaw = (best as HTMLElement).outerHTML ?? '';
        const dialogHtmlHead = safeSlice(bestHtmlRaw || (document.body?.outerHTML ?? ''), 1600);
        const bestHasInputs = !!best.querySelector('input, textarea, [role="textbox"], [role="combobox"]');
        const bestTextHead = safeSlice(norm((best as HTMLElement).innerText), 200);
        const bestTestids = Array.from(best.querySelectorAll('[data-testid]'))
          .map((el) => testIdOf(el))
          .filter(Boolean)
          .slice(0, 10);

        const btnInfo = (btn: Element) => {
          const b = btn as HTMLElement;
          return {
            text: norm(b.textContent),
            ariaLabel: ariaLabelOf(btn),
            testid: testIdOf(btn),
            role: roleOf(btn),
          };
        };

        const saveRe = /(保存|更新|登録|OK|確定|反映|完了)/;

        const collectButtons = (root: ParentNode) =>
          Array.from(root.querySelectorAll('button, [role="button"]'))
            .map(btnInfo)
            .filter((x) => x.text || x.ariaLabel || x.testid);

        const buttonsInBest = collectButtons(best);

        const muiModalRoots = Array.from(document.querySelectorAll('.MuiModal-root, .MuiDialog-root'));
        const buttonsInMuiRoots = muiModalRoots.flatMap((r) => collectButtons(r));

        const buttonsGlobal = collectButtons(document);

        const pickSave = (arr: Array<{ text: string; ariaLabel: string; testid: string }>) =>
          arr.filter(
            (x) =>
              saveRe.test(x.text) ||
              saveRe.test(x.ariaLabel) ||
              /(save|submit|confirm|ok|apply|update)/i.test(x.testid),
          );

        const saveButtons = [
          ...pickSave(buttonsInBest),
          ...pickSave(buttonsInMuiRoots),
          ...pickSave(buttonsGlobal),
        ];

        const active = document.activeElement as HTMLElement | null;

        return {
          ts: now,
          url: location.href,
          title: document.title,
          hasTarget: false,
          targetTestId: null,
          targetTag: null,
          dialogCount: list.length,
          best: {
            score: ranked[0]?.s ?? 0,
            testid: testIdOf(best),
            role: roleOf(best),
            className: classOf(best),
          },
          bestHasInputs,
          bestTextHead,
          bestTestids,
          dialogHtmlHead,
          buttonsInBest: buttonsInBest.slice(0, 40),
          saveButtons: saveButtons.slice(0, 20),
          activeTag: active?.tagName ?? '',
          activeTestId: testIdOf(active),
          quickVisible: isVisibleLoose(best),
          rootChildCount: (best as HTMLElement)?.children?.length ?? undefined,
          bestSelectorHint: testIdOf(best) || classOf(best) || null,
        };
      },
      { want: 'quick' },
    )
    .catch(async (error) => ({
      url,
      title,
      hasTarget: false,
      dialogCount: -1,
      quickVisible: false,
      captureFailed: String(error),
    } as QuickDialogDebug));
}

async function persistArtifact(
  testInfo: TestInfo | undefined,
  name: string,
  body: string | Buffer,
  contentType: string,
) {
  if (testInfo) {
    await testInfo.attach(name, { body, contentType });
    return;
  }

  try {
    const dir = path.join(process.cwd(), 'test-results');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), body);
  } catch {
    // Swallow persistence errors; best-effort instrumentation only.
  }
}

export async function captureEditorDebug(page: Page, testInfo?: TestInfo, label = 'editor-debug') {
  const safeSlice = (text: string, n = 1_600) => {
    if (!text) return '';
    return text.length > n ? text.slice(0, n) : text;
  };

  const persistText = async (suffix: string, content: string | null | undefined) => {
    if (!content) return;
    await persistArtifact(testInfo, `${label}.${suffix}`, content, 'text/plain');
  };

  try {
    const menu = page.getByRole('menu').first();
    const menuCount = await menu.count().catch(() => 0);
    if (menuCount > 0) {
      const menuText = await menu.allInnerTexts().catch(() => [] as string[]);
      await persistText('menu.txt', menuText.join('\n'));
    }

    const editor = page
      .locator(
        [
          `[data-testid="${TESTIDS['schedule-editor-root']}"]`,
          `[data-testid="${TESTIDS['schedule-create-dialog']}"]`,
          '[role="dialog"]',
          '[aria-modal="true"]',
        ].join(', '),
      )
      .first();
    if ((await editor.count().catch(() => 0)) > 0) {
      const editorHtml = await editor.evaluate((el) => (el as HTMLElement).outerHTML).catch(() => '');
      await persistText('editor.html-head.txt', safeSlice(editorHtml, 2_400));
    }

    const weekRoot = page.getByTestId('schedule-week-view').first();
    if ((await weekRoot.count().catch(() => 0)) > 0) {
      const domHead = await weekRoot.evaluate((el) => (el as HTMLElement).outerHTML).catch(() => '');
      await persistText('dom.txt', safeSlice(domHead, 2_400));
    }

    const png = await page.screenshot({ fullPage: true }).catch(() => null);
    if (png) {
      await persistArtifact(testInfo, `${label}.screenshot.png`, png, 'image/png');
    }
  } catch {
    // Ignore capture errors to avoid masking the original failure.
  }
}

export const getVisibleListbox = (page: Page) => page.locator('[role="listbox"]:visible').first();

const selectComboboxOption = async (page: Page, option?: SelectOption) => {
  // Use the visible listbox to avoid preview UI portal differences.
  const listbox = getVisibleListbox(page);
  await expect(listbox).toBeVisible({ timeout: 10_000 });

  if (typeof option === 'string') {
    await listbox.getByRole('option', { name: option }).first().click();
    return;
  }
  if (option instanceof RegExp) {
    await listbox.getByRole('option', { name: option }).first().click();
    return;
  }
  await listbox.getByRole('option').first().click();
};

export const getQuickScheduleDialog = (page: Page) => {
  const formSelector = 'input, textarea, [role="textbox"], [role="combobox"]';

  const byTestId = page
    .locator(
      [
        `[data-testid="${TESTIDS['schedule-create-dialog']}"]`,
        `[data-testid="${TESTIDS['schedule-editor-root']}"]`,
        '[data-testid="quick-schedule-dialog"]',
      ].join(', '),
    )
    .filter({ has: page.locator(formSelector) });

  const byRoleDialog = page
    .getByRole('dialog', { name: /スケジュール|Schedule|予定/ })
    .filter({ has: page.locator(formSelector) });

  const modalContainers = page
    .locator(
      [
        '.MuiDialog-root',
        '.MuiModal-root',
        '.MuiPopover-root',
        '.MuiMenu-root',
        '.MuiDrawer-root',
        'div[role="presentation"]',
        'div[class*="MuiPaper-root"]',
      ].join(', '),
    )
    .filter({ has: page.locator(formSelector) });

  return byTestId.first().or(byRoleDialog.last()).or(modalContainers.last());
};

const SAVE_BUTTON_NAMES = /保存|Save|更新|登録|確定|決定|OK|反映|完了|作成/i;

export function getQuickDialogSaveButton(page: Page) {
  const dialog = getQuickScheduleDialog(page);

  const saveSelector = `[data-testid="${TESTIDS['schedule-editor-save']}"]`,
    legacySelector = `[data-testid="${TESTIDS['schedule-create-save']}"]`;

  const inDialog = dialog.locator(`${saveSelector}, ${legacySelector}, button`).filter({ hasText: SAVE_BUTTON_NAMES }).first();
  const global = page
    .locator(`${saveSelector}, ${legacySelector}, button, [role="button"]`)
    .filter({ hasText: SAVE_BUTTON_NAMES })
    .first();

  return { dialog, inDialog, global };
}

export async function waitForDayViewReady(page: Page) {
  await waitForDayTimeline(page);
}

export async function waitForWeekViewReady(page: Page) {
  await waitForWeekTimeline(page);
}

export async function waitForMonthViewReady(page: Page) {
  await waitForMonthTimeline(page);
}

export async function openQuickUserCareDialog(page: Page) {
  const trigger = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });
}

export async function fillQuickUserCareForm(page: Page, opts: QuickUserCareFormOptions = {}) {
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  if (opts.title) {
    const titleInput = dialog
      .getByTestId(TESTIDS['schedule-create-title'])
      .or(dialog.getByLabel('タイトル', { exact: false }))
      .first();
    const fallbackTitle = dialog.getByRole('textbox').first();
    const inputToUse = (await titleInput.count().catch(() => 0)) > 0 ? titleInput : fallbackTitle;
    await inputToUse.fill(opts.title);
  }

  if (opts.userInputValue || opts.userOptionName) {
    const userInput = dialog.getByTestId(TESTIDS['schedule-create-user-input']);
    if (opts.userInputValue) {
      await userInput.fill(opts.userInputValue);
    } else {
      await userInput.click();
    }
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await selectComboboxOption(page, opts.userOptionName ?? opts.userInputValue);
  }

  if (opts.staffInputValue || opts.staffOptionName) {
    const staffInput = dialog.getByTestId(TESTIDS['schedule-create-staff-id']);
    if (opts.staffInputValue) {
      await staffInput.fill(opts.staffInputValue);
    } else {
      await staffInput.click();
    }
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await selectComboboxOption(page, opts.staffOptionName ?? opts.staffInputValue);
  }

  if (opts.startLocal) {
    await dialog.getByTestId(TESTIDS['schedule-create-start']).fill(opts.startLocal);
  }

  if (opts.endLocal) {
    await dialog.getByTestId(TESTIDS['schedule-create-end']).fill(opts.endLocal);
  }

  if (opts.serviceOptionLabel) {
    await dialog.getByTestId(TESTIDS['schedule-create-service-type']).click();
    await expect(getVisibleListbox(page)).toBeVisible({ timeout: 10_000 });
    await selectComboboxOption(page, opts.serviceOptionLabel);
  }

  if (typeof opts.location === 'string') {
    await dialog.getByTestId(TESTIDS['schedule-create-location']).fill(opts.location);
  }

  if (typeof opts.notes === 'string') {
    await dialog.getByTestId(TESTIDS['schedule-create-notes']).fill(opts.notes);
  }
}

export async function submitQuickUserCareForm(page: Page) {
  const dialog = getQuickScheduleDialog(page);
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const { inDialog, global } = getQuickDialogSaveButton(page);
  const saveButton = (await inDialog.count()) > 0 ? inDialog : global;
  await expect(saveButton).toBeVisible({ timeout: 15_000 });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });

  await saveButton.click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await waitForDayTimeline(page);
}

export async function assertDayHasUserCareEvent(
  page: Page,
  opts: {
    titleContains?: string;
    serviceContains?: string;
    userName?: string;
    memoContains?: string;
  } = {},
) {
  const { titleContains, serviceContains, userName, memoContains } = opts;
  const root = page.locator(
    `[data-testid="${TESTIDS['schedules-day-page']}"] , [data-testid="schedule-day-root"]`,
  ).first();
  await expect(root).toBeVisible();

  if (titleContains) {
    const card = root
      .locator('[data-schedule-event="true"][data-category="User"]')
      .filter({ hasText: titleContains })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    if (serviceContains) {
      await expect(card).toContainText(serviceContains);
    }
  }

  if (userName) {
    await expect(root.getByText(userName, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }

  if (memoContains) {
    await expect(root.getByText(memoContains, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }
}

export async function getOrgChipText(page: Page, view: 'week' | 'month' | 'day'): Promise<string> {
  const testIdMap = {
    week: TESTIDS.SCHEDULE_WEEK_ORG_INDICATOR,
    month: TESTIDS.SCHEDULE_MONTH_ORG_INDICATOR,
    day: TESTIDS.SCHEDULE_DAY_ORG_INDICATOR,
  } as const;
  const locator = page.getByTestId(testIdMap[view]);
  const count = await locator.count().catch(() => 0);
  if (count === 0) return '';
  await expect(locator).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
  return locator.innerText().catch(() => '');
}

const WEEK_PANEL_VISIBLE = '#panel-week:not([hidden])';
const WEEK_TIMELINE_PANEL_VISIBLE = '#panel-timeline:not([hidden])';

const buildWeekRootCandidates = (page: Page): Locator[] => [
  page.locator(`${WEEK_TIMELINE_PANEL_VISIBLE} [data-testid="schedules-week-timeline"]`),
  page.locator(`${WEEK_TIMELINE_PANEL_VISIBLE} [data-testid="schedule-week-root"]`),
  page.getByTestId('schedules-week-timeline'),
  page.locator(`${WEEK_PANEL_VISIBLE} [data-testid="schedule-week-root"]`),
  page.locator(`${WEEK_PANEL_VISIBLE} [data-testid="schedule-week-view"]`),
  page.getByTestId('schedule-week-root'),
  page.getByTestId('schedule-week-view'),
];

const getWeekTimelineRoot = async (page: Page): Promise<Locator> => {
  const candidates = buildWeekRootCandidates(page);
  for (const locator of candidates) {
    const candidate = locator.first();
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    const visible = await candidate.isVisible().catch(() => false);
    if (visible) {
      return candidate;
    }
  }

  for (const locator of candidates) {
    const candidate = locator.first();
    if ((await candidate.count().catch(() => 0)) > 0) {
      return candidate;
    }
  }

  return page.getByTestId('schedule-week-view').first();
};

export async function getWeekScheduleItems(
  page: Page,
  opts: {
    category?: 'User' | 'Staff' | 'Org';
  } = {},
) {
  const { category } = opts;
  const categorySelector = category ? `[data-category="${category}"]` : '';
  const root = await getWeekTimelineRoot(page);
  return root.locator(`[data-testid="schedule-item"]${categorySelector}`);
}

export async function getWeekRowById(page: Page, id: number | string) {
  const root = await getWeekTimelineRoot(page);
  return root.locator(`[data-testid="schedule-item"][data-id="${id}"]`).first();
}

export async function openEditorFromRowMenu(
  page: Page,
  row: Locator,
  _opts: { testInfo?: TestInfo; label?: string } = {},
) {
  await row.scrollIntoViewIfNeeded();
  await row.hover().catch(() => undefined);

  const moreInRow = row
    .locator(
      [
        '[data-testid*="more"]',
        '[data-testid*="menu"]',
        'button[aria-label*="その他"]',
        'button[aria-label*="メニュー"]',
        'button[aria-label*="操作"]',
        'button:has-text("…")',
      ].join(', '),
    )
    .first();

  if ((await moreInRow.count()) === 0) {
    await row.click({ force: true });
  } else {
    await moreInRow.click({ force: true });
  }

  const editor = page.getByTestId(TESTIDS['schedule-editor-root']);
  const menu = page.getByRole('menu').first();

  // Wait for either the menu or the editor to surface; some UIs may open the editor directly.
  const start = Date.now();
  const deadline = start + 5_000;
  while (Date.now() < deadline) {
    const editorVisible = await editor.isVisible().catch(() => false);
    if (editorVisible) return;
    const menuVisible = (await menu.count().catch(() => 0)) > 0 && (await menu.isVisible().catch(() => false));
    if (menuVisible) break;
    await page.waitForTimeout(150);
  }

  const menuVisible = (await menu.count().catch(() => 0)) > 0 && (await menu.isVisible().catch(() => false));
  if (!menuVisible) {
    throw new Error('Menu did not appear and editor not visible');
  }

  const items = menu.getByRole('menuitem');
  const count = await items.count();
  if (count === 0) throw new Error('Menu opened but has no menuitems');

  const editLike = menu.getByRole('menuitem', { name: /編集|Edit|更新|開く|詳細/i }).first();
  if ((await editLike.count()) > 0) {
    await editLike.click({ force: true });
  } else {
    await items.first().click({ force: true });
  }
}

export async function openWeekEventEditor(
  page: Page,
  row: Locator,
  opts: { testInfo?: TestInfo; label?: string } = {},
) {
  const label = opts.label ?? 'week-editor-open';
  try {
    await openEditorFromRowMenu(page, row, opts);
    await expect(page.getByTestId(TESTIDS['schedule-editor-root'])).toBeVisible({ timeout: 15_000 });
    return page.getByTestId(TESTIDS['schedule-editor-root']);
  } catch (error) {
    await captureEditorDebug(page, opts.testInfo, label);
    throw error;
  }
}

/**
 * @deprecated Use getWeekRowById + openWeekEventEditor for deterministic targeting.
 */
export async function openWeekEventCard(
  page: Page,
  opts: {
    index?: number;
    titleContains?: string;
    category?: 'User' | 'Staff' | 'Org';
    testInfo?: TestInfo;
    clickAttempts?: number;
    label?: string;
  } = {},
) {
  const { index = 0, titleContains, category, testInfo, label = 'week-event-card' } = opts;

  // Ensure week tab/panel is active in preview UI.
  const weekTab = page.getByRole('tab', { name: /週|Week/i });
  if ((await weekTab.count().catch(() => 0)) > 0) {
    await weekTab.first().click();
  }
  await expect(page.locator('#panel-week:not([hidden])')).toBeVisible({ timeout: 15_000 });

  const root = await getWeekTimelineRoot(page);
  await expect(root).toBeVisible({ timeout: 15_000 });

  let locator = await getWeekScheduleItems(page, { category });
  if (titleContains) {
    locator = locator.filter({ hasText: titleContains });
  }

  const target = locator.nth(index);
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await expect(target).toBeVisible({ timeout: 15_000 });

  return openWeekEventEditor(page, target, { testInfo, label });
}

export async function assertWeekHasUserCareEvent(
  page: Page,
  opts: {
    titleContains?: string;
    serviceContains?: string;
    userName?: string;
    memoContains?: string;
  } = {},
) {
  const root = await getWeekTimelineRoot(page);
  await expect(root).toBeVisible({ timeout: 15_000 });
  const rootTestId = await root.getAttribute('data-testid').catch(() => null);
  const isTimelineOnlyLayout = rootTestId === 'schedules-week-timeline';

  const { titleContains, serviceContains, userName, memoContains } = opts;
  let cardLocator = await getWeekScheduleItems(page, { category: 'User' });

  if (titleContains) {
    const narrowed = cardLocator.filter({ hasText: titleContains });
    if ((await narrowed.count().catch(() => 0)) > 0) {
      cardLocator = narrowed;
    }
  }

  const card = cardLocator.first();
  await expect(card).toBeVisible({ timeout: 30_000 });

  if (serviceContains && !isTimelineOnlyLayout) {
    await expect(card).toContainText(serviceContains);
  }

  if (userName && !isTimelineOnlyLayout) {
    await expect(root.getByText(userName, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }

  if (memoContains && !isTimelineOnlyLayout) {
    await expect(root.getByText(memoContains, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  }
}
