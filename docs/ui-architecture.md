# UI Architecture Principles (Project One-Pager)

> **目的**: UIを「見た目」ではなく「状態と責務」で安定させ、拡張とテストを容易にする。  
> **対象**: React + TypeScript + Vite / (MUI / Fluent) / MSAL / SharePoint REST / feature flags / Playwright

---

## 0. 合言葉
**UIは "状態の翻訳機"。責務を混ぜない。状態遷移で考える。**

---

## 1. 3レイヤー分離（必須）

UI実装は、原則として以下の3層に分割する。

### A. Presentational（見た目・アクセシビリティ）
- **責務**: props だけで描画できる（極力）
- ビジネスロジック / API / localStorage に触らない
- a11y（aria-label/role/tab order/aria-live）をここで完結させる

**実例（このリポジトリ内）**
- [`src/app/AppShell.tsx`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/app/AppShell.tsx) : レイアウト・ナビゲーション中心
- `src/features/**/components/*` : 画面の表示コンポーネント群（例: `src/features/dashboard/`, `src/features/daily/`）

---

### B. State（状態・ユースケース）
- **責務**: `useXxx()` hooks に集約
- 取得・整形・フィルタ・ソート・ページング・バリデーション等の "状態の翻訳" を担う
- UIが迷わない形で `viewModel` を返す

**実例（このリポジトリ内）**
- `src/features/**/hooks/*` : 画面用の状態（例: `src/features/users/hooks/`, `src/features/schedules/hooks/`）
- `src/hooks/*` : 横断の状態（auth / settings / capabilities など）

---

### C. Side effects（API・永続化・テレメトリ）
- **責務**: SharePoint/Graph/Storage/Telemetry は「Adapter / Client」に閉じ込める
- UIから直接 fetch しない

**実例（このリポジトリ内）**
- [`src/lib/spClient.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/spClient.ts) : SharePoint REST API client
- [`src/lib/msal.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/msal.ts) : MSAL 認証トークン取得
- [`src/lib/audit.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/audit.ts) : localStorage への監査ログ書き込み
- [`src/infra/sharepoint/repos/schedulesRepo.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/infra/sharepoint/repos/schedulesRepo.ts) : スケジュールリストの CRUD
- `src/adapters/*` : 外部I/Fの変換層（必要なら）

---

## 2. "状態遷移" を設計単位にする（操作ではなく）

UIは「ボタン押した」ではなく、状態がどう動くかで設計・説明できること。

### 代表ステート（例）
```ts
type LoadingState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'saving'
  | 'conflict'   // 例: 412 / ETag
  | 'offline';

type PermissionState = {
  canRead: boolean;
  canWrite: boolean;
  writeDisabled: boolean; // feature flag / demo mode など
};
```

### ルール
- **分岐は「状態」で行う**（条件式の連鎖を避ける）
- 状態は hook の返り値で表現し、UIはそれを描画するだけにする

### 推奨パターン（例）
```tsx
const vm = useSomethingViewModel();

if (vm.state === 'loading') return <Spinner />;
if (vm.state === 'error') return <ErrorState error={vm.error} />;
if (vm.state === 'empty') return <EmptyState />;
return <SomethingList {...vm.propsForList} />;
```

---

## 3. "One Source of Truth" と "Derived state" を区別する

- **Single source of truth**: サーバ由来 or 正規のストア値（SharePoint / react-query cache / zustand store）
- **Derived state**: 表示都合で派生した値（絞り込み結果、並び替え結果、集計ラベル、未入力件数など）

### 禁止
- derived state を二重保存して "同期地獄" を作ること  
  （例: `items` と `filteredItems` を別々に setState する）

### 推奨
- derived は `useMemo` で計算し、入力（source）が変わったら自然に更新される構造にする

**例**:
```tsx
const users = useUsersStore((s) => s.users);

const filtered = useMemo(
  () => users.filter((u) => u.priority >= 3),
  [users]
);
```

---

## 4. UIコンポーネントの責務ガイド（判断基準）

### UIに置いてよいもの
- 見た目（レイアウト、余白、タイポグラフィ）
- a11y（aria-label, aria-live, focus, keyboard）
- 「ユーザーの意図」をイベントとして外へ渡す（onClick/onChange）

### UIに置かないもの
- API呼び出し、token取得、SharePointクエリ構築  
  → `src/lib/spClient.ts` / `src/lib/msal.ts` / `src/infra/sharepoint/repos/*` へ
- 重要なバリデーション（UIはエラー表示だけ担当）
- localStorage 永続化（`src/lib/audit.ts` / `src/lib/notice.ts` へ）

---

## 5. エラーは "分類して表示する"（握りつぶさない）

例: SharePoint / 認証 / ネットワーク / 競合 / 設定不備

### エラー分類（最低限）

| 種別 | 例 | UI導線 |
|------|---|--------|
| `ConfigError` | 環境変数・設定不備 | 起動/導線で必ず救う |
| `AuthError` | 401 / 認証必須 | サインイン促し |
| `NetworkError` | timeout / 5xx | 再試行・オフライン |
| `ConflictError` | 412 / ETag | 再読込 or 上書き選択 |
| `PermissionError` | 403 | 権限説明 |

UI側は `error.kind` を見て、適切な `ErrorState` を出す。

