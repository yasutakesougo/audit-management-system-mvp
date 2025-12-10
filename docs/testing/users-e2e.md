# Users E2E Playbook

Users ページ（一覧・詳細・支援手順タブ）のエンドツーエンドテストを増やすときに守りたいルールをまとめました。狙いは次の 3 点です。

- すべての spec を `bootUsersPage` 経由で起動し、環境変数と localStorage を統一する
- Users_Master / Org_Master の SharePoint スタブを 1 箇所で定義し、各 spec から上書きできるようにする
- 詳細メニューや quick access を UI 上で検証しつつ、対象外ユーザーの警告などドメイン固有の分岐も抑える

---

## 1. 対象ファイルとユーティリティ

現状メインとなる E2E spec:

- `tests/e2e/users.detail-flow.spec.ts`
- `tests/e2e/users-support-flow.spec.ts`
- `tests/e2e/users-basic-edit-flow.spec.ts`

共通で利用するヘルパー・定数:

- `tests/e2e/_helpers/bootUsersPage.ts`
  - env / storage の初期化 + SharePoint スタブ設定を一括で実施
- `src/features/users/constants.ts`
  - DEMO_USERS（IsSupportProcedureTarget などの属性付き）をブート時のフィクスチャとして再利用
- `src/testids.ts`
  - `users-panel-root`, `users-quick-prefix`, `user-menu-tabpanel-prefix` など、Users UI の data-testid 一覧

> Users E2E の基本レシピは「① `bootUsersPage` でブート → ② MSAL / Graph を stub → ③ 一覧・詳細・編集などの UI 操作と assert」の 3 ステップ。これを守ればどの spec でも同じ土台で組めます。

---

## 2. bootUsersPage の使い方

`bootUsersPage(page, options)` は以下をまとめて行います。

1. `VITE_SKIP_LOGIN`, `VITE_DEMO_MODE`, `VITE_FEATURE_USERS_CRUD` などの env を `window.__ENV__` に書き込む
2. `localStorage` に `skipLogin`, `feature:usersCrud`, `demo` を設定
3. Users_Master / Org_Master の SharePoint スタブを起動（`setupSharePointStubs` を内部呼び出し）
4. `options.env`, `options.storage`, `options.demoUsers`, `options.sharePoint.extraLists` などで上書きできる

### 2-1. 最小パターン

```ts
import { bootUsersPage } from './_helpers/bootUsersPage';

test.beforeEach(async ({ page }) => {
  await bootUsersPage(page);
});
```

### 2-2. env / storage を追加したい場合

```ts
test.beforeEach(async ({ page }) => {
  await bootUsersPage(page, {
    env: {
      VITE_PREFETCH_HUD: '1',
      VITE_ALLOW_WRITE_FALLBACK: '1',
    },
    storage: {
      writeEnabled: '1',
    },
  });
});
```

### 2-3. Users_Master フィクスチャを差し替える場合

```ts
import type { IUserMaster } from '@/features/users/types';

test.beforeEach(async ({ page }) => {
  const customUsers: IUserMaster[] = [
    { Id: 900, UserID: 'U-900', FullName: 'テスト太郎', IsSupportProcedureTarget: true },
  ];

  await bootUsersPage(page, {
    demoUsers: customUsers,
    sharePoint: {
      extraLists: [
        { name: 'SupportRecord_Daily', items: [] },
      ],
    },
  });
});
```

> 既存 spec では Graph API / MSAL まわりの rout e stub を `bootUsersPage` の後に追加しています（例: `page.route('**/login.microsoftonline.com/**', ...)`).

---

## 3. 代表的なフロー

### 3-1. 利用者詳細メニュー（`users.detail-flow.spec.ts`）

- `/users` でタブを切り替えて一覧 → 詳細 → quick access を確認
- `/users/U-002` に直アクセスし、支援手順・支援計画・モニタリングの各 quick ボタンがタブを切り替えることを検証

### 3-2. 支援手順タブ（`users-support-flow.spec.ts`）

- `U-001`（支援手順対象）で quick access → `支援手順兼記録` タブがアクティブになることを確認
- `U-004`（支援手順対象外）では、同じタブで警告メッセージ「この利用者は支援手順記録の対象に設定されていません。」が表示されることを検証

### 3-3. 基本情報編集（`users-basic-edit-flow.spec.ts`）

- 一覧タブで `U-001` を開き、詳細パネル経由で「編集」ダイアログを起動
- 「ふりがな」フィールドを書き換えて保存すると、ダイアログが閉じ最新値が `user-detail-pane` に即時反映されることを確認
- `user-detail-sections` では「未登録」→ 更新後のかな文字列へ置き換わること、`updateUser` が SharePoint スタブ経由でも整合することを担保

---

## 4. SharePoint スタブとデータ整合性

- Users 系 spec では最低限 `Users_Master` と `Org_Master` をスタブする（`bootUsersPage` がデフォルトで実施）
- 追加で Daily Records などが必要になった場合は `sharePoint.extraLists` を渡し、`setupSharePointStubs` の `onCreate` / `onUpdate` を活用する
- DEMO_USERS の `IsSupportProcedureTarget` フラグを変えることでタブの対象 / 対象外分岐を簡単に再現可能

---

## 5. テスト追加時のチェックリスト

1. `bootUsersPage` を `test.beforeEach` で呼んでいるか？
2. Graph / MSAL のルートモックを忘れていないか？
3. `TESTIDS` 経由で selector を参照しているか？（文字列直書き禁止）
4. 支援手順対象フラグなど、ドメイン条件を DEMO_USERS / カスタムフィクスチャで表現できているか？
5. 警告メッセージやタブの `aria-selected` など、ユーザー操作後の状態を assert できているか？

---

## 6. よく使う Users TestIDs

| 用途 | TestID |
| --- | --- |
| Users 画面ルート | `users-panel-root` |
| 一覧テーブル | `users-list-table` |
| 詳細セクション | `user-detail-sections` |
| Quick access ボタン | `${TESTIDS['users-quick-prefix']}{sectionKey}` |
| メニューカード | `${TESTIDS['user-menu-card-prefix']}{sectionKey}` |
| タブパネル | `${TESTIDS['user-menu-tabpanel-prefix']}{sectionKey}` |

> sectionKey 例: `support-procedure`, `support-plan`, `monitoring` など。Quick access / tabpanel いずれも `tidWithSuffix` で組み立てられているため、E2E でも prefix 文字列 + セクションキーを一致させる。

---

この Playbook を辿れば、Users ドメインの spec も `bootUsersPage` 1 箇所をメンテすれば済む形で増やしていけます。追加のシナリオを作るときは、まずここに書いたパターンとチェックリストを確認してください。
