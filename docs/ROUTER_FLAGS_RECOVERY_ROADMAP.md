# router.flags テスト復帰ロードマップ

**目標**: `tests/smoke/router.flags.spec.tsx` を skip → passing に段階化

**現状**: App 全体レンダー試行で timeout → AppShell / ProtectedRoute / ナビアイテム の連携が複雑すぎるため。

**戦略**: 3段階で最小差分から実装 **（いずれか1つが成功すれば次へ進む）**

---

## 📊 現在の Router 構造

```
src/app/router.tsx
  ├─ childRoutes[] ← ここに /audit, /checklist, /self-check etc が定義済み ✅
  └─ routes[] ← AppShell > Outlet > childRoutes（レイアウト統合）
      └─ createBrowserRouter(routes) → export const router

注：Routes の定義は既に分離済み（AppRoutes.tsx のような別ファイルはまだ作成されていない）
```

---

## 🎯 A案（最小・最速） - Routes コンポーネント化

**実装側: 差分 5 ファイル行程度**

### 手順

#### 1️⃣ 新ファイル作成: `src/app/AppRoutes.tsx`

```typescript
// src/app/AppRoutes.tsx
import React from 'react';
import { Outlet, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';

// ★ 既存の childRoutes をここにコピー（再利用）
import { childRoutes } from './router';

/**
 * App 全体のルート定義
 * router.tsx から使用、テストからも直接インポート可能
 */
export const appRouteConfig: RouteObject[] = [
  {
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    children: childRoutes,
  },
];

/**
 * Routes だけレンダー（App 全体のプロバイダーを含めない）
 * Vitest で URL ナビゲーションをテストするためのコンポーネント
 */
export const AppRoutes: React.FC = () => (
  <Routes>{appRouteConfig}</Routes>
);
```

#### 2️⃣ `router.tsx` を簡潔化

```typescript
// src/app/router.tsx（既存部分をそのまま保持）
import { appRouteConfig } from './AppRoutes';

const routes = appRouteConfig;  // ← 参照に変更

export const router = createBrowserRouter(routes, {
  future: routerFutureFlags,
});
```

#### 3️⃣ テスト: `tests/smoke/router.flags.spec.tsx`

```typescript
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRouteConfig } from '@/app/AppRoutes';
import { renderWithAppProviders } from '@/tests/helpers/renderWithAppProviders';

it('route: /audit renders audit-root', async () => {
  const router = createMemoryRouter(appRouteConfig, {
    initialEntries: ['/audit'],
  });

  const { container } = renderWithAppProviders(
    <RouterProvider router={router} />
  );

  // audit-root testid がなければ B案へ進む
  await screen.findByTestId('audit-root');
  expect(screen.getByTestId('audit-root')).toBeInTheDocument();
});

it('route: /checklist renders checklist-root', async () => {
  const router = createMemoryRouter(appRouteConfig, {
    initialEntries: ['/checklist'],
  });

  renderWithAppProviders(
    <RouterProvider router={router} />
  );

  await screen.findByTestId('checklist-root');
  expect(screen.getByTestId('checklist-root')).toBeInTheDocument();
});
```

**このテストが通ったら**: ✅ **router.flags.spec.tsx を passing に変更可能**

**testid が無いなら**: → **B案へ進む**（root testid を追加）

---

## 📍 B案（次点）- Root TestID 付与

**実装側: 差分 3〜5 行 × 2 ファイル**

`/audit` と `/checklist` の route root に `data-testid` を付与

### ファイル修正

#### 1️⃣ `src/features/audit/AuditPanel.tsx`

```typescript
export function AuditPanel() {
  return (
    <div data-testid="audit-root">
      {/* 既存コンテンツ */}
    </div>
  );
}
```

#### 2️⃣ `src/features/compliance-checklist/ChecklistPage.tsx`

```typescript
export function ChecklistPage() {
  return (
    <div data-testid="checklist-root">
      {/* 既存コンテンツ */}
    </div>
  );
}
```

**一度 A案を実行して testid 不足がわかったら、このステップで追加**

---

