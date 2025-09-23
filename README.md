# 運営指導・記録管理システム MVP (React + SharePoint SPA)

> 📌 クイックリンク: [プロビジョニング手順 / WhatIf レビュー](docs/provisioning.md#whatif-ドライラン-と-job-summary) ｜ [SharePoint スキーマ定義](provision/schema.json)

<!-- Badges -->
![CI Tests](https://github.com/ORG/REPO/actions/workflows/test.yml/badge.svg)
![Provision WhatIf](https://github.com/ORG/REPO/actions/workflows/provision-sharepoint.yml/badge.svg)
![Lint](https://img.shields.io/badge/lint-pass-brightgreen)
![TypeCheck](https://img.shields.io/badge/types-pass-informational)
![Coverage Lines](https://img.shields.io/badge/coverage-70%25%2B-green)

本プロジェクトは、React, TypeScript, Vite, MUIを使用し、SharePoint OnlineをバックエンドとするSPAアプリケーションのMVP実装です。

## Tech Stack
- React 18 + TypeScript + Vite
- MSAL (@azure/msal-browser, @azure/msal-react)
- SharePoint Online REST API
- LocalStorage (temporary audit log persistence)

## Key Features
- Azure AD (Entra ID) login and token acquisition
- SharePoint list access via a custom hook (`useSP`)
- Record listing & creation against a SharePoint list
- Local audit trail with CSV export
- Environment validation & helpful error messages for misconfiguration
- Schema-driven provisioning supports Text/Choice/DateTime/Number/Note/User/Lookup (additive choice policy, safe type migration)

## Project Structure (excerpt)
```
src/
  auth/              MSAL config & hook
  lib/               Core helpers (SharePoint client, audit log)
  features/
    records/         Record list UI & migration from legacy API
    compliance-checklist/
    audit/           Audit panel with CSV export
  app/               Shell, routing, theming
  ui/components/     Reusable UI pieces
```

## Environment Variables (.env)
Create a `.env` file in the project root (never commit secrets):
```
VITE_MSAL_CLIENT_ID=<YOUR_APP_CLIENT_ID>
VITE_MSAL_TENANT_ID=<YOUR_TENANT_ID>
VITE_SP_RESOURCE=https://<yourtenant>.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<SiteName>
```
Notes:
- Do NOT include trailing slash on `VITE_SP_RESOURCE`. The code normalizes it.
- `VITE_SP_SITE_RELATIVE` must start with `/` (code auto-fixes if missing) and not end with `/`.
- Placeholders like `<yourtenant>` or `<SiteName>` will trigger a validation error until replaced.

## Authentication Flow
1. MSAL instance configured in `src/auth/msalConfig.ts`
2. App wrapped with `MsalProvider` in `src/auth/MsalProvider.tsx`
3. `useAuth()` hook exposes `acquireToken()` which obtains an access token for SharePoint using the scope: `${VITE_SP_RESOURCE}/.default`.
4. Token stored transiently (sessionStorage) to bridge legacy calls during migration.

## SharePoint Access: `useSP`
Located in `src/lib/spClient.ts`.

### Responsibilities
- Validate environment & normalize base SharePoint URL
- Provide `spFetch` (authenticated REST calls with retry on 401) 
- Provide convenience helpers:
  - `getListItemsByTitle(title, odataQuery?)`
  - `addListItemByTitle(title, payload)`

### Usage Example
```tsx
import { useSP } from '../lib/spClient';

function Example() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  useEffect(() => {
    getListItemsByTitle('Records').then(items => console.log(items));
  }, []);

  const add = () => addListItemByTitle('Records', { Title: 'New Item' });

  return <button onClick={add}>Add</button>;
}
```

### Error Handling
- Misconfigured env throws early, describing what to fix.
- 401 responses trigger a silent re-acquire of token (once) before failing.
- Errors bubble with contextual JSON snippet (truncated) for easier debugging.

### 運用メモ（Choice フィールドの変更ポリシー）

- `choicesPolicy` は 既定 `additive`：不足選択肢のみ追加し、既存は削除しません。
  - Summary 出力例: `+ Add choices ...`, `! Keep existing (not removing) ...`
- `replace` は将来拡張用で、現バージョンでは警告ログを出し `additive` と同じ動作です。
- 選択肢削除が必要な場合は、ユーザー影響とデータ整合性を精査し、移行計画（新列 *_v2 作成など）を検討してください。

## Migration Notes
Legacy helper `spRequest` and old `records/api.ts` have been removed / deprecated.
Use `useSP()` directly in components or create thin feature-specific wrappers if needed.

## Development
Install dependencies and start dev server (port 3000):
```
npm install
npm run dev

### Test & Coverage

現在の固定品質ゲート (Phase 3 固定化):
```
Lines >= 70%, Statements >= 70%, Functions >= 70%, Branches >= 65%
```
`vitest.config.ts` の `thresholds` を将来引き上げる際は、CI 3 連続グリーン後に 5–10pt 程度ずつ。急激な引き上げは避けてください。

### Coverage Roadmap (Historical / Plan)
現在: Phase 3 (安定運用ベースライン達成)

| Phase | 目標 (Lines/Fn/Stmts \| Branches) | 達成基準 | 主なアクション | 想定タイミング |
|-------|------------------------------------|-----------|----------------|----------------|
| 0 | 20/20/20 \| 10 (導入) | スモーク + 主要ユーティリティ | 初期テスト整備 | 達成済 ✅ |
| 1 | 40/40/40 \| 20 (現状) | 回帰テスト安定 (直近失敗なし) | バッチパーサ / リトライ / UUID フォールバック | 達成済 ✅ |
| 2 | 60/60/60 \| 40 | クリティカルパス (認証, spClient, 監査同期) Happy/エラー系網羅 | useSP リトライ分岐 / 409 重複成功扱い / 部分失敗再送 | 次期 |
| 3 | 70/70/70 \| 65 (固定現状) | UI ロジック分離・Hooks 単体化 | `useAuditSyncBatch` 分岐別テスト | 達成済 ✅ |
| 4 | 80/80/80 \| 65 | 主要分岐ほぼ網羅 (表示のみ除外) | jsdom コンポーネントテスト導入 (ピンポイント) | 中期 |
| 5 | 85+/85+/85+ \| 70+ | コスト/リターン再評価 | Snapshot 最適化 / Flaky 監視 | 後期 |

運用ポリシー (固定化後):
- 閾値は Phase 3 値を維持。新規機能は同等以上のカバレッジを伴って追加。
- Flaky 発生時は引き上げ計画を一旦停止し要因除去 (jitter/タイマー/ランダム化の deterministic 化)。

ローカル詳細メトリクス確認:
```
npm run test:coverage -- --reporter=text
```
CI では text / lcov / json-summary を生成。将来的にバッジ or PR コメント自動化を計画。

```

### Quality Gates (Local)
以下をローカルで実行することで、CI と同じ早期フィードバックを得られます:
```
npm run typecheck   # 型不整合の検出
npm run lint        # コードスタイル/潜在バグ検出 (ESLint + @typescript-eslint)
npm run test        # ユニットテスト (最小)
npm run test:coverage  # カバレッジ付き
```
推奨フロー: 変更後すぐ `typecheck` / `lint`、安定したら `test:coverage`。PR 前にすべて PASS を確認してください。

### Mini Runbook (運用即参照)
| 項目 | チェック | メモ |
|------|---------|------|
| Entra App 権限 | Sites.Selected or Sites.ReadWrite.All 同意済 | `API permissions` 画面で Admin consent granted 状態 |
| Redirect URI | `http://localhost:3000` / 本番 URL | SPA (Single-page application) で追加 |
| .env 置換 | `<yourtenant>` / `<SiteName>` が実値化 | `ensureConfig` が placeholder を検出すると起動失敗 |
| SharePoint Lists | `provision-sharepoint.yml` WhatIf → Apply | WhatIf 差分を必ず PR でレビュー |
| インデックス | `Audit_Events(entry_hash)` / `Audit_Events(ts)` | 大量化前に作成 (5k item threshold 回避) |
| Backfill entry_hash | 既存行に空がない | PowerShell スクリプト或いは アクション backfill=true |
| Token エラー | 401/403 時 MSAL Silent Refresh 成功 | 発生頻度 > 数/日なら権限再確認 |
| Batch Fallback | parserFallbackCount が 0 | >0 継続ならレスポンス破損調査 |

### 迅速トリアージ手順
1. 500 / 503 増加 → サーバ側ヘルス (SPO 側障害) を MS サービス正常性で確認
2. 429 増加 → バッチサイズ・ユーザー同時操作確認、必要なら `VITE_SP_RETRY_BASE_MS` 引き上げ
3. 409 増加傾向 → 重複 (期待挙動) なので異常ではないが、新規率低下をモニタリング
4. parserFallbackCount > 0 → ネットワーク系 (途中切断) や O365 側一時的フォーマット崩れを疑う

### E2E Tests (Playwright)
初期スモークとして Playwright を導入しています。
```
npm run test:e2e
```
`tests/e2e/audit-basic.spec.ts` がアプリシェルと監査ログ表示の最低限を確認します。拡張する場合は同ディレクトリに追加してください。

### 監査ログフィルタ (Action)
`監査ログ` パネル上部に Action ドロップダウンを追加。`ALL` / 個別アクションでテーブルが絞り込み表示されます。

### デバッグログ制御
`.env` に `VITE_AUDIT_DEBUG=1` を設定すると、バッチ同期内部の以下情報が出力されます。
- リトライ試行 (`[audit:retry]`)
- チャンク解析結果 (`[audit:chunk]`)
- フェータルエラー (`[audit:fatal]`)
OFF 時は `debug` レベルのみ抑制し、warn/error は常に出力されます。

### 部分失敗 / 再送フロー
1回の同期（バッチ）で insert した結果を Content-ID 単位で判定し、失敗したアイテムだけローカルバッファに残します。

UI 指標例:
```
New: 10  Duplicate: 3  Failed: 2  Duration: 420ms
Categories: { throttle:1, server:1 }
```

- New: 新規 201
- Duplicate: 409 （entry_hash の一意制約衝突だが成功扱い）
- Failed: リトライ後も成功しなかったアイテム数
- Duration: バッチ要求～解析完了までの経過時間
- Categories: 失敗を HTTP ステータスグループで集計（server/auth/throttle/bad_request/not_found/other）

再送ボタン（例: 「失敗のみ再送」）を押すと Failed > 0 のものだけ再バッチ化します。全件成功した場合はローカル保持をクリアします。

### E2E 部分失敗シナリオ
`tests/e2e/audit-partial-failure.spec.ts` で $batch をモックし、部分成功 + duplicate + 再送成功パターンを検証しています。

### トークン Soft Refresh
MSAL のキャッシュされたアクセストークン有効期限が閾値（`VITE_MSAL_TOKEN_REFRESH_MIN` 秒、既定 300）未満になると `forceRefresh: true` で再取得します。

メトリクス (debug 有効時 `window.__TOKEN_METRICS__`):
```
{
  acquireCount: <acquireTokenSilent 総呼出回数>,
  refreshCount: <soft refresh 実行回数>,
  lastRefreshEpoch: <最後の refresh UNIX 秒>
}
```
`VITE_AUDIT_DEBUG=1` のとき `spClient` 側で snapshot を `[spClient] token metrics snapshot` として出力します。

### entry_hash Backfill (既存データ補完)
目的: 過去に挿入済みの `Audit_Events` アイテムで `entry_hash` が空のものへ後付与し、以降の重複判定を完全化。

手順 (GitHub Actions 連携後):
1. ワークフロー `Provision SharePoint Lists` を手動実行時に `backfillEntryHash=true` を指定
2. `whatIf=true` でドライラン可（更新件数は 0 / Needed 件数のみ表示）
3. 成功後、今後の同期で 409 重複が“成功扱い”に収束し取りこぼしゼロへ

ローカル / 手動実行例 (接続後):
```
pwsh -File ./scripts/backfill-entry-hash.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Audit -WhatIfMode
pwsh -File ./scripts/backfill-entry-hash.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Audit
```
オプション:
- `-BatchSize`: まとめて更新する件数 (既定 50)
- `-WhatIfMode`: 書き込み抑止

内部ロジック:
- フロントエンドと同じ canonical JSON (Title, Action, User, Timestamp, Details) を SHA-256
- 空または未設定の行のみ対象

### スロットリング / 再試行 (429/503/504)
SharePoint から 429 (Throttle) / 503 / 504 が返った場合は指数バックオフ + full jitter で自動再試行します。`Retry-After` ヘッダが存在する場合はそれを最優先で待機します。

環境変数 (既定値):
```
VITE_SP_RETRY_MAX=4              # 最大試行回数 (初回+再試行含む)
VITE_SP_RETRY_BASE_MS=400        # バックオフ基準 ms (指数 2^(attempt-1))
VITE_SP_RETRY_MAX_DELAY_MS=5000  # 1 回あたり待機時間上限
```
アルゴリズム:
1. 応答が 429/503/504 → attempt < max なら待機
2. 待機時間: Retry-After (秒 or 日付) 優先 / 無ければ `rand(0..min(cap, base*2^(attempt-1)))`
3. 401/403 は別経路 (トークン再取得) を先に実施
4. すべて失敗で最終レスポンス内容を含むエラー throw

デバッグ例 (`VITE_AUDIT_DEBUG=1`):
```
[spClient] retrying { status: 429, attempt: 2, waitMs: 317 }
```

## CSV Export (Audit Panel)
Found in `src/features/audit/AuditPanel.tsx` – quoting & escaping ensures RFC4180-compatible output for Excel.

## Audit Log $batch 同期 & Idempotency (部分成功集計 / 重複防止対応)

大量（数百件以上）の監査ログを逐次 REST POST すると往復回数が増え遅延します。`src/features/audit/useAuditSyncBatch.ts` は SharePoint REST の `$batch` を用いて **最大100件/チャンク（既定）** で一括挿入する実験的フックです。

環境変数 `VITE_AUDIT_BATCH_SIZE` を設定すると 1〜500 の範囲でチャンクサイズを調整できます（範囲外はクランプ・不正値は既定 100）。

### 使い方
- 監査ログパネルに「SPOへ一括同期($batch)」ボタンが追加されています。
- 同期後は `一括同期完了: 成功件数/総件数` を表示します。部分失敗がある場合、失敗件数は UI メッセージ（将来拡張）かコンソールのデバッグログで確認できます。

### 制限 / 今後の改善予定
| 項目 | 現状 | 改善案 |
|------|------|--------|
| 部分失敗解析 | 対応（Content-ID 単位で success/failed 集計） | エラー詳細の UI 表示 / リトライ対象抽出 |
| リトライ | なし | 429/503/一時エラーで指数バックオフ |
| チャンクサイズ調整 | 固定 100 | `.env` (`VITE_AUDIT_BATCH_SIZE`) で可変化 |
| ローカルログ削除 | 全件成功時に自動クリア済み | 失敗分のみ保持 / リトライキュー分離 |

### 実装概要
1. ローカル監査ログを DTO に変換
2. 100件単位に分割
3. `multipart/mixed` ($batch + changeset) 形式の本文を生成（各リクエストに `Content-ID` 付与）
4. `POST https://{tenant}.sharepoint.com/sites/.../_api/$batch`
5. レスポンス multipart を解析し、`Content-ID` ごとの HTTP ステータスから成功/失敗件数算出（全件成功時はローカル監査ログを自動クリア）

現在は最小限パーサ（HTTP/1.1 行 + Content-ID 抽出）で成功/失敗をカウント。レスポンス JSON の個別本文まではまだマッピングしていません（必要になれば拡張可能）。

> 注意: `$batch` は 1 リクエストあたりの総ペイロードサイズ上限（~数 MB）や changeset 内の操作件数制限に留意してください。現状 100件は保守的な値です。

### Idempotency (重複防止) 実装済み: `entry_hash`

監査イベントの再送 / リトライ / 二重操作などによる重複挿入を防ぐため、`Audit_Events` リストに **一意制約付き Text 列 `entry_hash`** を追加し、同期時に計算しています。

実装ポイント:
1. ハッシュ入力要素 (冪等性サーフェス): `ts, actor, action, entity, entity_id, after_json` を canonical JSON 化
2. `src/lib/hashUtil.ts` で: key ソート + cycle safe + SHA-256 → 64 hex をそのまま利用（列長 128 を確保）
3. 逐次同期 (`useAuditSync`) とバッチ同期 (`useAuditSyncBatch`) の両方で DTO に `entry_hash` 付与
4. SharePoint で一意制約違反（重複）を検出した場合は **成功扱い**（既に登録済み）としてカウントするロジックを実装（逐次同期で例外文言を判定 / バッチは現状 HTTP ステータス単位集計。将来的に 409 パターンを個別 success 扱いへ拡張予定）
5. 全件 (真の成功 + 重複成功) の合計が送信総数と一致した場合にローカル監査ログをクリア

メリット:
- 再送やネットワーク再試行時に二重行生成を抑止
- ローカルログのクリア条件が「DB に非重複で存在している」で安定

留意点:
- ハッシュ衝突は極低確率 (SHA-256) のため実用上問題なしと判断
- `before_json` は冪等性キーに含めていない（差分表示用であり、後続更新による変動要素になる可能性があるため）。要件で必要なら basis に追加してください。
- 今後、バッチレスポンスの個別本文解析を拡張し、重複を success に再分類する改善余地あり。

移行（既存データへ後付け）が必要になった場合は、PowerShell / CSOM スクリプトで空の `entry_hash` を順次計算埋め込みすることも可能です（まだスクリプトは同梱していません）。

### バッチ同期のリトライ & 重複/部分失敗ハンドリング

スモールスケール（利用者 ~30 名 / 職員 ~15 名）を想定し、シンプルかつ安全な実装ポリシー:

| 項目 | 実装 | 備考 |
|------|------|------|
| トランジェントリトライ | 429 / 503 / 504 / ネットワーク例外を指数バックオフ (最大3回) | バックオフ: 200ms * 2^n + jitter |
| リトライ設定可変 | `VITE_AUDIT_RETRY_MAX`, `VITE_AUDIT_RETRY_BASE` | 最大回数(<=5), 基本ms (既定 3 / 200ms) |
| 失敗のみ再送 | UI ボタン "失敗のみ再送" | 部分失敗後に残存した失敗行だけ再送 |
| エラー分類表示 | auth / throttle / server / bad_request / not_found / other | バッチ結果下に簡易内訳表示 |
| 所要時間計測 | durationMs | 処理 ms をメトリクス & メッセージに表示 |
| 重複 (409) | 成功扱い (duplicates カウント) | Idempotent なので再送不要 |
| 部分失敗保持 | 成功済みを除去し失敗分のみローカル再保持 | Content-ID から元インデックスを逆引きし正確に失敗行のみ保持 |
| ログクリア | 全件 (成功+重複) カバー時のみ完全クリア | データ消失リスク回避 |
| UI 表示 | `成功/総数 (重複 X 失敗 Y)` 形式 | 重複増加を可視化 |

将来拡張余地:
- 失敗の中からトランジェント以外 (400系) を明示ラベル化
- Content-ID とローカルインデックスの追跡で “本当に失敗した行” のみ精密保持
- リトライ回数/バックオフポリシーを `.env` で可変化
- 解析カテゴリ (auth / throttle / server) 別の件数を UI 表示

### 開発用メトリクス
`window.__AUDIT_BATCH_METRICS__` (DEV) に以下をエクスポート:
```jsonc
{
  "total": 42,
  "success": 40,
  "duplicates": 5,
  "newItems": 35,
  "failed": 2,
  "retryMax": 3,
  "timestamp": "2025-09-23T09:00:00.000Z",
  "categories": { "bad_request": 1, "server": 1 }
}
```

### 失敗のみ再送の動作
1. 部分失敗時、Content-ID から元インデックスを特定し失敗行のみローカル保持。
2. 「失敗のみ再送」ボタンで残存分を再バッチ送信。
3. 全件成功（重複含む）でローカル監査ログをクリア。



## 受け入れ基準確認

  - [x] `npm run dev` 起動 → サインインできる。
  - [x] 「日次記録」で SharePoint から一覧取得できる。
  - [x] Title を入力して「追加」→ 正常終了後、一覧に追加される（read-backによる整合性確保）。
  - [x] ヘッダーの履歴アイコンから監査ログを開き、「CREATE_SUCCESS」ログが記録されていることを確認できる。
  - [x] 主要ボタンが 44px 以上あり、Tab 移動でフォーカス可視。
  - [x] プロジェクトが指定ディレクトリ構成で生成されている。

---

## SharePoint リストの自動プロビジョニング

本プロジェクトは **GitHub Actions + PnP.PowerShell** を用いて、SharePoint リストを **スキーマ外出し（JSON）**でプロビジョニングできます。  
**WhatIf（ドライラン）**に対応し、**Job Summary** に差分と現況スナップショットを出力します。

### 仕組みの概要

- ワークフロー: `.github/workflows/provision-sharepoint.yml`
- スクリプト: `scripts/provision-spo.ps1`
- スキーマ: `provision/schema.json`（リスト定義の外出し）

> 認証は **アプリケーション権限**（Entra ID アプリ＋証明書 or クライアントシークレット）を想定。  
> SharePoint の **Sites.FullControl.All** 等、必要権限に管理者同意が必要です。

---

### GitHub Secrets（必須）

| Secret 名             | 説明例                                           |
|-----------------------|--------------------------------------------------|
| `AAD_TENANT_ID`       | `650ea331-3451-4bd8-8b5d-b88cc49e6144`          |
| `AAD_APP_ID`          | `0d704aa1-d263-4e76-afac-f96d92dce620`          |
| `SPO_RESOURCE`        | `https://<tenant>.sharepoint.com`               |
| `SPO_CERT_BASE64`     | （証明書認証を使う場合）PFX の Base64 文字列     |
| `SPO_CERT_PASSWORD`   | （証明書認証を使う場合）PFX パスワード           |
| `SPO_CLIENT_SECRET`   | （クライアントシークレット認証を使う場合のみ）   |

> 証明書とクライアントシークレットは **どちらか一方**を設定。

---

### ワークフロー入力

Actions →「Provision SharePoint Lists」→ **Run workflow** で以下を指定します。

| 入力名             | 既定値                 | 説明                                                                                      |
|--------------------|------------------------|-------------------------------------------------------------------------------------------|
| `siteRelativeUrl`  | `/sites/welfare`       | 対象サイトの相対パス                                                                       |
| `schemaPath`       | `provision/schema.json`| スキーマ JSON のパス                                                                       |
| `whatIf`           | `true`                 | **ドライラン**（計画のみ、変更は加えない）                                                 |
| `applyFieldUpdates`| `true`                 | 型が一致している既存列に対して **表示名/説明/選択肢/必須/一意/最大長** を安全に更新        |
| `forceTypeReplace` | `false`                | 型不一致時に `*_v2` 列を新規作成し、**値をコピーして移行**（旧列は残す）                   |
| `recreateExisting` | `false`                | 既存リストを **削除→再作成**（破壊的。データ消失に注意）                                   |

---

### スキーマ（`provision/schema.json`）の書式

```json
{
  "lists": [
    {
      "title": "SupportRecord_Daily",
      "fields": [
        { "displayName": "記録日",   "internalName": "cr013_recorddate",  "type": "DateTime", "addToDefaultView": true },
        { "displayName": "特記事項", "internalName": "cr013_specialnote", "type": "Note",     "addToDefaultView": true,
          "description": "自由記述", "required": false }
      ]
    },
    {
      "title": "Audit_Events",
      "fields": [
        { "displayName": "ts",          "internalName": "ts",          "type": "DateTime", "addToDefaultView": true, "description": "ISO日時" },
        { "displayName": "actor",       "internalName": "actor",       "type": "Text",     "addToDefaultView": true, "maxLength": 255 },
        { "displayName": "action",      "internalName": "action",      "type": "Text",     "addToDefaultView": true },
        { "displayName": "entity",      "internalName": "entity",      "type": "Text",     "addToDefaultView": true, "enforceUnique": false },
        { "displayName": "entity_id",   "internalName": "entity_id",   "type": "Text" },
        { "displayName": "channel",     "internalName": "channel",     "type": "Text" },
        { "displayName": "before_json", "internalName": "before_json", "type": "Note" },
        { "displayName": "after_json",  "internalName": "after_json",  "type": "Note" }
      ]
    }
  ]
}
```

#### フィールドキー（対応済み）

| キー | 型 | 説明 |
|------|----|------|
| displayName | string | 表示名 |
| internalName | string | 内部名（作成後は変更しない想定） |
| type | string | Text/Note/DateTime/Number/URL など |
| addToDefaultView | boolean | 既定ビューに追加 |
| description | string | 列の説明 |
| required | boolean | 必須 |
| enforceUnique | boolean | 一意制約（Text/Number/URL 等で有効） |
| maxLength | number | 最大文字数（Text） |
| choices | string[] | 選択肢（type: "Choice" の時） |

型変更は直接は不可（SPO制約）。`forceTypeReplace=true` で *_v2 列を作成し、値をコピーして移行します（旧列は残す）。

---

### WhatIf（ドライラン）と Job Summary

* `whatIf: true` で 計画のみを出力（変更なし）
* Summary 例（抜粋）:

```
List exists: SupportRecord_Daily
  - Add field: cr013_recorddate (DateTime)
  - Add field: cr013_specialnote (Note)
List exists: Audit_Events
  - Type mismatch: entity existing=Note desired=Text
    - Skipped type change (forceTypeReplace=false)
Existing fields snapshot: Audit_Events
  - Title (Type=Text, Req=False, Unique=False, Title='Title')
```

本実行（`whatIf: false`）では Created / Updated / Migration done などが出力されます。

---

### FAQ

| 質問 | 回答 |
|------|------|
| 既存リストを壊したくない | 既定 `recreateExisting=false`, `forceTypeReplace=false`, `applyFieldUpdates=true` を維持 |
| 型が違っていた | まず `whatIf: true` で確認 → 問題なければ `forceTypeReplace: true` で *_v2 移行 |
| 一意制約を付けたい | 重複データがあると失敗。事前に重複を排除 |
| 大量アイテム移行が遅い | 今後バッチ最適化予定。現状は逐次更新 |

---

### 依存・前提

| 項目 | 内容 |
|------|------|
| ランナー | ubuntu-latest |
| モジュール | PnP.PowerShell |
| 権限 | Entra アプリ (Sites.FullControl.All など) + 管理者同意 |

---

より詳細なガイドは `docs/provisioning.md` を参照してください。

## Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| URL parse / 400 errors | Placeholder env values | Update `.env` with real tenant/site values |
| 401 from SharePoint | Token expired / missing scope | Ensure `acquireToken` runs, user signed in, correct API permissions granted |
| Module not found '@/*' | Path alias not applied | Check `tsconfig.json` and `vite.config.ts` alignment |
| Type errors for 'path' or 'url' | Missing node types | Ensure `"types": ["vite/client", "node"]` in `tsconfig.json` |

## Azure AD / Entra App Requirements
API permissions should include delegated permissions to SharePoint (e.g. `Sites.Read.All` and `Sites.ReadWrite.All` if writing). Admin consent must be granted. The `${resource}/.default` scope relies on these pre-consented permissions.

## License
Internal / TBD.
# CI smoke
# CI smoke
