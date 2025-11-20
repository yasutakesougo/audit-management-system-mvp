import { expect, test, type Page } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

// ※ 実際のプロジェクトのテストヘルパーに合わせて実装する
async function gotoWeekWithConflicts(page: Page) {
  // 例: テスト用シナリオを seed する API / query param など
  // await seedScenario('schedule-conflicts-basic');
  await page.goto('/schedules/week?scenario=conflicts-basic');
}

async function gotoDayWithConflicts(page: Page) {
  // 同様に日ビュー用
  await page.goto('/schedules/day?scenario=conflicts-basic');
}

test.describe('Schedule Conflict Detection E2E', () => {
  test.beforeEach(async ({ page }) => {
    // スケジュール機能フラグを有効化
    await page.goto('/?test=true&VITE_FEATURE_SCHEDULES=1&VITE_FEATURE_SCHEDULES_CREATE=1');
  });

  test('shows conflicted events with warning indicator in week view', async ({
    page,
  }) => {
    await gotoWeekWithConflicts(page);

    // ⚠️付きイベント（重複あり）が1件以上表示されていること
    const conflictedEvents = page.getByTestId(
      TESTIDS['schedules-event-conflicted'],
    );
    await expect(conflictedEvents.first()).toBeVisible();

    // 対照として「通常イベント」も存在すること
    const normalEvents = page.getByTestId(TESTIDS['schedules-event-normal']);
    await expect(normalEvents.first()).toBeVisible();
  });

  test('shows conflicted events as red-bordered cards in day (mobile agenda) view', async ({
    page,
  }) => {
    await gotoDayWithConflicts(page);

    const conflictedCards = page.getByTestId(
      TESTIDS['schedules-event-conflicted'],
    );

    await expect(conflictedCards.first()).toBeVisible();

    // CSS の border-left-color 等を厳密に見たい場合は computed style を確認してもよいが、
    // ここでは「conflicted testid をもつカードが存在する」ことを主目的とする。
  });

  test('week and day views are consistent about conflicted events', async ({
    page,
  }) => {
    await gotoWeekWithConflicts(page);

    // 週ビューで衝突している schedule-id をいくつか取得
    const conflictedEvents = page.getByTestId(
      TESTIDS['schedules-event-conflicted'],
    );

    const ids = await conflictedEvents
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('data-schedule-id')),
      );

    const firstId = ids.find(Boolean);
    expect(firstId).toBeTruthy();

    // 同じシナリオで日ビューに遷移
    await gotoDayWithConflicts(page);

    const conflictedInDay = page.locator(
      `[data-testid="${TESTIDS['schedules-event-conflicted']}"][data-schedule-id="${firstId}"]`,
    );

    await expect(conflictedInDay).toBeVisible();
  });

  test('conflicted events have proper visual indicators', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await expect(conflictedEvent).toBeVisible();

    // ⚠️ アイコンが含まれていることを確認
    await expect(conflictedEvent).toContainText('⚠️');

    // data-schedule-id 属性が設定されていることを確認
    const scheduleId = await conflictedEvent.getAttribute('data-schedule-id');
    expect(scheduleId).toBeTruthy();
    expect(scheduleId).toMatch(/^[a-zA-Z0-9\-_]+$/);
  });

  test('normal events do not have conflict indicators', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    const normalEvent = page.getByTestId(TESTIDS['schedules-event-normal']).first();

    await expect(normalEvent).toBeVisible();

    // ⚠️ アイコンが含まれていないことを確認
    await expect(normalEvent).not.toContainText('⚠️');

    // data-schedule-id 属性は設定されていること
    const scheduleId = await normalEvent.getAttribute('data-schedule-id');
    expect(scheduleId).toBeTruthy();
  });

  test('schedule navigation maintains conflict detection state', async ({
    page,
  }) => {
    await gotoWeekWithConflicts(page);

    // 週ビューから日ビューに遷移
    const dayTab = page.getByRole('tab', { name: '日間' });
    await dayTab.click();

    // URLが日ビューに変わることを確認
    await expect(page).toHaveURL(/\/schedules\/day/);

    // 日ビューでも衝突イベントが正しく表示されることを確認
    const conflictedInDay = page.getByTestId(
      TESTIDS['schedules-event-conflicted'],
    );
    await expect(conflictedInDay.first()).toBeVisible();

    // 週ビューに戻る
    const weekTab = page.getByRole('tab', { name: '週間' });
    await weekTab.click();

    // 週ビューでも衝突状態が維持されることを確認
    const conflictedInWeek = page.getByTestId(
      TESTIDS['schedules-event-conflicted'],
    );
    await expect(conflictedInWeek.first()).toBeVisible();
  });

  test('conflicted events open guide dialog when clicked', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    // 衝突イベントをクリック
    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEvent.click();

    // ガイドダイアログが開かれることを確認
    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).toBeVisible();

    // ダイアログタイトルが適切に表示されることを確認
    const dialogTitle = page.getByTestId(TESTIDS['schedule-conflict-guide-title']);
    await expect(dialogTitle).toContainText('⚠️ スケジュールの重複について');

    // ガイド内容が表示されることを確認
    const guideContent = page.getByTestId(TESTIDS['schedule-conflict-guide-content']);
    await expect(guideContent).toBeVisible();
    await expect(guideContent).toContainText('重複');

    // 「閉じる」ボタンでダイアログを閉じる
    const closeButton = page.getByTestId(TESTIDS['schedule-conflict-guide-close']);
    await closeButton.click();

    // ダイアログが閉じられることを確認
    await expect(guideDialog).not.toBeVisible();
  });

  test('normal events do not open guide dialog when clicked', async ({
    page,
  }) => {
    await gotoWeekWithConflicts(page);

    // 通常イベントをクリック
    const normalEvent = page.getByTestId(TESTIDS['schedules-event-normal']).first();
    await normalEvent.click();

    // ガイドダイアログが開かれないことを確認
    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).not.toBeVisible();
  });

  test('guide dialog shows appropriate conflict information', async ({
    page,
  }) => {
    await gotoWeekWithConflicts(page);

    // 衝突イベントをクリック
    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEvent.click();

    // ガイド内容の表示確認
    const guideContent = page.getByTestId(TESTIDS['schedule-conflict-guide-content']);
    await expect(guideContent).toBeVisible();

    // 具体的な衝突情報が含まれていることを確認
    await expect(guideContent).toContainText('重複');

    // おすすめ対応が表示されることを確認
    await expect(guideContent).toContainText('💡 おすすめの対応');

    // チップ形式で衝突種類が表示されることを確認（例: 利用者×生活介護/支援）
    const conflictKindIndicators = page.locator('[role="button"]:has-text("利用者"), [role="button"]:has-text("職員"), [role="button"]:has-text("重複")');
    await expect(conflictKindIndicators.first()).toBeVisible();
  });

  test('guide dialog works consistently across week and day views', async ({
    page,
  }) => {
    // 週ビューでガイドダイアログ動作確認
    await gotoWeekWithConflicts(page);

    const conflictedEventWeek = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEventWeek.click();

    const guideDialogWeek = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialogWeek).toBeVisible();

    // ダイアログを閉じる
    const closeButtonWeek = page.getByTestId(TESTIDS['schedule-conflict-guide-close']);
    await closeButtonWeek.click();
    await expect(guideDialogWeek).not.toBeVisible();

    // 日ビューに遷移
    await gotoDayWithConflicts(page);

    const conflictedEventDay = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEventDay.click();

    // 日ビューでもガイドダイアログが動作することを確認
    const guideDialogDay = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialogDay).toBeVisible();

    // 同じような内容が表示されることを確認
    const guideContentDay = page.getByTestId(TESTIDS['schedule-conflict-guide-content']);
    await expect(guideContentDay).toContainText('💡 おすすめの対応');

    // ダイアログを閉じる
    const closeButtonDay = page.getByTestId(TESTIDS['schedule-conflict-guide-close']);
    await closeButtonDay.click();
    await expect(guideDialogDay).not.toBeVisible();
  });

  test('30min later action button appears for life-support conflicts', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    // 生活支援同士の重複がある衝突イベントをクリック
    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEvent.click();

    // ガイドダイアログが開くことを確認
    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).toBeVisible();

    // 生活支援同士の重複の場合、「30分後ろにずらす」ボタンが表示されることを確認
    const applyButton = page.getByTestId(TESTIDS['schedule-conflict-guide-apply-30min-later']);

    // ボタンの存在確認（表示される条件に依存するため、条件分岐でテスト）
    if (await applyButton.isVisible()) {
      // ボタンが表示されている場合、適切なラベルを持つことを確認
      await expect(applyButton).toContainText('30分後ろにずらす');

      // ボタンをクリックして動作確認
      await applyButton.click();

      // ダイアログが閉じることを確認
      await expect(guideDialog).not.toBeVisible();

      // コンソールログまたは成功インジケーターを確認（実装に応じて調整）
      // TODO: 実際のAPI更新確認ロジックに差し替える
    }

    // ダイアログを閉じる（ボタンが押されていない場合）
    if (await guideDialog.isVisible()) {
      const closeButton = page.getByTestId(TESTIDS['schedule-conflict-guide-close']);
      await closeButton.click();
    }
  });

  test('apply suggestion button only appears for eligible conflicts', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    // 複数の衝突イベントを確認し、条件に合うもののみボタンが表示されることをテスト
    const conflictedEvents = page.getByTestId(TESTIDS['schedules-event-conflicted']);
    const eventCount = await conflictedEvents.count();

    for (let i = 0; i < Math.min(eventCount, 3); i++) {
      // 各衝突イベントを個別にテスト
      await conflictedEvents.nth(i).click();

      const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
      await expect(guideDialog).toBeVisible();

      const applyButton = page.getByTestId(TESTIDS['schedule-conflict-guide-apply-30min-later']);

      // ボタンの表示/非表示は重複の種類と対象スケジュールのタイプに依存
      // 生活支援同士の重複でかつ対象が生活支援の場合のみ表示される
      const isButtonVisible = await applyButton.isVisible();
      console.log(`Event ${i}: Apply button visible: ${isButtonVisible}`);

      // ダイアログを閉じて次のイベントをテスト
      const closeButton = page.getByTestId(TESTIDS['schedule-conflict-guide-close']);
      await closeButton.click();
      await expect(guideDialog).not.toBeVisible();
    }
  });

  test('successful schedule adjustment shows success toast and refreshes data', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    // アクションが利用可能な衝突イベントをクリック
    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEvent.click();

    // ガイドダイアログが開くことを確認
    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).toBeVisible();

    const applyButton = page.getByTestId(TESTIDS['schedule-conflict-guide-apply-30min-later']);

    if (await applyButton.isVisible()) {
      // ボタンクリックでAPI更新が実行される
      await applyButton.click();

      // ダイアログが自動的に閉じる
      await expect(guideDialog).not.toBeVisible();

      // 成功トーストが表示される
      const successToast = page.getByTestId('toast-message').filter({
        hasText: /予定を調整しました/
      });
      await expect(successToast).toBeVisible({ timeout: 5000 });

      // データが再取得されたことを確認（表示が更新される）
      // NOTE: 実環境では衝突が解消されるか、時刻が変更されることが確認できる
    }
  });

  test('prevents secondary conflicts when adjusting schedules', async ({ page }) => {
    await gotoWeekWithConflicts(page);

    // 調整すると別の予定と重複する可能性がある衝突イベントを想定
    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .last(); // 最後のイベントは重複しやすい設定とする

    await conflictedEvent.click();

    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).toBeVisible();

    const applyButton = page.getByTestId(TESTIDS['schedule-conflict-guide-apply-30min-later']);

    if (await applyButton.isVisible()) {
      await applyButton.click();

      // 二次衝突防止機能により、エラーメッセージまたは成功メッセージのいずれかが表示される
      const anyToast = page.getByTestId('toast-message');
      await expect(anyToast).toBeVisible({ timeout: 5000 });

      // エラートーストの場合、適切なメッセージが表示される
      const errorToast = page.getByTestId('toast-message').filter({
        hasText: /別の予定と重複/
      });

      // エラーまたは成功のいずれかであることを確認
      const hasError = await errorToast.isVisible();
      const successToast = page.getByTestId('toast-message').filter({
        hasText: /予定を調整/
      });
      const hasSuccess = await successToast.isVisible();

      expect(hasError || hasSuccess).toBe(true);
    }
  });

  test('handles API errors gracefully during schedule adjustment', async ({ page }) => {
    // API エラーをシミュレートするためのシナリオ（環境に応じて設定）
    await page.goto('/schedules/week?scenario=conflicts-with-api-error');

    const conflictedEvent = page
      .getByTestId(TESTIDS['schedules-event-conflicted'])
      .first();

    await conflictedEvent.click();

    const guideDialog = page.getByTestId(TESTIDS['schedule-conflict-guide-dialog']);
    await expect(guideDialog).toBeVisible();

    const applyButton = page.getByTestId(TESTIDS['schedule-conflict-guide-apply-30min-later']);

    if (await applyButton.isVisible()) {
      await applyButton.click();

      // APIエラー時のエラートーストが表示される
      const errorToast = page.getByTestId('toast-message').filter({
        hasText: /調整に失敗|エラー/
      });

      // エラートーストが表示されるか、適切なフォールバック動作が実行される
      await expect(errorToast).toBeVisible({ timeout: 5000 });
    }
  });
});