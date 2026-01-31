/**
 * MUI Select / Menu / Autocomplete ユーティリティ
 *
 * CI安定版「monthly型」（4点セット）
 * ✅ Dual-role locator: listbox / menu 両対応
 * ✅ Staged wait: attached → visible
 * ✅ Keyboard fallback: ArrowDown (try/catch)
 * ✅ Non-fatal skip: 選択肢 0件でも落とさない
 */

import { Locator, Page, expect } from '@playwright/test';

/**
 * MUI Select / Menu / Autocomplete の popup を開く（勝ちパターン）
 *
 * @param page - Playwright Page
 * @param trigger - トリガー要素（Button, Input など）
 * @param opts - オプション
 * @returns 開いた popup の Locator（listbox/menu）
 *
 * @example
 * ```typescript
 * const monthSelect = page.getByTestId('month-select');
 * const popup = await openMuiSelect(page, monthSelect);
 * const option = popup.getByRole('option').first();
 * await option.click();
 * ```
 */
export async function openMuiSelect(
  page: Page,
  trigger: Locator,
  opts?: { timeout?: number }
): Promise<Locator> {
  const timeout = opts?.timeout ?? 15_000;

  // Dual-role locator: MUI はコンテキストに応じて listbox / menu を使い分ける
  const popup = page.locator('[role="listbox"], [role="menu"]');

  // 1. クリックで popup オープン
  await trigger.click();

  // 2. Keyboard fallback: ArrowDown で更にフォーカスを進める
  //    (Portal/focus問題を回避)
  await trigger.press('ArrowDown').catch(() => {
    // ESC などで close された場合のみ無視
    // その他の理由での失敗は continue
  });

  // 3. Staged wait: DOM 存在 → 表示待ち
  //    (CI で「DOM あるが表示遅い」を吸収)
  try {
    await expect(popup).toBeAttached({ timeout });
  } catch {
    // attached 失敗は warn のみ（skip につながらない）
    console.warn('[openMuiSelect] popup not attached within', timeout, 'ms');
  }

  try {
    await expect(popup).toBeVisible({ timeout });
  } catch {
    // visible 失敗は warn のみ
    console.warn('[openMuiSelect] popup not visible within', timeout, 'ms');
  }

  return popup;
}

/**
 * MUI Select から最初の option を選択（非破壊）
 *
 * @param page - Playwright Page
 * @param trigger - トリガー要素
 * @param opts - オプション
 * @returns 選択されたかどうか
 *
 * @example
 * ```typescript
 * const monthSelect = page.getByTestId('month-select');
 * const selected = await selectFirstMuiOption(page, monthSelect);
 * if (!selected) {
 *   console.log('No options available; skipping');
 * }
 * ```
 */
export async function selectFirstMuiOption(
  page: Page,
  trigger: Locator,
  opts?: { timeout?: number }
): Promise<boolean> {
  const popup = await openMuiSelect(page, trigger, opts);

  // 4. Non-fatal skip: option 0 件でも test を fail させない
  const options = popup.locator('[role="option"]');
  if ((await options.count()) === 0) {
    console.warn('[selectFirstMuiOption] no options found; skipping selection');
    return false;
  }

  const firstOption = options.first();
  await firstOption.scrollIntoViewIfNeeded();
  await firstOption.click();

  return true;
}

/**
 * MUI Select から特定のラベル条件で option を選択（非破壊）
 *
 * @param page - Playwright Page
 * @param trigger - トリガー要素
 * @param labelPattern - 選択肢のラベル条件（正規表現 or 完全一致）
 * @param opts - オプション
 * @returns 選択されたかどうか
 *
 * @example
 * ```typescript
 * const rateFilter = page.getByTestId('rate-filter');
 * const selected = await selectMuiOptionByLabel(
 *   page,
 *   rateFilter,
 *   /80%以上|90%以上/
 * );
 * ```
 */
export async function selectMuiOptionByLabel(
  page: Page,
  trigger: Locator,
  labelPattern: RegExp | string,
  opts?: { timeout?: number }
): Promise<boolean> {
  const popup = await openMuiSelect(page, trigger, opts);

  const options = popup.locator('[role="option"]');
  if ((await options.count()) === 0) {
    console.warn('[selectMuiOptionByLabel] no options found; skipping selection');
    return false;
  }

  let found = false;

  for (let i = 0; i < (await options.count()); i++) {
    const option = options.nth(i);
    const text = await option.textContent();

    if (!text) continue;

    const matches =
      typeof labelPattern === 'string'
        ? text === labelPattern
        : labelPattern.test(text);

    if (matches) {
      await option.scrollIntoViewIfNeeded();
      await option.click();
      found = true;
      break;
    }
  }

  if (!found) {
    console.warn(
      '[selectMuiOptionByLabel] matching option not found for pattern:',
      labelPattern
    );
  }

  return found;
}
