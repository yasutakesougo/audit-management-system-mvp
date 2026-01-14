# CRUD 実装テンプレート（Schedules から確立したパターン）

> **目的**: SharePoint × React における CRUD 実装を安全で高速に量産するための最小チェックリスト。  
> **対象**: Users / Daily / その他エンティティの CRUD 実装時に引用。  
> **前例**: `feat(schedule): complete delete/update flow...` 参照。

---

## 1. Port 契約の設計

### ✅ 必須ルール

```typescript
// ❌ 避けるべき（optional に頼る危険性）
export interface EntityPort {
  list(range: DateRange): Promise<Item[]>;
  create?(input: CreateInput): Promise<Item>;
  update?(input: UpdateInput): Promise<Item>;
  remove?: (id: string) => Promise<void>;  // optional = 検出漏れの温床
}

// ✅ 正解（必須化で型チェックを強制）
export interface EntityPort {
  list(range: DateRange): Promise<Item[]>;
  create(input: CreateInput): Promise<Item>;  // 必須
  update(input: UpdateInput): Promise<Item>;  // 必須
  remove(id: string): Promise<void>;          // 必須化 = ビルド時に契約ズレ検出
}
```

### ✅ 未対応 Backend への対応

すべての Adapter（Demo/SharePoint/Graph）が Port を満たす必要がある。  
Graph など未対応なら **明示的にエラー** を投げる（沈黙の失敗を防ぐ）：

```typescript
// graphAdapter.ts
export const makeGraphEntityPort = (...): EntityPort => {
  return {
    // ...
    remove(_id: string): Promise<void> {
      throw new Error('Graph adapter does not support entity deletion');
    },
  } satisfies EntityPort;  // satisfies で型チェック強制
};
```

---

## 2. Adapter 実装（SharePoint）

### ✅ DELETE パターン

```typescript
const removeImpl: EntityPort['remove'] = ((): EntityPort['remove'] => {
  if (!acquireToken) throw new Error('No token available');
  
  return async (id: string): Promise<void> => {
    const idNum = Number.parseInt(id, 10);
    if (!Number.isFinite(idNum)) {
      throw new Error(`Invalid id for SharePoint delete: ${id}`);
    }
    
    // IF-MATCH:* ヘッダーで同時実行制御を回避して削除
    await client.deleteItemByTitle(LIST_TITLE, idNum);
    // SharePoint は 200 OK / 204 No Content を返す可能性
    // spClient.deleteItemByTitle で両方対応済み
  };
})();
```

### ✅ PATCH パターン

```typescript
const updateImpl: EntityPort['update'] = ((): EntityPort['update'] => {
  if (!acquireToken) throw new Error('No token available');
  
  return async (input: UpdateInput): Promise<Item> => {
    try {
      const updated = await client.updateItemByTitle(LIST_TITLE, input.id, payload);
      return mapSpRowToItem(updated);
    } catch (error) {
      // エラーハンドリング：ネットワーク/権限エラーはそのまま伝播
      throw withUserMessage(
        toSafeError(error instanceof Error ? error : new Error(String(error))),
        '更新に失敗しました。時間をおいて再試行してください。'
      );
    }
  };
})();
```

---

## 3. UI/UX 最低限（A-1/A-2）

### ✅ A-1: 二重実行防止

**Page レベルでフラグ管理：**

```typescript
// src/features/entities/EntityPage.tsx
const [isInlineSaving, setIsInlineSaving] = useState(false);
const [isInlineDeleting, setIsInlineDeleting] = useState(false);

const handleInlineSubmit = useCallback(
  async (input: CreateInput) => {
    // 多重実行防止（先頭ガード）
    if (isInlineSaving || isInlineDeleting) return;
    
    try {
      setIsInlineSaving(true);
      await update(input);
      notifySnackbarSuccess(showSnack, 'エンティティを更新しました');
      clearSelection();
    } catch (e) {
      notifySnackbarError(showSnack, e, { fallback: '更新に失敗しました' });
      throw e;
    } finally {
      setIsInlineSaving(false);  // finally で必ず解除
    }
  },
  [isInlineSaving, isInlineDeleting, ...]
);
```

**Dialog 側：外部フラグを props で受け取り、ボタン disabled に反映：**

```typescript
// src/features/entities/EntityCreateDialog.tsx
type Props = {
  // ...
  isInlineSaving?: boolean;
  isInlineDeleting?: boolean;
};

export const EntityCreateDialog: React.FC<Props> = ({
  isInlineSaving,
  isInlineDeleting,
  // ...
}) => {
  return (
    <DialogActions>
      <Button
        disabled={submitting || isInlineSaving || isInlineDeleting}
      >
        削除
      </Button>
      <Button
        disabled={submitting || isInlineSaving || isInlineDeleting}
      >
        キャンセル
      </Button>
      <Button
        disabled={submitting || isInlineSaving || isInlineDeleting}
      >
        保存
      </Button>
    </DialogActions>
  );
};
```

