# 🚀 運用開始パトロールランブック (PRODUCTION-GO-LIVE)

## 🚀 本番投入直前 5分チェックリスト（運用者用）

### 🎯 目的

本チェックは「動くか」ではなく  
**「壊れたときに正しく止まり、正しく検知できるか」** を確認するためのものです。

---

### ✅ 必須チェック

#### 🔐 接続・認証

- [ ] `SHAREPOINT_SITE` が設定済み
- [ ] `SHAREPOINT_TOKEN` が設定済み  
      ※ 未設定で `integration-diagnose` が fail するのは正常挙動
- [ ] `NIGHTLY_OWNER_WEBHOOKS_JSON` が設定済み（Reason Code の owner 通知ルーティング）
      ※ 未設定時は `NOTIFY_WEBHOOK_URL` へフォールバック通知される

#### 🧪 実接続診断（最重要）

- [ ] `integration-diagnose` ジョブが有効  
      → 実行ログで SharePoint read が成功している

#### 🛑 強制停止（Guardrail）

- [ ] `NIGHTLY_FAIL_ON_ACTION_REQUIRED: "true"` が設定済み  
      → `Action Required` で CI が fail する
- [ ] `NIGHTLY_REQUIRE_SP: "1"` が設定済み  
      → SharePoint 未接続時は hard fail

#### ⚠️ 危険操作の遮断

- [ ] 本番環境で `throwOnHighRisk` が有効  
      → 高リスククエリがブロックされる

#### 🧬 スキーマ整合性（SSOT）

- [ ] `spListRegistry` が definitions を参照している
- [ ] SSOT 保証テストが通過している

#### 🛡️ CI ガード

- [ ] Required checks に以下が含まれる
- [ ] `integration-diagnose`
- [ ] `typecheck`
- [ ] `queryGuard` 系テスト

#### 📘 Runbook整備

- [ ] `Action Required` は fail で停止する
- [ ] SharePoint 未接続は hard fail
- [ ] 実接続診断は read-only
- [ ] 本番では高リスククエリは遮断される

---

### 🚨 最終確認（追加：最重要）

- [ ] **直近1回、実際に Nightly を手動実行して成功ログを確認した**

👉 理由:  
設定が正しくても「実行していない」は事故原因になります。

---

### 🟢 判定基準

#### GO（本番投入可能）

- [ ] すべてチェック済み
- [ ] Nightly 手動実行が成功

#### 🔴 NO-GO（投入不可）

- [ ] 1つでも未チェック
- [ ] Nightly 未実行

---

### 🧭 補足

このシステムは「壊れないこと」を保証しません。  
**壊れたときに正しく止まり、正しく見えることを保証します。**

---

## 🚨 障害時1分対応フローチャート

### 0. 最初の判定

- [ ] `GO/NO-GO` は即時に `NO-GO` へ切り替える
- [ ] 影響範囲を「投入前 / 投入後」で切り分ける

### 0.5 最初に必ず確認する場所（固定）

- [ ] GitHub Actions の最新 run（`nightly-health` / `nightly-patrol`）を開く
- [ ] 失敗している job 名と step 名を最初に確定する

### Reason Code クイックリンク（固定）

<a id="rc-admin-status"></a>
- `ADMIN_STATUS_*` → `/admin/status` と `integration-diagnose` の失敗内容を確認する

<a id="rc-patrol"></a>
- `PATROL_*` → `docs/nightly-patrol/decision-YYYY-MM-DD.md` の Fail/Watch Trigger を確認する

<a id="rc-ci-gate"></a>
- `CI_GATE_FAILURE` → CI gate（unit/typecheck）を復旧し再実行する

<a id="rc-telemetry-lane"></a>
- `TELEMETRY_LANE_*` → lane assertion の errors/warnings を解消する

<a id="rc-act-warning"></a>
- `ACT_WARNING_PRESENT` → act warning の回帰差分を修正する

<a id="rc-drift"></a>
- `DRIFT_COUNT_*` → drift 発生源を特定し、継続発生を停止する

<a id="rc-schema"></a>
- `SCHEMA_MISMATCH_*` → registry と実リスト差分を是正する

<a id="rc-fetch-fallback"></a>
- `FETCH_FALLBACK_*` → fallback が増えた対象 API / フィールドを修復する

