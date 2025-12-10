# Schedule E2E Playbook

`schedules/*` 系の E2E を追加・改修するときに共通で守りたいルールをまとめました。狙いは次の 3 点です。

- どの spec も **同じ helper / 同じ SharePoint スタブ** を使う
- 旧 UI / 新 UI（WeekTimeline）・fixtures / SharePoint モードの差を **helper で吸収** する
- 「UI の見た目」だけでなく、「保存されたデータ」まで確認する

---

## 1. 対象ファイルとユーティリティ

主に対象となる spec:

- `tests/e2e/schedule-smoke.spec.ts`
- `tests/e2e/schedule-nav.smoke.spec.ts`
- `tests/e2e/schedule-day.happy-path.spec.ts`
- `tests/e2e/schedule-day.aria.smoke.spec.ts`
- `tests/e2e/schedule-day-view.spec.ts`
- `tests/e2e/schedule-month.aria.smoke.spec.ts`
- `tests/e2e/schedule-week.edit.aria.spec.ts`
- `tests/e2e/schedule-list-view.spec.ts`
- `tests/e2e/schedule-org-filter.spec.ts`
- `tests/e2e/schedule.status-service.smoke.spec.ts`

これらは次のユーティリティを共通利用します。

- **ナビゲーション**: `tests/e2e/utils/scheduleNav.ts`
  - `gotoDay(page, date)` / `gotoWeek(page, date)` / `gotoMonth(page, date)`
- **表示完了待ち & 操作**: `tests/e2e/utils/scheduleActions.ts`
  - `waitForDayViewReady(page)` / `waitForWeekViewReady(page)` / `waitForMonthViewReady(page)`
  - `getWeekScheduleItems(page)` / `openWeekEventCard(page, item)`
  - `assertDayHasUserCareEvent(page, options)` / `assertWeekHasUserCareEvent(page, options)`
  - `openQuickUserCareDialog(page)` / `fillQuickUserCareForm(page, options)` / `submitQuickUserCareForm(page)`
- **フィクスチャ**: `tests/e2e/utils/schedule.fixtures.ts`
  - `SCHEDULE_FIXTURE_BASE_DATE` / `buildScheduleFixturesForDate(date)`
- **SharePoint スタブ**:
  - `tests/e2e/_helpers/mockEnsureScheduleList.ts`
  - `tests/e2e/_helpers/setupSharePointStubs.ts`
  - `tests/e2e/utils/spMock.ts` (`__scheduleMocks__` を通じてリスト状態を検証可能)
- **コンソール監視**:
  - `tests/e2e/utils/console.ts` の `captureSp400(page)`

---

## 2. 共通ブートシーケンス（`bootSchedule`）

Schedule 系の spec は **すべて** `tests/e2e/_helpers/bootSchedule.ts` の `bootSchedule` を経由して起動します。`setupPlaywrightEnv` → localStorage 初期化 → SharePoint スタブ登録 → （必要なら）自動ナビゲーションまでを 1 呼び出しで行います。レガシーな `bootSchedulePage` も alias として残っていますが、新規 spec では `bootSchedule` を直接 import してください。

### 2-1. 最小パターン

```ts
import { test } from '@playwright/test';
import { bootSchedule } from './_helpers/bootSchedule';

test.beforeEach(async ({ page }) => {
  await bootSchedule(page);
});
```

### 2-2. 日付や Week V2 を固定する場合

```ts
import { SCHEDULE_FIXTURE_BASE_DATE } from './utils/schedule.fixtures';

test.beforeEach(async ({ page }) => {
  await bootSchedule(page, {
    date: SCHEDULE_FIXTURE_BASE_DATE,
    enableWeekV2: true,
  });
});
```

### 2-3. 画面遷移まで一括で行う

`bootSchedule` に `autoNavigate` と `route` を渡すと、env 初期化 → SharePoint スタブ → `page.goto(route)` までを 1 回で済ませられます。Day/Week/Month の URL クエリを明示的に固定したい happy-path で有効です。

```ts
test.beforeEach(async ({ page }) => {
  await bootSchedule(page, {
    autoNavigate: true,
    route: '/schedules/week?date=2025-02-02',
    seed: { schedulesToday: true },
  });
});
```

`route` を省略すると `/schedules/day` に遷移します。必要に応じて `gotoWeek` などの helper と併用してください。

### 2-4. SharePoint スタブを拡張する例

