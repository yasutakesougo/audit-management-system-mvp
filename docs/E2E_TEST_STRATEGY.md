# E2E テスト戦略: 404 ゲート検証フェーズ化

## 概要

`事故ゼロ運用` の list existence gate を回帰させないため、E2E テストを **2つのプロジェクト** に分け、各々異なるスコープで検証します。

## プロジェクト構成

### 1. chromium（通常 E2E）

**環境設定**
```
VITE_SKIP_SHAREPOINT=1    # SharePoint API 呼び出し禁止
VITE_DEMO_MODE=1          # In-memory ストア使用
```

**テスト対象**
- `tests/e2e/schedules.list-existence-gate.spec.ts:4`
  - "renders schedules week view successfully (tokenReady + listReady gate active)"
  - ゲートが **正常なフロー** で過度にブロックしないことを確認

**実行頻度**
- CI の全テスト実行毎（高速: ~1秒）

**目的**
- ゲート実装の refactor 事故を **即座に検知**
- ProtectedRoute や useAuth の変更による回帰を catch

---

### 2. chromium-sp-integration（SharePoint 統合テスト）

**環境設定**
```
VITE_SKIP_SHAREPOINT=0               # SharePoint API 呼び出し許可
VITE_DEMO_MODE=1                     # 他データは in-memory
VITE_E2E=1                           # E2E mode (mock MSAL)
VITE_FEATURE_SCHEDULES_SP=1          # Schedules 機能有効
```

**テスト対象**
- `tests/e2e/schedules.list-existence-gate.spec.ts:4`（同じ正常系）
- `tests/e2e/schedules.list-existence-gate.spec.ts:25`（現在 `.skip`）
  - "shows error when DailyOpsSignals list returns 404"
  - ゲートが **404 エラー** で確実にエラー表示することを確認
  - route.respond() で DailyOpsSignals API を 404 モック

**実行頻度**
- 定期メンテナンス（週 1 回、nightly）
- デプロイ前の本番事前検証

**目的**
- 実際の 404 エラーパスの正確性を事前検証
- SharePoint 接続ロジックの統合テスト
- 本番で発生しうる症状（list deletion, permission denied）への対応力確認

---

## テストファイル構成

```typescript
// tests/e2e/schedules.list-existence-gate.spec.ts

test.describe('Schedules: list existence gate', () => {
  
  // 全プロジェクトで実行（chromium 優先）
  test('renders schedules week view successfully...', ...)
  
  // chromium-sp-integration のみで実行（nightly）
  test.skip('shows error when DailyOpsSignals list returns 404', ...)
  
});
```

---

## 404 テストの有効化手順（将来）

404 テストは現在 `.skip` 状態です。以下の条件が満たされたら有効化します：

1. **route.respond() モック完成**
   - DailyOpsSignals API 404 を確実に模擬
   - Authentication headers ヘッダーの互換性確認

2. **useSchedules.ts のエラーハンドリング確認**
   - `tryGetListMetadata()` で 404 を正確に検知
   - ProtectedRoute に listReady=false を通知

3. **ProtectedRoute のエラー UI 表示確認**
   - "スケジュール用の SharePoint リストが見つかりません" メッセージ表示
   - 管理者連絡先表示

有効化時は以下コマンドで検証：
```bash
# nightly 実行
npx playwright test tests/e2e/schedules.list-existence-gate.spec.ts --project=chromium-sp-integration --reporter=list

# 手動検証（開発時）
PLAYWRIGHT_PROJECT=chromium-sp-integration npx playwright test ... --headed --debug
```

---

## セッションキャッシュ戦略

List check は `sessionStorage.__listReady` でキャッシュされます：

- **値: `null`** → 未実行、実行中
- **値: `true`** → リスト存在確認済み、OK
- **値: `false`** → リスト 404、エラー表示

キャッシュ機能：
- 同一セッション内での無駄な API 再実行を防止
- 5 ページ遷移しても再チェック不要
- セッション終了（ブラウザ閉じる、ログアウト）で reset

> **注意**: リストを再作成した場合、キャッシュ有効期間内（セッション）では古い状態が参照され続けます。テストで事象確認時は、**ブラウザタブ全体を閉じるか、Dev Tools で sessionStorage 削除** してください。

---

## CI/CD 統合

### GitHub Actions 例

```yaml
# .github/workflows/test.yml
- name: E2E (Fast Regression)
  run: npx playwright test --project=chromium
  timeout-minutes: 10

# nightly job（別）
- name: E2E Integration (Nightly)
  if: github.event_name == 'schedule' || github.ref == 'refs/heads/main'
  run: npx playwright test --project=chromium-sp-integration
  timeout-minutes: 15
```

---

## 本番環境での検証チェックリスト

デプロイ前に以下を確認：

- [ ] chromium テスト通過（正常系）
- [ ] chromium-sp-integration テスト通過（404 含む）
- [ ] ProtectedRoute で listReady gate が有効か（コード検査）
- [ ] useSchedules.ts で list check が実行されるか（DevTools Network タブ）
- [ ] sessionStorage に `__listReady` キー存在確認

---

## トラブルシューティング

### テスト失敗: "element(s) not found" (エラーメッセージ)

**原因**: VITE_SKIP_SHAREPOINT=1 で list check が実行されていない

**対策**:
1. `-project=chromium-sp-integration` で実行確認（SKIP_SHAREPOINT=0）
2. それでも fail の場合、route.respond() パターン見直し

### セッションキャッシュの影響で期待値と異なる

**対策**:
- テスト実行前に `sessionStorage.clear()` を追加
- または private/incognito mode で実行

---

## 参考リンク

- [Production Safety Notes](../README.md#-production-safety-notes)
- [useSchedules.ts](../src/features/schedules/useSchedules.ts) - List check 実装
- [ProtectedRoute.tsx](../src/app/ProtectedRoute.tsx) - Gate 実装
- [playwright.config.ts](../playwright.config.ts) - Project 設定
