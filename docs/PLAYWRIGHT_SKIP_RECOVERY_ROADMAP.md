# Playwright skip 2 回収ロードマップ（実装タスク化・最短ルート）

**状況：** Vitest の「構造テスト + レンダースモーク」2段構えが完成。skip 2 はPlaywright へ委譲待ち。

**当番：** router.flags.spec.tsx の skip 2 (`appRender`, `navIntegration`)

---

## 🔍 Step 0：既存 storageState が使えるか確認（最短で勝つ）

**最短コマンド — storageState 生成から検証まで一括実行：**

```bash
# [0-1] SharePoint 認証 setup を実行 → tests/.auth/storageState.json 生成
#       ※ SHAREPOINT_SITE 環境変数が必要
npx playwright test tests/integration/auth.sp.setup.spec.ts --project=integration:setup

# [0-2] 生成確認（パス確認 + origins 検査）
ls -lh tests/.auth/storageState.json
node -e "const s=require('./tests/.auth/storageState.json'); console.log('keys:', Object.keys(s)); console.log('origins:', (s.origins||[]).map(o=>o.origin));"

# [0-3] playwright.config.ts の設定確認
grep -A 5 "baseURL\|webServer" playwright.config.ts
```

**判定フロー：**

```
auth.sp.setup が成功 + tests/.auth/storageState.json が生成された？

  YES → Step 1 に進む（A案：storageState で確定）
  NO  → Step 2 で B案（env override）を検討
```

**補足：** auth.sp.setup.spec.ts の出力先は既に `tests/.auth/storageState.json` に固定されているので、ズレなし ✅

---

## 📋 やること（3ステップ）

### ステップ 1️⃣：tests/e2e/router.smoke.spec.ts を追加（2本だけ）

**ファイル場所：** `tests/e2e/router.smoke.spec.ts` (新規)

**何を作るか：** URL直入で audit-root / checklist-root が visible になることを確認するだけ

**テストのポイント：**
- ✅ testid で判定（テキストは見ない）
- ✅ i18n やコピー変更で壊れない設計
- ✅ ナビ操作なし（URL 直入だけ）
- ✅ 権限制御なし（storageState で admin 固定前提）

**最小実装テンプレート：**

```typescript
import { test, expect } from '@playwright/test';

test.describe('router smoke (e2e) - direct navigation', () => {
  // ※ playwright.config.ts で baseURL が設定されていることを前提
  // ※ storageState が認証済み状態を保証することを前提

  test('navigate to /audit → audit-root visible', async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByTestId('audit-root')).toBeVisible({ timeout: 10_000 });
  });

  test('navigate to /checklist → checklist-root visible', async ({ page }) => {
    await page.goto('/checklist');
    await expect(page.getByTestId('checklist-root')).toBeVisible({ timeout: 10_000 });
  });
});
```

**Done 条件：**
- ✅ `/audit` → `audit-root` visible + page.url() に `/audit` を含む
- ✅ `/checklist` → `checklist-root` visible + page.url() に `/checklist` を含む

**チェックリスト：**
- [ ] ファイル作成：`tests/e2e/router.smoke.spec.ts`
- [ ] 2 テスト追加
- [ ] ローカルで実行: `npx playwright test tests/e2e/router.smoke.spec.ts --headed`
- [ ] CI で実行: `npm run test:e2e` (or similar)

---

### ステップ 2️⃣：権限/ロール固定の方式を決める

**判定：** Step 0 の結果をもとに選択

#### A案：storageState を使う（推奨・最短）

**条件：** Step 0 で storageState.json が存在 + origins に期待 URL が入ってた場合

**設定方法（playwright.config.ts）：**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://localhost:5173', // dev server
    storageState: 'tests/.auth/storageState.json', // ← 既存の認証状態を使う
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

**確認方法：**
```bash
npx playwright test tests/e2e/router.smoke.spec.ts --headed
# ブラウザが立ち上がって、/audit が普通に表示される → ✅ OK
```

#### B案：env override を使う（storageState がない場合）

**事前確認：**
- [ ] `src/lib/env.ts` で `VITE_E2E` / `VITE_SKIP_LOGIN` が定義されているか
- [ ] `src/auth/useAuth.ts` でそれらを読んでるか
- [ ] `src/infra/sharepoint/` で VITE_E2E に対応した mock が存在するか

**設定方法（playwright.config.ts）：**

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'VITE_E2E=1 VITE_SKIP_LOGIN=1 npm run dev', // ← ここで env 設定
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