```ts
test.beforeEach(async ({ page }) => {
  await bootSchedule(page, {
    sharePoint: {
      lists: [
        {
          name: 'ScheduleEvents',
          aliases: ['Schedules', 'Schedules_Master'],
          items: [],
          onCreate: (payload, ctx) => {
            const record = { Id: ctx.takeNextId(), ...payload };
            // create payload の検証・保存
            return record;
          },
          onUpdate: (id, payload, ctx) => ({ ...ctx.previous, ...payload, Id: id }),
        },
      ],
    },
  });
});
```

### 2-5. 追加の localStorage やログを設定したい場合

`bootSchedule` 呼び出し後に `page.addInitScript` や `captureSp400(page)` を続けて呼べば OK です。Helper が書き込んだキー（`skipLogin`, `feature:schedules*`, `schedules:fixtures` など）を重ね書きしたい場合も同様。

> 旧来の `mockEnsureScheduleList` / `setupSharePointStubs` / localStorage 初期化は、この helper の内部ですべて処理されるため、spec 側で直接呼ぶ必要はありません。

### 2-6. `schedules.today.dev.v1` をシードする

Agenda ↔ Schedule の導線を固定化したい場合は、共通フィクスチャ `tests/e2e/_fixtures/schedules.today.dev.v1.json` を `bootSchedule` から読み込めます。

```ts
await bootSchedule(page, {
  seed: { schedulesToday: true },
});
```

- Helper が `localStorage['schedules.today.dev.v1']` を仕込み、SharePoint スタブにも **利用者ケア / スタッフ業務 / 組織イベント / 送迎** の 4 カテゴリを登録します。`schedule-day.happy-path.spec.ts` の seeded block がこの JSON を前提にフィルター挙動を検証します。
- `getSchedulesTodaySeedDate()`（`tests/e2e/_helpers/schedulesTodaySeed.ts`）を使うと Day/Week ナビゲーションの URL パラメータもフィクスチャ日に揃えられます。
- Schedule から Agenda の CTA を辿っても、常に同じ「2025-02-02」の予定が表示されるため assert を簡略化できます。

### 2-7. Week view (V2) と共有シード

WeekPage V2 / WeekView V2 は **handoff 系と schedules 系の決め打ちフィクスチャ** を前提にしています。

- `handoff.timeline.dev.v1` / `handoff.summary.dev.v1`
- `schedules.today.dev.v1` (a.k.a. `schedulesTodaySeed`)

Agenda → Dashboard → Schedule が同じ JSON スナップショットを共有するように、Playwright では次のヘルパー経由で seeds を有効化してください。

- `bootAgenda(page, { seed: { agenda: true, schedulesToday: true } })`
- `bootSchedule(page, { seed: { schedulesToday: true } })`

Week 系 spec を追加するときは ad-hoc fixture を個別に読むのではなく、これらの helper を介して seed を共有することで、ハンドオフカード・「今日の予定」・Week グリッドの整合性を保てます。

---

## 3. 代表的なパターン

### 3-0. Seeded Day / Week happy-path

`tests/e2e/schedule-day.happy-path.spec.ts` の先頭に、`schedules.today.dev.v1` を読み込んだ deterministic block を追加しました。Day ビューの総件数・カテゴリフィルター・検索クエリを 1 つのシードで検証します。

```ts
const SEEDED_EVENT_COUNT = 4;

test('Day view renders seeded items and filters by category', async ({ page }) => {
  await bootSchedule(page, {
    autoNavigate: true,
    seed: { schedulesToday: true },
  });

  const dayItems = page.getByTestId('schedule-day-root').getByTestId('schedule-item');
  await expect(dayItems).toHaveCount(SEEDED_EVENT_COUNT);

  await page.getByTestId('schedules-filter-category').selectOption('Staff');
  await expect(dayItems).toHaveCount(1);

  await page.getByTestId('schedules-filter-query').fill('送迎');
  await expect(dayItems).toHaveCount(1);
});
```

同じ seed で Week ビューのフィルターも検証できます（`schedule-day.happy-path` の 2 つ目のテスト参照）。Week タイムラインを開く際は `gotoWeek` と `waitForWeekViewReady` で V1/V2 両対応の helper を使う想定です。

### 3-1. Day ビュー (スモーク)

```ts
test('Day view shows user care event', async ({ page }) => {
  await gotoDay(page, TEST_DATE);
  await waitForDayViewReady(page);

  await assertDayHasUserCareEvent(page, {
    serviceContains: '生活介護',
  });
});
```

### 3-2. Week ビュー (カード編集)

```ts
test('Week view opens edit dialog for an existing event', async ({ page }) => {
  await gotoWeek(page, TEST_DATE);
  await waitForWeekViewReady(page);

  const items = await getWeekScheduleItems(page);
  await expect(items).not.toHaveLength(0);

  await openWeekEventCard(page, items.first());
  await expect(page.getByTestId('schedule-create-dialog')).toBeVisible();
});
```