### ✅ A-2: Snackbar 統一

**src/lib/notice.ts に追加：**

```typescript
export const notifySnackbarSuccess = (
  showSnack: (severity: 'success' | 'error' | 'info' | 'warning', message: string) => void,
  message: string
): void => {
  showSnack('success', message);
};

export const notifySnackbarError = (
  showSnack: (severity: 'success' | 'error' | 'info' | 'warning', message: string) => void,
  error: unknown,
  options?: { fallback?: string }
): void => {
  console.error('[entity operation]', error);
  const fallback = options?.fallback ?? '操作に失敗しました。時間をおいて再試行してください。';
  showSnack('error', fallback);
};
```

**Page で使用：**

```typescript
import { notifySnackbarSuccess, notifySnackbarError } from '@/lib/notice';

try {
  await update(input);
  notifySnackbarSuccess(showSnack, 'エンティティを更新しました');
} catch (e) {
  notifySnackbarError(showSnack, e, { fallback: '更新に失敗しました' });
}
```

---

## 4. テスト & ゲート

### ✅ 必須検証

```bash
# TypeScript 型チェック（Port 契約ズレ検出）
npm run typecheck

# ESLint（unused params など）
npm run lint

# Unit テスト（各機能が動くか）
npm run test:schedule:mini  # スコープ別のテスト
```

### ✅ Adapter チェック（手動確認）

- [ ] Demo Adapter: 全メソッド実装 ✅
- [ ] SharePoint Adapter: satisfies Port で型チェック ✅
- [ ] Graph Adapter: 未対応メソッドが明示エラー ✅

---

## 5. コミット分割

### ✅ 2 コミット推奨

**Commit 1: 実装本体**

```bash
git add src/features/entities/data/port.ts \
        src/features/entities/data/*Adapter.ts \
        src/features/entities/EntityPage.tsx \
        src/features/entities/EntityCreateDialog.tsx \
        src/lib/notice.ts

git commit -m "feat(entity): complete delete/update flow with type-safe port contract"
```

**Commit 2: ドキュメント（必要に応じて）**

```bash
git add docs/entities-crud-notes.md \
        README.md

git commit -m "docs(entity): add CRUD operation notes"
```

---

## 6. PR 作成のポイント

### ✅ タイトル案

```
feat(entity): complete delete/update flow with type-safe port contract
refactor(entity): unify snackbar notifications  # A-2 がある場合
```

### ✅ 本文に含める項目

- Port 契約の必須化で何を得るのか（型安全性）
- DELETE/PATCH のエラーハンドリング
- UI ガード（A-1） + Snackbar 統一（A-2）
- テスト結果（typecheck/lint/tests all PASS）

---

## 📋 チェックリスト（新規エンティティ CRUD 時）

### 設計フェーズ

- [ ] Port インターフェース定義（create/update/remove を必須化）
- [ ] Demo/SharePoint/Graph Adapter の実装方針を決定
- [ ] UI ガード（A-1）と通知統一（A-2）をスコープに含める

### 実装フェーズ

- [ ] Port 定義 + satisfies で型チェック
- [ ] Adapter: DELETE は IF-MATCH:*、PATCH は try/catch
- [ ] Page: フラグ追加 + ハンドラ先頭ガード
- [ ] Dialog: isInlineSaving/isInlineDeleting props 受け取り → ボタン disable

### テストフェーズ

- [ ] npm run typecheck → Port 契約ズレがないか確認
- [ ] npm run lint → unused params ないか
- [ ] npm run test:schedule:mini → ユニットテスト 全 PASS

### PR フェーズ

- [ ] Commit 分割（実装 + docs）
- [ ] PR 本文に Port 契約の説明を含める
- [ ] テスト結果を末尾に記載

---

## 🎯 次のエンティティ適用例

### Users CRUD（最短 1-2 日）

```
1. Port: UserPort { list, create, update, remove }
2. Adapter: Demo/SharePoint で実装（Graph は未対応）
3. UI: UserPage で A-1/A-2 統合
4. PR: 同パターンで 2 コミット
```

### Daily CRUD（影響範囲広い）

```
1. Port: DailyPort { list, create, update, remove }
2. Adapter: SharePoint DELETE は新規（注意深く設計）
3. UI: DailyPage で同ガード実装
4. PR: 同パターン + 詳細な notes
```

---

## 📚 参考資料

- **Schedules 実装**: `src/features/schedules/` + `docs/sharepoint-crud-notes.md`
- **Port 定義**: `src/features/schedules/data/port.ts`
- **Adapter 例**: `src/features/schedules/data/sharePointAdapter.ts`
- **Snackbar ヘルパー**: `src/lib/notice.ts` の `notifySnackbarSuccess/Error`

---

**最後に：このテンプレは生きた文書です。**  
Users/Daily を実装しながら「あ、こういうパターンもある」と気づいたら、  
遠慮なく追記・改良してください。チーム全体の資産になります。 👊
