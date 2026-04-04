# イソカツ AI開発OS — 運用ルール v1

> OSを「便利ツール集」から **日常運用の標準手順** にするための最小ルール

---

## Rule 1: `/scan` の必須化

### いつ `/scan` を必須にするか

| 条件 | `/scan` 必須 | 理由 |
|------|:----------:|------|
| 新機能の開始 | ✅ 必須 | 既存コードとの衝突を防ぐ |
| 3ファイル以上を変更する修正 | ✅ 必須 | 影響範囲を先に把握する |
| 不具合修正（`/debug`） | ✅ 必須 | 原因の所在を構造的に特定する |
| 1ファイルの軽微な修正 | ❌ 不要 | オーバーヘッドが見合わない |
| ドキュメント更新 | ❌ 不要 | コード構造に影響しない |
| `/refactor-plan` の計画時 | ✅ 必須 | 現状把握なしの改修計画は危険 |

### ルール

```
作業開始時の判断フロー:

  このタスクは既存コードに触るか？
    ├─ No → そのまま /define から開始
    └─ Yes → 3ファイル以上触るか？
              ├─ No → /scan は任意（L1で十分）
              └─ Yes → /scan L2 必須
                        不具合調査なら /scan L3
```

---

## Rule 2: `/refactor-plan` の適用基準

### いつ `/refactor-plan` を使うか

| 条件 | コマンド | 理由 |
|------|---------|------|
| 1ファイル 600行超の分割 | `/refactor` | 単体分割で十分 |
| 2ファイル以上にまたがる構造改善 | `/refactor-plan` | 段階的戦略が必要 |
| 共有コンポーネントの変更 | `/refactor-plan` | 影響範囲が広い |
| Schema / Repository の再設計 | `/refactor-plan` | 型安全の連鎖が崩れうる |
| CSS / UI のみの変更 | `/refactor` | 構造的影響が少ない |

### ルール

```
分岐基準:

  影響範囲が 1 feature 内に閉じるか？
    ├─ Yes → /refactor で十分
    └─ No → /refactor-plan 必須
              ├─ Strangler Fig / Parallel Run の選定
              ├─ Phase 分解（PR 単位）
              └─ ロールバック計画の策定
```

---

## Rule 3: PR前のゲート

### どのコマンドをPR前に回すか

| PR の種類 | `/review` | `/fortress` | `/test-design` | `/compliance` |
|----------|:---------:|:-----------:|:--------------:|:------------:|
| 新機能 | ✅ 必須 | ✅ 必須 | 🟡 推奨 | 制度関連なら必須 |
| バグ修正 | ✅ 必須 | 🟡 推奨 | ❌ 不要 | ❌ 不要 |
| リファクタリング | ✅ 必須 | 🟡 推奨 | ❌ 不要 | ❌ 不要 |
| ISP/記録系の変更 | ✅ 必須 | ✅ 必須 | 🟡 推奨 | ✅ 必須 |
| ドキュメント | ❌ 不要 | ❌ 不要 | ❌ 不要 | ❌ 不要 |
| SharePoint列追加 | ✅ 必須 | ✅ 必須 | ❌ 不要 | 🟡 推奨 |

### ルール

```
PR前チェックの判断フロー:

  本番データに影響するか？
    ├─ Yes → /review + /fortress 必須
    │         制度データに関わるか？
    │           ├─ Yes → /compliance も必須
    │           └─ No → /compliance は任意
    └─ No → /review のみ必須
```

### 最小ゲート（全PRに適用）

```
PR作成前に最低限これを確認する:

1. npx tsc --noEmit        ← 型エラーなし
2. npx vitest run           ← テスト全通過
3. /review                  ← セルフレビュー完了
```

---

## Rule 4: `/handoff` の保存先と運用

### 保存先

| 種類 | 保存先 | 命名規則 |
|------|--------|---------|
| セッション引き継ぎ | `docs/handoff/` | `YYYY-MM-DD_[テーマ].md` |
| スプリント引き継ぎ | `docs/handoff/sprint/` | `sprint-[N]_handoff.md` |
| 緊急修正引き継ぎ | Issue コメント | Issue 内に直書き |

### ルール

```
/handoff のルール:

1. 1日の作業終了時に必ず /handoff を実行する
2. 出力は docs/handoff/ にコミットする
3. 翌日の最初に前日の handoff を読んでから開始する
4. 3日以上間が空く場合は /scan L2 も追加実行する
```