<a id="rc-auto-healing"></a>
- `AUTO_HEALING_RATE_*` → self-healing 成功率低下の原因（権限/列/上限）を解消する

<a id="rc-health-score"></a>
- `HEALTH_SCORE_*` → dashboard 指標の低下要因を優先順で解消する

<a id="rc-kpi-action-resolve"></a>
- `KPI_ACTION_RESOLVE_RATE_*` → Action 解消率低下の滞留案件を解消する

<a id="rc-kpi-mttr"></a>
- `KPI_MTTR_*` → 初動遅延のボトルネック（通知/担当/手順）を是正する

<a id="rc-kpi-fp"></a>
- `KPI_FALSE_POSITIVE_*` → 誤検知要因（閾値/分類）を是正する

<a id="rc-exception"></a>
- `EXCEPTION_*` → 期限超過/放置/再発の例外を優先処理する

<a id="rc-watch-streak"></a>
- `WATCH_STREAK_*` → watch 連続発生の根本原因を除去する

<a id="rc-transport-concurrency"></a>
- `TRANSPORT_CONCURRENCY_PRESSURE` / `REPEATED_VEHICLE_CONFLICT` → 送迎配車競合の発生状況を確認し、運用ルールを是正する

### 1. `integration-diagnose` が失敗した

- [ ] Actionsログで失敗ステップを確認する（`Typecheck` / `Run SP read-only diagnostics`）
- [ ] `Run SP read-only diagnostics` 失敗時は `SHAREPOINT_SITE` と `SHAREPOINT_TOKEN` を確認する
- [ ] secrets 修正後に `nightly-health` を手動再実行する
- [ ] 再実行が成功するまで `NO-GO` を維持する

### 2. `nightly-patrol` が `Action Required` で停止した

- [ ] 停止は正常挙動として扱う（解除せず原因分析を優先）
- [ ] `docs/nightly-patrol/decision-YYYY-MM-DD.md` を開き `Reason Codes` を確認する
- [ ] fail reason を1件ずつ owner に割当し、修復完了後に再実行する
- [ ] 再実行で `🟢 Stable` になるまで `NO-GO` を維持する

### 3. SharePoint secrets 未設定 / 期限切れ

- [ ] `SHAREPOINT_SITE` の値とテナントURLを照合する
- [ ] `SHAREPOINT_TOKEN` の期限・発行元・権限を確認して再発行する
- [ ] 更新後に `integration-diagnose` を手動実行し、read-only接続成功を確認する

### 4. 実接続は通るが `queryGuard` / `typecheck` が失敗した

- [ ] `typecheck` 失敗時はコード不整合として扱い、投入を停止する
- [ ] `queryGuard` 系テスト失敗時は高リスククエリ遮断回帰として扱い、投入を停止する
- [ ] 修正後に以下を再実行する
- [ ] `npm run typecheck`
- [ ] `npx vitest run src/lib/sp/__tests__/queryGuard.spec.ts`

### 5. 連絡先（NO-GO時）

- [ ] 運用責任者（Release Owner）へ即時連絡する
- [ ] SharePoint 管理者へ secrets / 権限異常を連携する
- [ ] 開発当番へ失敗workflow URL と reason code を共有する
- [ ] `nightly-owner-notify` の owner ルーティング結果（未解決 owner の有無）を確認する
- [ ] 連絡テンプレート: `NO-GO / 失敗workflow / 原因仮説 / 次回再実行予定時刻`

---

### 6. 送迎配車競合への対応 (`rc-transport-concurrency`)

`TRANSPORT_CONCURRENCY_PRESSURE` または `REPEATED_VEHICLE_CONFLICT` が発生した場合、Ops Manager は以下の手順で分析と是正を行います。

- [ ] **同一車両への集中確認**
  - 特定の車両（例: 「車両1」）だけで競合が起きている場合、その車両の担当者間での入力ルールが曖昧な可能性があります。
- [ ] **特定時間帯の偏り確認**
  - 朝の出発直前など、特定の時間帯に入力が集中していないか確認してください。
- [ ] **Refetch による解消状況の確認**
  - 競合が発生しても Refetch (最新データの再取得) で正しく保存できているか、UI 側の操作ログや現場への聞き取りで確認します。
- [ ] **運用ルールの変更検討**
  - 「車両ごとの入力担当を固定する」「入力時間をずらす」等の運用ルールの変更が必要か判断します。

