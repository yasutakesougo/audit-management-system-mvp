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

**実装例（このプロジェクトの場合）**
- `src/app/AppShell.tsx` : レイアウト・ナビゲーション中心
- `src/features/**/components/*` : 画面の表示コンポーネント群

---

### B. State（状態・ユースケース）
- **責務**: `useXxx()` hooks に集約
- 取得・整形・フィルタ・ソート・ページング・バリデーション等の "状態の翻訳" を担う
- UIが迷わない形で `viewModel` を返す

**実装例（このプロジェクトの場合）**
- `src/features/**/hooks/*` : 画面用の状態（例: `src/features/meeting/usePriorityFollowUsers.ts`）
- `src/hooks/*` : 横断の状態（auth / settings / capabilities など）

---

### C. Side effects（API・永続化・テレメトリ）
- **責務**: SharePoint/Graph/Storage/Telemetry は「Adapter / Client」に閉じ込める
- UIから直接 fetch しない

**実装例（このプロジェクトの場合）**
- `src/lib/spClient.ts` : SharePoint REST API クライアント
- `src/lib/msal.ts` : 認証クライアント（存在する場合）
- `src/infra/sharepoint/repos/*` : SharePoint schema mapping / repos
- `src/adapters/*` : 外部I/Fの変換層

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
- 分岐は「状態」で行う（条件式の連鎖を避ける）
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
  （例: items と filteredItems を別々に setState する）

### 推奨
- derived は useMemo で計算し、入力（source）が変わったら自然に更新される構造にする

**例**
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
  → adapter/client（C層）へ
- 重要なバリデーション（UIはエラー表示だけ担当）
- localStorage 永続化（storage/telemetry などのC層へ）

---

## 5. エラーは "分類して表示する"（握りつぶさない）

例: SharePoint / 認証 / ネットワーク / 競合 / 設定不備

### エラー分類（最低限）

| 種別 | 例 | UI導線 |
|------|-----|---------|
| ConfigError | 環境変数・設定不備 | 起動/導線で必ず救う |
| AuthError | 401 / 認証必須 | サインイン促し |
| NetworkError | timeout / 5xx | 再試行・オフライン |
| ConflictError | 412 / ETag | 再読込 or 上書き選択 |
| PermissionError | 403 | 権限説明 |

UI側は `error.kind` を見て、適切な ErrorState を出す。

---

## 6. 競合（412 / ETag）と冪等性を "UIの仕様" に含める

- 更新系は原則 ETag を使う（競合を検知できる）
- バッチ/重複は entryHash 等で冪等化する
- UIは conflict を 1つの明確な状態として扱う（トーストだけで終わらせない）

---

## 7. Feature Flags は "UI分岐" ではなく "ルーティング/能力" で制御する

- featureFlags は画面単位（route単位）でオン/オフ
- UI内部で `if(flag)...` を散らさない（見通しが悪化する）

### 推奨:
- routes で gate する
- capabilities（canRead/canWrite/canUseX）を hook で返す

---

## 8. テスト戦略（UIは結果をテストする）

### Unit（Vitest）
- hook / 変換ロジック / バリデーション / フォーマットを厚め
- UIは「表示」よりも「状態に対する描画」を薄く

### E2E（Playwright）
- "重要シナリオ最小数" に絞る（フレーク回避）
- data-testid は安定キー（見た目変更に耐える）

---

## 9. レビュー時チェックリスト（5問）

1. このUIは **状態を持ちすぎていないか？**（hookへ逃がせるか）
2. API/永続化/telemetry が **UIに漏れていないか？**
3. 分岐は **操作ではなく状態で表現されているか？**
4. error が **分類され、救済導線があるか？**
5. テストは **UIの結果（状態→描画）**を見ているか？

---

## Appendix: 具体例（Before / After）

### Before（混在）
```tsx
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
// A: UI（例: src/pages/TimeFlowSupportRecordPage.tsx）
function SomePage() {
  const vm = useItemsViewModel(); // B
  if (vm.state === 'loading') return <Spinner />;
  if (vm.state === 'error') return <ErrorState error={vm.error} />;
  if (vm.state === 'empty') return <EmptyState />;
  return <List items={vm.items} onSelect={vm.select} />;
}

// B: state（例: src/features/meeting/hooks/useItemsViewModel.ts）
function useItemsViewModel() {
  const q = useItemsQuery(); // C を使う hook
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

// C: side effects（例: src/lib/spClient.ts）
// SharePoint REST API client に実装
```

---

## ✅ 関連ドキュメント

- [ARCHITECTURE_GUARDS.md](../ARCHITECTURE_GUARDS.md) : アーキテクチャルール全般
- [docs/E2E_TEST_STRATEGY.md](./E2E_TEST_STRATEGY.md) : E2Eテスト戦略
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) : プロジェクト固有のコーディング規約
