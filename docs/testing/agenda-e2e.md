# Agenda / Dashboard E2E Tests

## 1. 対象スコープ

| UI/ページ | 役割 | 代表 spec |
| -------- | ---- | --------- |

- いずれも **「現場の1日の流れ（Agenda）」の入り口** を守るためのスモークテスト。
- 詳細な機能テスト（Schedule / Users / Daily / Nurse）は、それぞれのプレイブックに委譲。

## 2. bootAgenda の使い方

すべての Agenda/Dashboard 系 spec は、以下の 3 ステップを基本レシピとします。

1. `bootAgenda` で共通起動  
2. MSAL / Graph / SharePoint スタブ  
3. UI 操作 & アサーション

```ts
import { test, expect } from '@playwright/test';
import { bootAgenda } from './_helpers/bootAgenda';

test.beforeEach(async ({ page }) => {
  await bootAgenda(page);
});

test('ダッシュボードが表示される', async ({ page }) => {
```

### 2.2 ルート指定の例（将来拡張用）

```ts
await bootAgenda(page, {
  route: '/handoff-timeline', // TODO: handoff timeline 対応時に利用
});
```

### 2.3 SharePoint スタブをカスタマイズする例

```ts
await bootAgenda(page, {
  sharePoint: {
    enabled: true,
    lists: {
      // 例: Dashboard の月次サマリを特定ユーザーだけ変更したいケース
      MonthlyRecord_Summary: {
        onCreate: (item) => ({ ...item, Title: '[test] ' + item.Title }),
      },
    },
  },
});
```

※現時点では sharePoint オプションはダミー実装でも OK。後で Dashboard 向けスタブを生やしたタイミングで、この節を肉付けする想定。

---

## 3. 代表的なシナリオ

### 3.1 dashboard.smoke

- 目的: Dashboard の基本的な構成と主要 CTA が崩れていないことを確認する。
- カバー範囲:
  - 「Operations Dashboard」ヘッダの表示
  - 「マスタースケジュールを開く」など主要 CTA リンクの存在
  - 今日のサマリカード（利用状況・申し送りなど）の表示

### 3.2 module-cards-navigation

- 目的: ホーム上のモジュールカードから、各機能のトップ画面に遷移できることを保証する。
- カバー範囲:
  - Users / Schedule / Daily / Nurse などのカードが表示される
  - 各カードをクリックすると 404 にならず、それぞれのモジュールのトップに遷移する
  - 戻る操作を挟んでもダッシュボードが壊れない

### 3.3 agenda-happy-path (new)

- 目的: `agenda.dashboard.dev.v1` / `schedules.today.dev.v1` の **共通シード**で Dashboard → Agenda → Schedule(day) の大動脈が同じ状態を描画することを証明する。
- カバー範囲:
  - Dashboard の申し送りチップ（未対応 / 対応中 / 対応済 / 合計）が 1/1/1/3 件で揃う
  - 「タイムラインで詳細を見る」CTA 経由で `/handoff-timeline` に遷移し、`data-testid="agenda-timeline-item"` で 3 件の申し送り（佐藤/山田/石井）が表示される
  - Dashboard に戻り「マスタースケジュールを開く」→ Day ビューを `gotoDay(..., getSchedulesTodaySeedDate())` で開くと、`schedules.today.dev.v1` の 3 件（AM 検温 / 昼食前準備 / PM 水分補給）がそのまま描画される
  - テストファイル: `tests/e2e/agenda-happy-path.spec.ts`

---

## 4. Fixtures & シード戦略（今後の方針）

現時点の `bootAgenda` は、主に以下を担当します。

- 環境変数 / localStorage の共通初期化
- ダッシュボードがエラーにならないための最低限のダミーデータ
- ルート遷移（`/dashboard`）

今後の拡張方針:

- `agenda.dashboard.dev.v1` を helper 内でシードして、「申し送りタイムライン」と Dashboard サマリが常に同じ状態になるよう担保
- Dashboard サマリ（今日の利用者数、未記録数など）も固定値でシードし、module-card suite で「カード上の数字」を assert できるようにする

### Seed: agenda.dashboard.dev.v1

- Dashboard の申し送りサマリーと Timeline 表示が参照する決定版フィクスチャ
- `bootAgenda(page, { seed: { agenda: true } })` で `localStorage['handoff.timeline.dev.v1']` に挿入され、module-card 系 spec で必ず件数/重要フラグが立つ
- `tests/e2e/_fixtures/agenda.dashboard.dev.v1.json` に集約し、1 ファイルの編集だけで Agenda/Dashboard/Timeline の UI を同期できる

### Seed: schedules.today.dev.v1

- Dashboard の「今日の予定」カードと Schedule 画面で同じ 1 日分の予定を表示するためのフィクスチャ
- `bootAgenda(page, { seed: { schedulesToday: true } })` で `localStorage['schedules.today.dev.v1']` を初期化し、同時に SharePoint スタブへも同じ予定を流し込みます
- フィクスチャ本体 (`tests/e2e/_fixtures/schedules.today.dev.v1.json`) を編集すれば Agenda ↔ Schedule の E2E が同時に更新されます
- Agenda テスト中に「マスタースケジュールを開く」をクリックしても、Schedule 側が同じ 3 件 (AM 検温 / 昼食前準備 / PM 水分補給) を確実に描画します

---

## 5. トラブルシューティング

### 5.1 `/dashboard` が 404 になる

- `src/app/router.tsx` 側で `path: 'dashboard'` が無効化されていないか確認。
- `bootAgenda` 側で `page.goto('/')` ではなく `page.goto('/dashboard')` を指定しているか確認。

### 5.2 モジュールカードが表示されない

- `src/pages/DashboardPage.tsx` の feature flag (`schedulesEnabled`, `usersEnabled` など) の条件を確認。
- `bootAgenda` で設定する env/localStorage が、実運用と乖離していないか確認。

---

## 6. 今後の TODO

- `bootAgenda` に handoff timeline / dashboard summary 用のシードロジックを追加
- handoff timeline 専用の E2E（例: `handoff.timeline.spec.ts`）を `bootAgenda` ベースに移行
- Dashboard 特有の a11y チェック（カード群 + FAB + タブ）を追加