## 🎭 C案（最後）- 権限 & フラグ固定（ナビ項目テスト）

**実装側: 差分 5〜10 行 × 2 ファイル（nav testid 追加）**

「ナビリンクをクリック → ページ遷移」をテストする場合のみ

### 手順

#### 1️⃣ AppShell のナビにテスト ID を追加

```typescript
// src/app/AppShell.tsx（既存ナビアイテム）
<ListItem>
  <ListItemButton
    component={Link}
    to="/audit"
    data-testid="nav-audit"  // ← テスト用タグ
    selected={location.pathname === '/audit'}
  >
    <ListItemIcon>
      <AuditIcon />
    </ListItemIcon>
    <ListItemText primary="監査ログ" />
  </ListItemButton>
</ListItem>
```

#### 2️⃣ テスト: ナビクリック → ページ遷移

```typescript
it('nav: click audit link → navigate to audit page', async () => {
  const router = createMemoryRouter(appRouteConfig, {
    initialEntries: ['/dashboard'],
  });

  const user = userEvent.setup();
  renderWithAppProviders(
    <RouterProvider router={router} />,
    {
      // 権限/フラグを固定（この段階で必要）
      mockUseUserAuthz: () => ({ isAdmin: true }),
      mockFeatureFlags: { auditLog: true },
    }
  );

  // ナビのリンクをクリック
  await user.click(screen.getByTestId('nav-audit'));

  // ページ遷移を確認
  await screen.findByTestId('audit-root');
  expect(screen.getByTestId('audit-root')).toBeInTheDocument();
});
```

**これはナビ表示 / 権限制御 が絡むので、A+B案が成功してから推奨**

---

## 🚀 優先度ガイド（どれから始めるか）

| 案 | 手順 | 投資 | リスク | 推奨 |
|-----|------|------|--------|------|
| **A** | `AppRoutes.tsx` 作成 | 30分 | 低 | ⭐⭐⭐⭐⭐ **まずこれ** |
| **B** | testid 2箇所追加 | 15分 | 超低 | ⭐⭐⭐⭐ A で失敗したら |
| **C** | ナビ testid + authz mock | 45分 | 中 | ⭐⭐⭐ B で成功したら |

---

## ✅ チェックリスト（実装済み確認）

- [x] Route 定義が `router.tsx` に集中している（分散していない）
- [x] `childRoutes` が既に配列として定義済み
- [x] AppShell が layout wrapper として機能している
- [x] ProtectedRoute / AdminGate が route render 時に作動する
- [ ] 各ページ root に `data-testid` が実装済み（**B案で追加**）
- [ ] ナビアイテムに `data-testid` が実装済み（**C案で追加**）

---

## 📋 次セッション用メモ

**If A案を実行する場合:**

1. `src/app/AppRoutes.tsx` を新規作成
2. `router.tsx` から `childRoutes` を参照
3. `tests/smoke/router.flags.spec.tsx` で 2 test を実行
4. testid が無い場合 → B案に進む

**If testid が足りない場合:**

1. `src/features/audit/AuditPanel.tsx` に `data-testid="audit-root"` を追加
2. `src/features/compliance-checklist/ChecklistPage.tsx` に `data-testid="checklist-root"` を追加
3. テストを再実行

**If ナビ検証が必要な場合:**

1. `src/app/AppShell.tsx` のナビアイテムに `data-testid` を追加
2. テストで `useUserAuthz` / feature flags を mock override
3. ナビクリック → ページ遷移を確認

---

## 📞 質問テンプレート（詰まった場合）

- Q: testid が見つからない？  
  → A: ページ root の `<div>` に `data-testid="xxx-root"` を付与（B案実行）

- Q: ProtectedRoute でブロックされている？  
  → A: テストで `useUserAuthz` を mock（C案実行）

- Q: ナビアイテムがレンダーされていない？  
  → A: feature flag OFF or 権限不足（C案で mock 追加）

---

**最終目標**: `skip → it.todo → ✅ passing`

**推定工数**: A案（30分） + B案（15分） + C案（45分）= **1.5 時間で完全復帰**