**確認方法：**
```bash
VITE_E2E=1 VITE_SKIP_LOGIN=1 npm run dev
# ブラウザで http://localhost:5173/audit を開く
# ログイン画面なし → audit-root が見える → ✅ OK
```

---

### ステップ 3️⃣：ナビ経由（Drawer/権限制御）は最後

**優先度：低** — Step 1 + Step 2 が 🟢 になってから

このステップで必要になるもの：
- [ ] `nav-drawer-toggle` testid を [AppShell.tsx](../../src/app/AppShell.tsx) のドロワートリガーに追加
- [ ] `nav-audit-link` testid を [AppShell](../../src/app/AppShell.tsx) のナビ audit リンクに追加
- [ ] `nav-checklist-link` testid を ナビ checklist リンクに追加

**実装例（将来）：**

```typescript
test('navigate via drawer → audit link click → audit-root visible', async ({ page }) => {
  const drawerTrigger = page.getByTestId('nav-drawer-toggle');
  await drawerTrigger.click();
  
  const auditLink = page.getByTestId('nav-audit-link');
  await auditLink.click();
  
  await expect(page.getByTestId('audit-root')).toBeVisible();
});
```

---

## ✅ Done 条件（skip 2 を解除する時）

### Vitest 側（既に完成）

[router.flags.spec.tsx](../../tests/smoke/router.flags.spec.tsx)

- [x] 構造テスト：/audit, /checklist が router.tsx に存在
- [x] レンダースモーク：smoke routes で URL 直入が成功

### Playwright 側（段階的回収）

#### Phase 1: URL 直入テスト完成（skip 2 の 1/2 回収）

**完了条件：**
- [x] `router.smoke.spec.ts` で /audit → audit-root visible + page.url() 確認
- [x] `router.smoke.spec.ts` で /checklist → checklist-root visible + page.url() 確認
- [x] storageState OR env override で認証が通ってる

**Vitest 側で消える skip：**
```typescript
// ファイル: tests/smoke/router.flags.spec.tsx
test.skip('renders app root and loads home page with future flags', ...);
// ↓
test('renders app root and loads home page with future flags', ...);
```

#### Phase 2: ナビ経由テスト完成（skip 2 の 2/2 回収）

**完了条件：**
- [ ] ナビ testid が 3 つ追加（nav-drawer-toggle, nav-audit-link, nav-checklist-link）
- [ ] Drawer → audit link → audit-root visible テスト
- [ ] Drawer → checklist link → checklist-root visible テスト

**Vitest 側で消える skip：**
```typescript
// ファイル: tests/smoke/router.flags.spec.tsx
test.skip('navigates to audit page when link is available', ...);
// ↓
test('navigates to audit page when link is available', ...);
```

---

## 📌 次セッション受け渡し方（超最小情報セット）

Playwright `router.smoke.spec.ts` を実装するときに必要な情報は実質これだけです。

**テンプレート（コピペして埋める）：**

```markdown
### Step 0 の結果

- storageState 存在： YES / NO
- origins に期待 URL が入ってた： YES / NO

### playwright.config.ts から

- baseURL: 
- webServer.command:

### アプリのルート

- /audit ルートは存在する： YES / NO
- /checklist ルートは存在する： YES / NO
```

**これが届いたら：**
```
→ その情報だけで router.smoke.spec.ts を「コピペできる確定版」で出します
→ 認証経路が不明でも迷子にならない
```

---

## 🎯 今すぐやること

**このセッション中に完了可能：**
- [ ] Step 0 実行（上のコマンドをコピペ実行）
- [ ] 結果をテンプレートに埋めて保存
- [ ] Step 1 実装（router.smoke.spec.ts 2本追加）
- [ ] ローカルテスト実行

**次セッション予定：**
- [ ] Step 2 設定（playwright.config.ts 編集）
- [ ] Step 3 実装（ナビ testid + テスト追加）
- [ ] skip 削除 & merge

---

## 📎 参考資料

- [enableMonthly.ts](../tests/e2e/_helpers/enableMonthly.ts) - storageState + env override 実装例
- [router.flags.spec.tsx](../tests/smoke/router.flags.spec.tsx) - Vitest 構造テスト（skip 条件記載）
- [testRoutes.tsx](../tests/_routes/testRoutes.tsx) - smoke route の定義
- [AppShell.tsx](../../src/app/AppShell.tsx) - ナビ組み込み先（testid 追加予定）