### ディレクトリ構造

```text
docs/handoff/
├── 2026-03-17_sharepoint-audit.md
├── 2026-03-16_ops-dashboard.md
├── 2026-03-15_evidence-analysis.md
└── sprint/
    ├── sprint-12_handoff.md
    └── sprint-13_handoff.md
```

---

## Rule 5: Nightly Patrol の確認

### 概要

毎晩 JST 03:15 に GitHub Actions が自動実行し、コード品質レポートを `docs/nightly-patrol/` に出力します。

### ルール

1. 毎朝 docs/nightly-patrol/ の最新レポートを確認する
2. 🔴 があれば `/debug` `/refactor` `/issue` に繋ぐ
3. 🟡 は次スプリントのバックログに入れるか判断する
4. 🟢 は対応不要

Nightly 判定コマンド（手動実行時）:

```bash
npm run patrol
npm run patrol:assert
npm run patrol:dashboard
npm run patrol:raw-fetch
npm run patrol:admin-status
npm run patrol:exception-center
npm run patrol:decision
```

判定 1 行（decision レポート）:

```text
🟢 Stable（問題なし）
🟡 Watch（軽微な懸念あり）
🔴 Action Required（明日対応必須）
```

自動化オプション（Nightly workflow）:

- `NOTIFY_WEBHOOK_URL` を設定すると `Action Required` 時に通知
- リポジトリ変数 `NIGHTLY_AUTO_ISSUE=true` で `Action Required` 時に `nightly-apply --apply` を実行
- `ADMIN_STATUS_RAW_URL` / `EXCEPTION_CENTER_RAW_URL` を設定すると nightly が生JSONを自動取得（`fetch-nightly-raw-summaries.mjs`）
- `NIGHTLY_RAW_BEARER_TOKEN` で取得時認証（任意）
- `NIGHTLY_RAW_FETCH_STRICT=false`（デフォルト）では raw 取得失敗時も workflow は継続し、summary 欠損を `Watch` 理由として扱う
- `ADMIN_STATUS_RAW_PATH` を指定すると `/admin/status` 生JSONを取り込み、`docs/nightly-patrol/admin-status-summary-<date>.json` を生成
- `EXCEPTION_CENTER_RAW_PATH` を指定すると `ExceptionCenter` 生JSONを取り込み、`docs/nightly-patrol/exception-center-summary-<date>.json` を生成
- decision は `ADMIN_STATUS_SUMMARY_PATH` / `EXCEPTION_CENTER_SUMMARY_PATH` を読み、入力欠損時は `Watch` に倒す

decision の reason code（JSON）:

- `ADMIN_STATUS_FAIL`
- `ADMIN_STATUS_SUMMARY_MISSING`
- `EXCEPTION_HIGH_SEVERITY`
- `EXCEPTION_OVERDUE_PRESENT`
- `EXCEPTION_CENTER_SUMMARY_MISSING`

自動Issue（`nightly-apply`）:

- `decision-<date>.json` の reason code を本文に展開
- actionable classification が 0 件でも fail reason code があれば `nightly-decision-control` Issue を作成

### レポート → コマンド対応表

| 観点 | 対応コマンド |
|------|------------|
| 巨大ファイル (800行超) | `/refactor` で即分割 |
| 巨大ファイル (600-800行) | 次の変更時に `/refactor` |
| any 使用 | `/review` で型安全化 |
| テスト未整備 | `/test-design` で観点整理 |
| Handoff 未実施 | `/handoff` で作成 |

---

## 運用サマリー

| タイミング | 必須アクション |
|-----------|-------------|
| **朝一** | Nightly Patrol レポートを確認 → 🔴 があれば対応 |
| **作業開始** | 前回の handoff を読む → `/scan` が必要か判断 |
| **設計開始** | `/define` → Design系コマンド |
| **実装完了** | `tsc --noEmit` + `vitest run` |
| **PR作成前** | `/review` 必須 + `/fortress` 判断 |
| **作業終了** | `/handoff` → `docs/handoff/` に保存 |

---

> [!IMPORTANT]
> このルールの目的は「全部やる」ことではなく、**やるべきタイミングで迷わないこと**。
> 判断に迷ったら上のフロー図に従う。
