# Interface Drift — 共有シェルへの依存追加による Test Failure

## パターン概要

共有コンポーネント（`AppShell`, `Layout` など）に新しい Provider 依存を持つ子コンポーネントが追加されると、
その Provider を含まないテストが一斉に壊れる。

```
AppShell (shared shell)
 └ FooterQuickActions
     └ NewComponent        ← ここに新依存が入る
         └ useQueryClient()  ← Provider が必要
         └ useToast()        ← Provider が必要
```

## 症状

- **多数のテストが同時に同じエラーで失敗する**
- エラーメッセージ例:
  - `No QueryClient set, use QueryClientProvider to set one`
  - `useToast must be used within a <ToastProvider>`
  - `useXxx must be used within a <XxxProvider>`
- 失敗するテストは **AppShell を render しているテスト全般**
- 変更したファイルとは直接関係のないテストが壊れる

## 検知方法

1. Nightly テスト実行で **10件以上が同じ Provider エラーで失敗** → Interface Drift を疑う
2. エラーのスタックトレースで **AppShell → 新コンポーネント → useXxx** の経路を確認
3. `git log --oneline -10` で **最近マージされた PR** に shared shell 変更がないか確認

## 修正手順

### Step 1: 共有テストヘルパーを修正（最優先）

```
tests/helpers/renderWithAppProviders.tsx
```

ここに不足している Provider を追加すれば、**このヘルパーを使う全テストが一括で修復される**。

```tsx
// 例: QueryClientProvider を追加
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

// render tree に追加
<QueryClientProvider client={queryClient}>
  <ToastProvider>
    <SettingsProvider>
      <RouterProvider router={router} />
    </SettingsProvider>
  </ToastProvider>
</QueryClientProvider>
```

### Step 2: 個別テストを修正

`renderWithAppProviders` を使っていないテスト（直接 `render()` しているもの）は個別に Provider を追加する。

対象を探すコマンド:

```bash
# AppShell を直接 render しているテストを探す
grep -rn "import AppShell" --include="*.spec.*" --include="*.test.*" src/ tests/
```

### Step 3: 確認

```bash
npx vitest run
npx tsc --noEmit
```

両方 green になれば完了。

## 再発防止チェックリスト

AppShell や共有 Layout に新しいコンポーネントを追加する PR では:

- [ ] 新コンポーネントが使う Provider を確認
- [ ] `renderWithAppProviders.tsx` にその Provider が含まれているか確認
- [ ] 含まれていなければ **同じ PR 内で追加する**
- [ ] `npx vitest run` で全テスト green を確認

## 実績

| 日付 | PR | 原因 | 影響 | 修正 |
|------|-----|------|------|------|
| 2026-03-18 | #1069 | `CallLogQuickDrawer` → `useQueryClient()` + `useToast()` | 19 tests failed | `renderWithAppProviders` に `QueryClientProvider` 追加 + 個別テスト 4件修正 |
