# Today Execution Layer — 運用 Runbook

> `/today` 実行層の運用ルール・イベント仕様・トラブルシューティング

---

## 1. Date/Time Rules（JST local ymd）

### ルール

| # | ルール | 根拠 |
|---|--------|------|
| 1 | `ymd` は **ローカル日付（JST）**で生成する | UTC の `toISOString()` は JST 00:00〜08:59 で前日扱いになる |
| 2 | `new Date().toISOString().split('T')[0]` は **禁止** | データキーのズレは復旧困難な事故になる |
| 3 | 日付生成は `getLocalYmd()` に統一する | `useAlertActionState.ts` に定義済み |

### 正しいパターン

```typescript
function getLocalYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
```

### ❌ 禁止パターン

```typescript
// UTC基準 — JST 00:00〜08:59 で前日になる
const ymd = new Date().toISOString().split('T')[0];
```

---

## 2. Observability Events

### `today.briefing_action`（成功イベント）

**発火タイミング**: `handleAction()` が状態遷移を正常に完了した時

| フィールド | 型 | 説明 |
|-----------|------|------|
| `ymd` | string | ローカル日付 YYYY-MM-DD |
| `alertType` | string | absent / late / early |
| `userId` | string | ユーザーID（PII なし） |
| `actionId` | string | contact-confirm / handover-create 等 |
| `prevStatus` | ActionStatus | 遷移前の状態 |
| `nextStatus` | ActionStatus | 遷移後の状態 |
| `source` | string | コンポーネント名 |

### `today.briefing_action_error`（失敗イベント）

**発火タイミング**: localStorage への永続化が失敗した時

| フィールド | 型 | 説明 |
|-----------|------|------|
| `errorClass` | string | `persist_failed_quota` / `persist_failed_parse` / `persist_failed_unknown` |
| `message` | string | エラーメッセージ |

---

## 3. Storage Error Classification

| エラー分類 | 原因 | 対処 |
|-----------|------|------|
| `persist_failed_quota` | localStorage 容量超過 | 古い日付のキーを削除して空きを作る |
| `persist_failed_parse` | JSON パースエラー（破損データ） | 該当キーをクリアして再生成 |
| `persist_failed_unknown` | その他 | `persistentLogger` のログを確認 |

### 重要な設計原則

> 永続化失敗時は **分類してログに記録し、UI は落とさない**（try/catch + continue）。
> ユーザーの操作は React state に反映されるため、画面上の動作は正常に見える。
> リロード後に状態が失われる可能性がある旨を将来的に snackbar で通知する（P1）。

---

## 4. How to Verify（手元での確認手順）

### イベント確認

```bash
# 1. ブラウザで /today を開く
# 2. DevTools Console を開く
# 3. VITE_AUDIT_DEBUG=true で起動（.env.local に設定済みなら不要）
# 4. ブリーフィングアラートの「📞 連絡確認」等をクリック
# 5. Console に [audit:today] today.briefing_action {...} が出力されることを確認
```

### エラーログ確認

```javascript
// DevTools Console で実行
JSON.parse(localStorage.getItem('audit_system_error_logs') || '[]')
```

### テスト

```bash
npx vitest run src/features/today tests/unit/today --reporter=verbose
```

---

## 5. Chaos Test 準備（次回スプリント用）

### 期待される挙動

localStorage への書き込みが失敗しても：

1. **UI は落ちない**（例外は `setState` 内で catch される）
2. **`today.briefing_action_error` イベントが出力される**（`auditLog.error`）
3. **`persistentLogger` にエラーが永続化される**
4. **React state は更新される**（画面上は正常に見える。リロード後に状態が失われる可能性あり）

### モック方法（テスト用）

```typescript
// jsdom 環境で localStorage.setItem を差し替え
const original = window.localStorage.setItem.bind(window.localStorage);
window.localStorage.setItem = vi.fn(() => {
  throw new DOMException('Storage full', 'QuotaExceededError');
});

// テスト実行...

window.localStorage.setItem = original; // 復元
```

### 次回スプリントの検証項目

- [ ] E2E: ブリーフィングアラートの「done」を押した際、localStorage 失敗時に snackbar が表示されること（P1 実装後）
- [ ] Unit: 全 `errorClass` パターンのカバレッジ確認 → **済（`alertActions.storage.spec.ts`）**
- [ ] Integration: `today.briefing_action_error` イベントが DevTools Console に出力されること

---

## 参照

- [ADR-002: Today is an Execution Layer](./adr/ADR-002-today-execution-layer-guardrails.md)
- [ADR-003: Local-day keying & action telemetry](./adr/ADR-003-local-day-keying-action-telemetry.md)
- [AI Skills Protocol](./ai-skills-protocol.md)