### 3-3. Quick ダイアログでの作成

```ts
test('creates a user-care schedule via quick dialog', async ({ page }) => {
  await gotoDay(page, TEST_DATE);
  await waitForDayViewReady(page);

  await openQuickUserCareDialog(page);
  await fillQuickUserCareForm(page, {
    title: '生活介護 送迎',
    userInputValue: '田中',
    serviceOptionLabel: '生活介護',
    notes: '自宅から通所',
  });
  await submitQuickUserCareForm(page);

  await assertDayHasUserCareEvent(page, {
    titleContains: '田中',
    serviceContains: '生活介護',
  });
});
```

---

## 4. Status / Service の検証方針

UI だけでなく **保存データ** も確認する。

### 4-1. カード編集

1. `gotoWeek` → `waitForWeekViewReady`
2. `getWeekScheduleItems` → `openWeekEventCard`
3. ダイアログでステータス変更
4. `window.__scheduleMocks__` などを通じて **対象 ID とステータス** を検証 (必要に応じて)

### 4-2. Quick ダイアログで「生活介護 休み」を登録

`schedule.status-service.smoke.spec.ts` では保存後に SharePoint スタブを直接読み、`Title` / `cr014_serviceType` を検証します。

```ts
test('介護休み entry via quick dialog persists as 欠席・休み', async ({ page }) => {
  await gotoWeek(page, TEST_DATE);
  await waitForWeekViewReady(page);

  await openQuickUserCareDialog(page);
  await fillQuickUserCareForm(page, {
    title: '生活介護 休み',
    userInputValue: '田中',
    serviceOptionLabel: '欠席・休み',
  });
  await submitQuickUserCareForm(page);

  const createdRecord = await page.evaluate(async () => {
    const response = await fetch(`/_api/web/lists/getbytitle('ScheduleEvents')/items?$select=Id,Title,ServiceType,cr014_serviceType`);
    const data = await response.json();
    return data.value.find((item) => item.Title?.includes('生活介護 休み')) ?? null;
  });

  expect(createdRecord).not.toBeNull();
  expect(String(createdRecord.cr014_serviceType ?? createdRecord.ServiceType ?? '')).toMatch(/欠席|休み/);
});
```

描画タイミングで揺れやすい **タイムライン UI のカード数** ではなく、スタブに保存されたデータを assert することがポイントです。

---

## 5. フィクスチャ設計ルール

- `SCHEDULE_FIXTURE_BASE_DATE` を Day / Week / Month すべてで共有。
- `buildScheduleFixturesForDate` は同じ週に収まる Start / End を設定。
- サービス種別はドメインに沿った名称を使う (例: 生活介護 通常, 生活介護 休み, 送迎, 短期入所)。
- Org / Users / Staff フィクスチャは画面表示される名前 (`磯子区障害支援センター`, `田中 実`, `佐藤 花子` 等) と一致させる。

---

## 6. 新しい spec を書くときのチェックリスト

1. `goto*` / `waitFor*ViewReady` / `scheduleActions` を使っているか？
2. `bootSchedule` の `sharePoint.lists` / `extraLists` で必要なリスト (Schedules / Org / Users / Staff) をまとめて stub しているか？
3. feature flag / fixtures モードは既存 spec と揃っているか？
4. 状態確認は UI だけでなく、必要ならスタブされたデータも参照しているか？
5. 新しい testid が必要なら `src/testids.ts` まで追加済みか？

---

## 7. Tips

- 日本語ラベルとコード値が揺れる場合は `serviceContains('生活介護')` のような部分一致ヘルパーで吸収する。
- Week には旧 ListView (`schedule-week-root`) と新 Timeline (`schedule-week-view`) があるため、**selector 直書きではなく helper 経由** でカードを操作する。
- エラー発生時は `error-context.md` から `[schedule]` や SharePoint 400 ログを確認すると原因特定が早い。

---

この Playbook に沿えば、UI 実装や feature flag を差し替えても Helper / Fixture 層を少し直すだけで全 spec を保守しやすい状態を維持できます。

---

## Troubleshooting

### 1. WeekTimeline でカードが 0 件になる

**現象:** `waitForWeekViewReady` は通るが `getWeekScheduleItems` が 0 件を返し、week 系テストがカードを見つけられない。

**原因:**

- フィクスチャの `Start` / `End` が `TEST_DATE` の週から外れている
- `SCHEDULE_FIXTURE_BASE_DATE` が `TEST_NOW`（テスト開始時刻）と同じ週になっていない
- SharePoint モードではなく demo fixtures が有効化されている

**対応:**

