# ConfirmDialog ガイドライン

> **ステータス**: 確定（2026-03-16）
> **対象**: フロントエンドの全確認ダイアログ

## 目的

`window.confirm` を廃止し、MUI ベースの `ConfirmDialog` + `useConfirmDialog` に統一する。

- **非同期 UI**: `window.confirm` はブラウザネイティブの同期ブロッキング。テストが不安定になる
- **視覚的一貫性**: severity に応じたボタン色・Alert でユーザーにリスクを伝達
- **テスト安定性**: `window.confirm` のモック不要。hook の状態値で検証可能

---

## いつ ConfirmDialog を使うか

| 操作 | severity | 例 |
|------|----------|-----|
| **削除・取り消し困難な操作** | `error` | テンプレート削除、利用者削除 |
| **未保存データの破棄** | `warning` | フォーム離脱、ダイアログ閉じ |
| **リセット** | `warning` | 下書きリセット |
| **軽い実行確認** | `info` | DevPanel の POST 実行 |

> **判断基準**: ユーザーが「あ、間違えた」と思ったとき、元に戻せないなら `error`。戻せるが面倒なら `warning`。軽い確認なら `info`。

---

## 基本パターン

### パターン A: コンポーネント内で完結

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';

function MyComponent() {
  const confirmDialog = useConfirmDialog();

  const handleDelete = (id: number) => {
    confirmDialog.open({
      title: 'テンプレートを削除',
      message: '削除後は元に戻せません。本当に削除しますか？',
      severity: 'error',
      confirmLabel: '削除',
      onConfirm: () => deleteTemplate(id),
    });
  };

  return (
    <>
      <Button onClick={() => handleDelete(1)}>削除</Button>
      <ConfirmDialog {...confirmDialog.dialogProps} />
    </>
  );
}
```

### パターン B: hook が確認を管理 → 呼び出し元が描画

hook 内部で確認が必要な場合（例: 未保存変更の離脱確認）。

**hook 側:**

```ts
import { useConfirmDialog } from '@/components/ui/useConfirmDialog';
import type { ConfirmDialogProps } from '@/components/ui/ConfirmDialog';

export function useMyForm({ onClose }: Props) {
  const confirmDialog = useConfirmDialog();

  const handleClose = useCallback(() => {
    if (isDirty) {
      confirmDialog.open({
        title: '編集を破棄',
        message: '保存されていない変更があります。閉じますか？',
        severity: 'warning',
        confirmLabel: '閉じる',
        onConfirm: () => onClose?.(),
      });
      return;
    }
    onClose?.();
  }, [isDirty, onClose, confirmDialog]);

  // ConfirmDialogProps 型で返す
  const closeConfirmDialog: ConfirmDialogProps = confirmDialog.dialogProps;

  return { handleClose, closeConfirmDialog };
}
```

**呼び出し元:**

```tsx
function MyForm() {
  const { handleClose, closeConfirmDialog } = useMyForm({ onClose });

  return (
    <>
      <Dialog onClose={handleClose}>...</Dialog>
      <ConfirmDialog {...closeConfirmDialog} />
    </>
  );
}
```

---

## Props 一覧

| Prop | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `open` | `boolean` | - | ダイアログの表示状態 |
| `title` | `string` | - | タイトル |
| `message` | `string` | - | 本文メッセージ |
| `warningText` | `string?` | - | Alert 内に表示する補足テキスト |
| `severity` | `'warning' \| 'error' \| 'info'` | `'warning'` | ボタン色・Alert severity |
| `confirmLabel` | `string` | `'OK'` | 確認ボタンのラベル |
| `cancelLabel` | `string` | `'キャンセル'` | キャンセルボタンのラベル |
| `onConfirm` | `() => void` | - | 確認時コールバック |
| `onCancel` | `() => void` | - | キャンセル時コールバック |
| `busy` | `boolean` | `false` | 処理中フラグ（ボタン無効化） |

---

## テスト

`window.confirm` のモックは不要。hook の返す状態値で検証する。

```ts
// ✅ 良いテスト
it('opens confirm dialog when dirty', () => {
  const { result } = renderHook(() => useMyForm({ onClose }));
  act(() => result.current.setField('name', '変更'));
  act(() => result.current.handleClose());

  expect(result.current.closeConfirmDialog.open).toBe(true);
  expect(onClose).not.toHaveBeenCalled();
});

it('calls onClose when confirmed', () => {
  // ... handleClose() で開く ...
  act(() => result.current.closeConfirmDialog.onConfirm());
  expect(onClose).toHaveBeenCalledTimes(1);
});

// ❌ 禁止: window.confirm のモック
vi.spyOn(window, 'confirm').mockReturnValue(true); // ← やらない
```

---

## 禁止事項

| ❌ 禁止 | ✅ 代わりに |
|--------|-----------|
| `window.confirm(...)` | `confirmDialog.open({ ... })` |
| hook 内で直接 `<Dialog>` を返す | hook は props を返し、呼び出し元が描画 |
| severity 無指定のまま削除操作 | 削除は `severity: 'error'` を明示 |

---

## ファイル配置

```
src/components/ui/
├── ConfirmDialog.tsx       # UIコンポーネント
├── useConfirmDialog.ts     # 状態管理hook
└── __tests__/
    └── ConfirmDialog.spec.tsx  # 6件のユニットテスト
```

---

## 導入実績（全9箇所 → 0 window.confirm）

| ファイル | 用途 | severity |
|---------|------|----------|
| `UsersPanel.tsx` | 利用者削除 | `error` |
| `UsersPanel.tsx` | 利用者復元 | `warning` |
| `SupportPlanGuidePage.tsx` | テンプレート削除 | `error` |
| `useStaffForm.ts` | 未保存変更の確認 | `warning` |
| `useDailyRecordFormState.ts` | 未保存変更の確認 | `warning` |
| `TimeBasedSupportRecordForm.tsx` | 未保存変更の確認 | `warning` |
| `useDraftFieldHandlers.ts` | リセット確認 | `warning` |
| `SpDevPanel.tsx` | POST 実行確認 | `info` |
| `SupportPlanGuidePage.tsx` | リセット確認 | `warning` |