**実例**: [`src/lib/notice.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/notice.ts) の `withUserMessage()` で分類

---

## 6. 競合（412 / ETag）と冪等性を "UIの仕様" に含める

- 更新系は原則 ETag を使う（競合を検知できる）
- バッチ/重複は `entryHash` 等で冪等化する
- UIは `conflict` を 1つの明確な状態として扱う（トーストだけで終わらせない）

**実例**: [`src/infra/sharepoint/repos/schedulesRepo.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/infra/sharepoint/repos/schedulesRepo.ts) で ETag 付き更新

```typescript
await useSP().updateItem(
  'Schedules',
  id,
  payload,
  { etag: schedule.etag } // 412 if stale
);
```

---

## 7. Feature Flags は "UI分岐" ではなく "ルーティング/能力" で制御する

- `featureFlags` は画面単位（route単位）でオン/オフ
- UI内部で `if(flag)...` を散らさない（見通しが悪化する）

**推奨**:
- `routes` で gate する
- `capabilities`（canRead/canWrite/canUseX）を hook で返す

**実例**: [`src/lib/env.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/env.ts) で読み取り、`src/app/routes.tsx` でルート制御

```typescript
export const readViteBool = (key: string, fallback = false): boolean => {
  // ビルド時に決まるフラグ
};

// routes.tsx
{
  path: '/schedules',
  element: readViteBool('VITE_ENABLE_SCHEDULES') ? <SchedulesPage /> : <NotFound />,
}
```

---

## 8. テスト戦略（UIは結果をテストする）

### Unit（Vitest）
- hook / 変換ロジック / バリデーション / フォーマットを厚め
- UIは「表示」よりも「状態に対する描画」を薄く

### E2E（Playwright）
- "重要シナリオ最小数" に絞る（フレーク回避）
- data-testid は安定キー（見た目変更に耐える）
- **実例**: `tests/e2e/smoke/` - サインイン/ダッシュボード/記録保存

---

## 9. レビュー時チェックリスト（5問）

PRレビューでは次の5問で判定する。

1. このUIは **状態を持ちすぎていないか**？（hookへ逃がせるか）
2. API/永続化/telemetry が **UIに漏れていないか**？
3. 分岐は **操作ではなく状態**で表現されているか？
4. error が **分類され、救済導線があるか**？
5. テストは **UIの結果（状態→描画）** を見ているか？

---

## Appendix A: 推奨ディレクトリ構造（実例マッピング）

```
src/
├── features/<feature>/
│   ├── components/*     : presentational (A層)
│   ├── hooks/*          : state (B層)
│   └── data/*           : adapters/clients (C層) ※まだ少数
├── lib/*                : cross-cutting clients (useSP, auth, telemetry) (C層)
├── infra/sharepoint/    : SharePoint schema mapping & repos (C層)
├── adapters/*           : external API clients (C層)
├── app/*                : shell, routing, theme, flags
├── components/*         : shared presentational (A層)
└── hooks/*              : shared state (B層)
```

| 層 | 実ファイル例（このリポジトリ内） |
|----|-------------------------------|
| **A (Presentational)** | [`src/app/AppShell.tsx`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/app/AppShell.tsx), `src/features/dashboard/components/*`, `src/features/daily/components/*` |
| **B (State)** | `src/features/users/hooks/*`, `src/features/schedules/hooks/*`, `src/hooks/useAuth.ts` |
| **C (Side effects)** | [`src/lib/spClient.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/spClient.ts), [`src/lib/msal.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/msal.ts), [`src/lib/audit.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/lib/audit.ts), [`src/infra/sharepoint/repos/schedulesRepo.ts`](https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/src/infra/sharepoint/repos/schedulesRepo.ts) |

---

## Appendix B: 具体例（Before / After）

### Before（混在）
```tsx
// ❌ API呼び出し、state、UIが全部混ざっている
function SomePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/items')
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return loading ? <Spinner /> : <List items={items} />;
}
```

### After（3層分離）
```tsx
// ✅ A層: Presentational (UI)
function SomePage() {
  const vm = useItemsViewModel(); // B層

  if (vm.state === 'loading') return <Spinner />;
  if (vm.state === 'error') return <ErrorState error={vm.error} />;
  if (vm.state === 'empty') return <EmptyState />;
  return <List items={vm.items} onSelect={vm.select} />;
}

// ✅ B層: State (hooks/useItemsViewModel.ts)
function useItemsViewModel() {
  const q = useItemsQuery(); // C層を使う hook
  const items = useMemo(() => q.data ?? [], [q.data]);

  if (q.isLoading) return { state: 'loading' as const };
  if (q.error) return { state: 'error' as const, error: q.error };
  if (items.length === 0) return { state: 'empty' as const };

  return {
    state: 'success' as const,
    items,
    select: (id: string) => {/* ... */},
  };
}

// ✅ C層: Side effects (lib/spClient.ts)
async function fetchItems() {
  return useSP().queryItems('Items', { top: 50 });
}
```

---

## まとめ

- **状態 = 設計単位**（操作ではなく）
- **3層分離**（A: UI / B: hooks / C: adapters）
- **エラーは分類**（握りつぶさない）
- **Feature Flags はルート層**（UIに散らさない）
- **テストは結果を見る**（状態→描画）

**次のステップ**: PR時に「5問チェック」を使い、違反箇所を指摘する。
