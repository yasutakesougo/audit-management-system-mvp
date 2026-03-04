# Monitoring Hub v1 — 運用 Runbook

> **目的:** 日次（朝/夕）で3分以内に回せるチェックリストと、一次対応手順の策定
>
> **対象:** `SchedulesSpLane` (Monitoring Hub) コンポーネントとその関連システム

## 1. 観測ポイント一覧

Monitoring Hub の `SchedulesSpLane` コンポーネントは以下の data 属性で状態を可視化しています：

| 属性 | 説明 | 正常値 |
|------|------|--------|
| `data-state` | レーンの状態 | `active` |
| `data-source` | データソース | `sp` or `polling` |
| `data-version` | 同期バージョン番号 | 単調増加する正の整数 |
| `data-error-kind` | エラーの種類 | `undefined`（エラーなし） |
| `data-busy` | 同期処理中か | `undefined`（アイドル時） |
| `data-can-retry` | リトライ可能か | `1` |
| `data-cooldown-until` | 再試行禁止期限 | `undefined`（制限なし） |
| `data-failure-count` | 連続失敗回数 | `0` or `undefined` |
| `data-retry-after` | 次回リトライまでの秒数 | `undefined` |

### ブラウザ DevTools での確認方法

```javascript
// コンソールで即座に確認
const lane = document.querySelector('[data-testid="schedules-sp-lane"]');
if (lane) {
  console.table({
    state: lane.dataset.state,
    source: lane.dataset.source,
    version: lane.dataset.version,
    errorKind: lane.dataset.errorKind,
    busy: lane.dataset.busy,
    canRetry: lane.dataset.canRetry,
    failureCount: lane.dataset.failureCount,
    retryAfter: lane.dataset.retryAfter,
  });
}
```

## 2. 日次チェックリスト（3分以内）

### 朝チェック（始業時）

| # | 確認項目 | 方法 | 正常 | 異常 |
|---|---------|------|------|------|
| 1 | Hub の `data-state` | DevTools or UI | `active` | `error` / `disabled` / `idle` |
| 2 | `data-source` | DevTools | `sp` or `polling` | 空 or 不明 |
| 3 | `data-version` | DevTools | 前回より増加 | 同じ or 減少 |
| 4 | `data-error-kind` | DevTools | 未定義 | `auth` / `network` / `conflict` |
| 5 | SP接続ステータスバー | UI右上のHUD | 「SP Connected」 | 「SP Error」/ 「Sign-In」 |

### 夕チェック（終業前）

| # | 確認項目 | 方法 | 正常 | 異常 |
|---|---------|------|------|------|
| 1 | `data-failure-count` | DevTools | `0` or 未定義 | 連続3回以上 |
| 2 | `data-retry-after` | DevTools | 未定義 | 数値が増大傾向 |
| 3 | 全日分のイベント件数 | UI「SP連携スケジュール」 | 期待される件数 | 0件 or 大幅減 |
| 4 | ブラウザコンソール | DevTools Console | エラーなし | 赤いエラーログ |

## 3. 異常の定義

### 3.1 Critical（即対応）

| 状態 | 条件 | 影響 |
|------|------|------|
| **error 連続** | `data-state="error"` が5分以上継続 | スケジュールが表示されない |
| **auth エラー** | `data-error-kind="auth"` | トークン期限切れ → 再サインイン必要 |
| **version 停止** | `data-version` が1時間以上変化なし | 同期が完全に停止 |

### 3.2 Warning（経過観察）

| 状態 | 条件 | 影響 |
|------|------|------|
| **retry-after 増大** | `data-retry-after` が60秒以上 | SP側のスロットリング |
| **failure-count 増加** | `data-failure-count` が3-5回 | ネットワーク不安定 |
| **version mismatch** | `data-version` が減少 | キャッシュ不整合の可能性 |

### 3.3 Informational（記録のみ）

| 状態 | 条件 | 影響 |
|------|------|------|
| **disabled** | `data-state="disabled"` | 環境フラグでSP連携オフ |
| **idle** | `data-state="idle"` | 初期接続待ち（通常30秒以内に解消） |

## 4. 一次対応手順

### 4.1 state="error" の場合

```
1. data-error-kind を確認
   ├── "auth"      → Step 4.2 (認証エラー) へ
   ├── "network"   → Step 4.3 (ネットワークエラー) へ
   ├── "conflict"  → Step 4.4 (競合エラー) へ
   └── その他      → Step 4.5 (汎用対応) へ
```

### 4.2 認証エラー (data-error-kind="auth")

1. **即座:** UI右上の「サインイン」ボタンからMSAL再認証
2. **確認:** `data-state` が `active` に戻ることを確認
3. **継続:** 再認証後10分経過しても `auth` エラーが再発する場合:
   - Azure AD のトークンキャッシュをクリア: `localStorage` から `msal.*` キーを削除
   - ブラウザの Cookie をクリアして再ログイン

### 4.3 ネットワークエラー (data-error-kind="network")

1. **即座:** Hub のリトライボタン（🔄）をクリック
2. **確認:** `data-state` が `active` に戻ることを確認
3. **継続:** 3回リトライしても解消しない場合:
   - SharePoint Online のサービス状態を確認: [Microsoft 365 Service Health](https://admin.microsoft.com/Adminportal/Home#/servicehealth)
   - VPN / ネットワーク接続を確認

### 4.4 競合エラー (data-error-kind="conflict")

1. **即座:** ページをリロード（F5）
2. **確認:** 最新データが表示されることを確認
3. **原因:** 他のユーザーが同時にリストを編集した場合に発生

### 4.5 汎用対応

1. **即座:** Hub のリトライボタンをクリック
2. **5分待機:** 自動リトライが成功するか観察
3. **解消しない場合:**
   - ブラウザコンソールでエラー詳細を確認
   - `details.error` の内容をスクリーンショットで記録
   - 環境フラグの確認:

```bash
# .env.local で一時的にSP連携を無効化（フォールバック）
VITE_SKIP_SHAREPOINT=true
```

## 5. 環境フラグ一覧

| フラグ | 説明 | デフォルト |
|--------|------|-----------|
| `VITE_SKIP_SHAREPOINT` | SP連携を完全スキップ | `false` |
| `VITE_FORCE_SHAREPOINT` | SP連携を強制有効化 | `false` |
| `VITE_FEATURE_SCHEDULES_SP` | スケジュールSP連携 | `false` |
| `VITE_FEATURE_SP_HUD` | SP HUD 表示 | `true` |

## 6. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/features/schedules/components/SchedulesSpLane.tsx` | Monitoring Hub UI |
| `src/features/schedules/components/__tests__/SchedulesSpLane.spec.tsx` | Hub のテスト |
| `src/features/dashboard/types/hub.ts` | SpLaneModel 型定義 |
| `src/features/dashboard/useDashboardSummary.ts` | Hub モデル生成 |
| `src/features/schedules/infra/SharePointScheduleRepository.ts` | SP 通信層 |
| `src/features/schedules/errors.ts` | エラー分類ロジック |

## 7. エスカレーション

上記で解消しない場合は、以下の情報を添えて開発チームに報告:

1. `data-*` 属性のスクリーンショット
2. ブラウザコンソールのエラーログ
3. 発生時刻と操作内容
4. ネットワーク環境（社内 / VPN / リモート）