---

## 旧ランブック（履歴）

目的：
- 本番投入直後に「現場で動かない」「異常に気づけない」事態を確実に防ぐ

---

## 🕒 投入後 30分以内に確認（インフラ・疎通）

- [ ] **デプロイ・ゲート成功確認**
  - [ ] GitHub Actions `pre-deploy-gate` がグリーンで完了しているか
- [ ] **リポジトリ生成確認** (F12 Console 等)
  - [ ] `useUsersRepository` 等のファクトリが実行され、適切な kind (demo or real) を返しているか
- [ ] **ハイドレーション成功確認**
  - [ ] クライアントサイドでの React マウントが正常終了しているか

---

## 🕒 投入後 1時間以内に確認（ドメイン・観測）

- [ ] **異常検知センター (ExceptionCenter) の初期データ同期**
  - [ ] [ExceptionCenterPage](/admin/exceptions) を開き、データソースが正常に読み込まれているか
  - [ ] `data-os-alert` (データOS起因) があれば、即座に解消手順を開始
- [ ] **エスカレーションバナーの表示確認**
  - [ ] 重大な例外がある場合、トップページ等にバナーが正しく表示されているか（テストデータ等で検証済）

---

## 🕒 翌朝 9:00 までに確認（ナイトリー・持続性）

- [ ] **Nightly Patrol ログ生成確認**
  - [ ] `docs/nightly-patrol/YYYY-MM-DD.md` が生成されているか
  - [ ] バッチ処理がタイムアウトせずに完了しているか
- [ ] **7日間安定化指標の記録開始**
  - [ ] 各機能（Attendance/Daily等）の平均レスポンス・エラー率の計測が開始されているか

---

## 🚨 HOLD (運用一時停止) 条件

以下のいずれかに該当した場合は即座に差し戻しを検討する：
1. `ExceptionCenter` がランタイムエラーで表示されない
2. リポジトリファクトリが意図しない `kind` (例: 本番なのに demo) を返し続け、DB 整合性が取れない
3. Nightly Patrol が中断される（異常に気づけない状態）

---

## 2026-04-04 運用開始判定ログ

2026-04-04 本番前最終化完了。  
PR #1379 を main にマージ済み（merge commit: `99cde2dd`）。  
pre-production 同期、競合解消、型チェック、主要テスト通過を確認。

### 最終確認結果（2026-04-04 JST）

- `pre-deploy-gate`（run: `23972461300`）: **failure**
  - 失敗理由: `VITE_SP_ENABLED` が `1` ではない（実行環境では空）
  - 実行環境表示: `VITE_SP_ENABLED`, `VITE_APP_ENV`, `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID` が空
- 本番 MSAL 設定の存在確認:
  - workflow が参照する repository secrets: `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID` は未確認（現状 `pre-deploy-gate` では空展開）
  - repository 側には `AAD_APP_ID`, `AAD_TENANT_ID` は存在（命名差異あり）

### 判定

運用開始判定: **HOLD**  
2026-04-04（JST）時点で、PR #1379 は main 反映済み（`99cde2dd`）。  
ただし `pre-deploy-gate` の最終 Green と、workflow 参照名（`VITE_*`）での本番シークレット整備が未達のため、GO 判定は保留とする。

### GO へ進めるための条件

1. repository secrets に `VITE_SP_ENABLED=1` と `VITE_APP_ENV=production` を設定
2. `VITE_MSAL_CLIENT_ID` / `VITE_MSAL_TENANT_ID` を本番値で設定（必要なら `AAD_*` から統一）
3. `pre-deploy-gate` を再実行し、Green 完了を確認

---

## 2026-04-04 本番投入判定: GO

2026-04-04 本番投入判定：GO

PR #1379 により本番前最終化を完了。  
続いて PR #1380 を main にマージし、`pre-deploy-gate` の本番環境変数マッピングを修正した。  
その結果、main 上の `pre-deploy-gate` は SUCCESS となり、HOLD 解除条件（main反映 + gate green）を満たした。

- PR #1380 merged at: 2026-04-04 15:01:39 JST
- merge commit: `f3ea0b2a`
- pre-deploy-gate run: `23972786058`
- completed at: 2026-04-04 15:04:33 JST

以上により、2026-04-04 をもって運用開始可と判断する。