- `buildScheduleFixturesForDate(SCHEDULE_FIXTURE_BASE_DATE)` を使う
- `SCHEDULE_FIXTURE_BASE_DATE` をテストで開く週に合わせる
- `VITE_FEATURE_SCHEDULES_SP=1`, `VITE_SCHEDULE_FIXTURES=0` など、SharePoint ポート + fixtures OFF を強制する

---

### 2. Org マスタの 404 が出る

**現象:** コンソールに `Org_Master` の 404 が出て Org フィルタや org チップが初期化されない。

**原因:** `setupSharePointStubs` に Org マスタ用フィクスチャを渡していない。

**対応:** Org スタブを必ず含める。

```ts
const orgMasterFixtures = [
  {
    Id: 1,
    Title: '磯子区障害支援センター',
    OrgCode: 'ORG-ISO',
    Audience: 'Staff,User',
  },
];

await setupSharePointStubs(page, {
  lists: [
    { name: 'Schedules_Master', items: buildScheduleFixturesForDate(TEST_DATE) },
    { name: 'Org_Master', items: orgMasterFixtures },
  ],
});
```

Audience フィールドを実装側のフィルタ条件（例: `Staff`）と揃えること。

---

### 3. 保存後に UI にカードが出ない（特に Quick Create）

**現象:** Quick Dialog / Full Dialog の保存は成功しているが、WeekTimeline に新しいカードが出ない・DOM ベースの検証が失敗する。

**原因:** WeekTimeline の再描画タイミングが遅延したり、ステータス/サービスが省略表示されるレイアウト差分がある。

**対応:**

- Status / Service 検証は SharePoint スタブのレスポンスを直接読む
- `__scheduleMocks__` や `fetch('/_api/web/lists/getbytitle('ScheduleEvents')/items')` を使って保存結果を assert
- UI 側は「カードが 1 件以上ある」など最低限の確認にとどめ、厳しすぎる DOM 依存を避ける

---

### 4. Day / Week / Month のタブ切替が反応しない

**現象:** Day → Week → Month に切り替えたつもりでも URL / 画面が stale のまま。

**原因:** `page.click()` 等で独自にタブを叩き、URL クエリと view-ready の同期が取れていない。

**対応:** `scheduleNav.ts` の `gotoDay` / `gotoWeek` / `gotoMonth` を必ず使い、直後に `waitFor*ViewReady` を呼ぶ。URL 期待値の検証も helper が作るフォーマットに合わせる。

---

## Public API (`scheduleActions`)

Schedule 向け E2E は、原則この API Surface だけで十分に記述できるよう設計してある。

### Navigation / Load

- `waitForDayViewReady(page)` — Day タブが完全に描画されるまで待つ
- `waitForWeekViewReady(page)` — 旧/新 Week ビューのカードコンテナが安定するまで待つ
- `waitForMonthViewReady(page)` — Month ビューのカレンダーが描画されるまで待つ

> 画面遷移は `scheduleNav.ts` の `gotoDay` / `gotoWeek` / `gotoMonth` を使う想定。

### Timeline Helpers

- `getWeekScheduleItems(page)` — Week ビュー上の `schedule-item` 要素群を取得
- `openWeekEventCard(page, item)` — 任意のアイテムを開いて編集ダイアログを表示
- `assertWeekHasUserCareEvent(page, opts)` — Week 上に利用者ケアのイベントが存在することを確認

### Day Helpers

- `assertDayHasUserCareEvent(page, opts)` — Day ビューに所定のタイトル/サービスを含むイベントが表示されているか確認

### Quick Dialog Helpers

- `fillQuickUserCareForm(page, opts)` — Quick Create ダイアログの主要フィールドを一括入力
- `submitQuickUserCareForm(page)` — Quick Create を送信し、ダイアログが閉じるまで待つ

---

## Appendix: よく使う Schedule TestIDs

### Root / Page

- `schedule-page-root`
- `schedule-day-root`
- `schedule-week-root`
- `schedule-month-root`
- `schedule-list-root`

### Timeline Items

- `schedule-item`
- `schedule-item-title`
- `schedule-item-service`
- `schedule-item-status`

### Dialogs

- `schedule-dialog`
- `schedule-dialog-title`
- `schedule-dialog-start`
- `schedule-dialog-end`
- `schedule-dialog-status`
- `schedule-dialog-service`

### Quick Dialog

- `schedule-create-quick-button`
- `schedule-create-user-input`
- `schedule-create-service-type`
- `schedule-create-status`
- `schedule-create-submit`

### Filters

- `schedules-filter-category`
- `schedules-filter-query`

### Tabs

- `schedules-tab-day`
- `schedules-tab-week`
- `schedules-tab-month`
