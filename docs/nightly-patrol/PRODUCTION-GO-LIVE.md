# 🚀 運用開始パトロールランブック (PRODUCTION-GO-LIVE)

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
