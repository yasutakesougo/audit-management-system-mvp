# Audit Management System MVP CI Failure Taxonomy / PR Triage Runbook

調査実施日: 2026年6月19日
対象コミット: `7dde895340c5a6914f2c12ecd858621d5821a105`

## 1. 調査目的
本ドキュメントは、Audit Management System MVP におけるプルリクエスト（PR）トリアージ業務の標準化を目的とします。
本プロジェクトでは、ドキュメントのみの変更（docs-only PR）であっても多くの CI チェックが自動実行されます。その中で発生するテストや型チェックの失敗を効率的に分類・判断し、開発者が「直すべき失敗（Diff-Caused）」か「待つべき失敗（Non-Diff-Caused / Flaky）」かを素早く判別できるトリアージランブックを定義します。

---

## 2. PR Triage の基本原則
PRトリアージでは、CI のステータスが「Red（失敗）」になった際に、パニックにならず以下の3原則に従って論理的に切り分けを行います。

1. **Scope First（範囲の確認）**:
   - 変更されたファイル（`changedFiles`）と意図した修正範囲が一致しているかを確認する。
2. **Isolate Cause（原因の分離）**:
   - 失敗したテストが「自分のコード変更（Diff）」によって発生したのか、「既存コードのデグレード（Drift）」や「環境起因（Flaky / Infra）」によるものかを分離する。
3. **Action or Wait（行動と待機の選択）**:
   - 自分の変更が原因であれば追加コミットで修正し、外部要因や flaky によるものであれば required checks 外であることを確認した上で Draft 解除（マージ対象化）へ進む。

---

## 3. Scope 確認の標準手順
PR のチェックに入る前に、まず PR に無関係なローカルの環境変数定義ファイルやダッシュボード検証用ファイルなどの一時的な変更が混入していないかを確認します。

### ステップ 1: ローカルでの範囲チェック
```bash
git status --short
```
* **期待される状態（docs-onlyの場合）**:
  - 新規/修正された markdown ファイル1枚のみが表示され、TS/TSX ファイルや環境変数ファイルが staged 状態になっていないこと。

### ステップ 2: PR 範囲の確認 (GitHub CLI による検証)
```bash
gh pr view <PR番号> --json changedFiles,files,isDraft
```
* **チェック項目**:
  - `changedFiles` が想定された数（docs-only なら `1`）であること。
  - `files` 内のパスに無関係なファイルが含まれていないこと。
  - `isDraft` が `true` であること（確認中は Draft 状態を維持）。

---

## 4. CI Check 種別と失敗分類
対象コミット時点で定義されている主要な CI チェックと、その役割を以下に整理します。

### 1. `ci.yml` (主要 CI パイプライン)
* **Core API Contracts (`contracts`)**:
  - 必須。`spClient.contract.spec.ts` などの API 契約テスト。
* **Registry 関連チェック (`registry-static-audit`, `registry-ssot`, `registry-integration`, `registry-drift-probe`)**:
  - 必須。SharePoint スキーマレジストリの静的監査、SSOT、統合検証、ドリフト検証。
* **TypeCheck (`typecheck` / `TypeScript type check`)**:
  - 必須。プロジェクト全体の TypeScript 型定義チェック (`tsc -p tsconfig.build.json --noEmit`)。環境変数の整合性検証も含む。
* **ESLint (`lint` / `ESLint (enforce ARCHITECTURE_GUARDS)`)**:
  - 必須。インポート制限境界やルール違反の静的解析。
* **Index Audit (`index_audit`)**:
  - 必須。SharePoint インデックスガバナンスとスキーマドリフト防止の検証。
* **Unit Test (`unit-test-shard` 1/2/3)**:
  - 必須。Vitest によるユニットテストのシャード並行実行。`check-act-warnings.mjs` を用いた `act` 警告回帰検証を含む。

### 2. `ci-preflight.yml` (事前検証)
* **Test IDs Guard (`test-ids-guard`)**:
  - E2Eで使用する `data-testid` の変更検知。
* **Schedule unit (`schedule-unit`)**:
  - タイムゾーン（Asia/Tokyo, America/Los_Angeles）を跨いだスケジュール機能の単体テスト。

### 3. `report-links.yml`
* **links (`links`)**:
  - PR コメントにカバレッジ、Lighthouse、Sentry のリンクを自動挿入する。

### 4. `pr-guardrails.yml`
* **Wrangler label guard (`wrangler-label-guard`)**:
  - `wrangler.toml` 変更時に `cf/wrangler` ラベルの付与を強制する。
* **AI Skills protocol check (`skill-label-check`)**:
  - リファクタリングや Hardening ラベル付与時に PR 本文への AI Skills セクション記載をチェックする。

---

## 5. Diff-Caused / Non-Diff-Caused 判定基準
失敗したジョブが「自分の変更」によるものかを判断するための判断ツリーです。

```mermaid
graph TD
    A[CI Job 失敗] --> B{変更ファイルにコードファイル TS/TSX は含まれるか?}
    B -- NO (docs-only 等) --> C{links / lint 系の失敗か?}
    B -- YES --> D[コード変更によるデグレードの可能性高: Diff-Caused]
    
    C -- YES (リンク切れやdiff警告) --> E[Docsの修正が必要: Diff-Caused]
    C -- NO (typecheck / contract / test の失敗) --> F[既存の型エラーや環境起因: Non-Diff-Caused]
    
    F --> G{Required check か?}
    G -- YES (Merge Blocked) --> H[メインブランチの修復待ち / 分類を記録して待機]
    G -- NO --> I[Draft解除可能 (無視してよい失敗と分類)]
```

---

## 6. Docs-only PR の扱い
ドキュメントのみを修正する PR において、各 CI チェックで発生し得る失敗の分類と対応方針です。

| 失敗した CI ジョブ | docs-onlyで起き得るか | 分類 | 対応方針・トリアージアクション |
| :--- | :---: | :--- | :--- |
| **`links` failure** | あり | **Diff-Caused** | ドキュメント内に記述したリンク（内部相対パス等）の記述エラーやリンク切れの可能性。Markdown ファイルのリンク記述を再確認して修正。 |
| **`lint` (formatting) / `git diff --check`** | あり | **Diff-Caused** | 行末の半角スペース（trailing whitespace）や空行のインデントが残っている。対象ファイルのスペースを削除して修正。 |
| **`TypeCheck` / `typecheck`** | なし（原則） | **Non-Diff-Caused** | ドキュメントの変更で TypeScript 型チェックが落ちることはない。他者がメインにマージした未解決の型エラー（Drift）が起因。追加修正は不要、マージ待機。 |
| **`Core API Contracts`** | なし | **Non-Diff-Caused** | API契約の不一致。ご自身のドキュメント変更とは無関係。マージ待機。 |
| **`Unit Test` / `preflight-unit`** | なし | **Non-Diff-Caused / Flaky** | テストのタイムアウトや `act` 警告の回帰。ご自身のドキュメント変更とは無関係。マージ待機。 |
| **`Deep Tests (Chromium)`** | なし | **Flaky** | E2Eテストのネットワーク遅延やタイミングによる不安定性。原則追加修正なし。 |
| **`quality_extended` / `csp`** | なし | **Known Instability** | 既知の環境不安定性。ログを確認し、関係なければ追加修正なし。 |

---

## 7. Flaky / Known Failure の扱い
Playwright による E2E テストや、特定の非同期処理が絡むユニットテストは、コードの欠陥以外（ネットワーク遅延、実行マシンの負荷、タイミング）で稀に失敗する「Flaky」状態になることがあります。

### 1. Flaky 判定の基準
* 前回の実行では通過していた、または他のPRで同様の箇所の失敗が頻発している。
* 失敗ログが `timeout` または `Selector not found` などのタイミング問題を示している。
* 自分の変更範囲とテストの実行領域が完全に乖離している（例: docs 変更時に E2E が失敗）。

### 2. 対応手順
* **docs-only PR の場合**: required checks であっても、明らかに自分の変更と無関係であれば rerun を1回試行し、それでも通らない場合は「既存の Flaky」として分類した上で、管理者に報告して Draft 解除を行います。

---

## 8. `--no-verify` を使ってよい条件
ローカルのコミット時（Husky）には、リポジトリ全体の型チェック（`tsc`）や lint が自動で走ります。
作業スペース内に一時的な未コミット TS ファイルがあり、そのエラーによって docs ファイルのコミットがブロックされる場合、以下の条件をすべて満たす場合に限り、例外的に `--no-verify` でのコミットを許可します。

### 例外適用の必須条件 (すべて満たすこと)
1. **docs-only であること**: 変更ファイル（staged）が markdown ファイルなどのドキュメントのみであること。
2. **staged の確認**: `git diff --cached --name-only` で、コミット対象にコード（`.ts`, `.tsx`, `.json` 等）が含まれていないことを確実に検証していること。
3. **未コミットファイルの保護**: 作業中の TS ファイルは staged から外した状態（unstaged）になっていること。

---

## 9. Draft解除 Candidate 判定
PR を「Draft」から「Ready for review（Draft解除）」へ移行し、マージ可能と判断するためのチェックリストです。

### 1. 判定チェックリスト
* [ ] **Scope 一致**: `changedFiles` の数が想定通り（docs-only なら 1）である。
* [ ] **ファイル一致**: 対象ファイルが目的のドキュメント（例: `docs/architecture/ci-failure-taxonomy.md`）のみである。
* [ ] **Required checks 通過**: required に指定されている CI ジョブがすべて `success` または `skipped`（docs-only によるスキップ）になっている。
* [ ] **Non-diff-caused 分類完了**: 失敗している required 外のジョブについて、ログを確認し「無関係なエラー / Flaky」と切り分けができている。
* [ ] **ローカル漏洩なし**: PR 本文や docs 本文にローカルの絶対パス、特定のプロトコルスキーム、個人情報、環境設定ファイルなどのローカル固有情報が含まれていない。

### 2. 状態による移行判断
* **Draft解除してよい（Candidate）**:
  - 上記チェックリストをすべてクリアしている状態。
* **追加修正が必要なため Draft解除不可**:
  - `links`（リンク切れ）や `git diff --check`（スペース警告）などの docs-only 起因の失敗が残っている状態。
  - Scope が崩れて無関係なファイルが staged/commit に混入している状態。

---

## 10. 今後の改善ロードマップ (Next Small PRs)

1. **`ci: skip-tsc-on-docs-only` (中規模)**
   * **目的**: 変更されたファイルが `docs/**/*.md` のみの場合、GitHub Actions の `TypeCheck` や `Unit Test` などの重いジョブを自動でスキップする `path-filter` を導入し、CI の実行時間とリソースを節約する。
2. **`ci: strict-links-check-run` (小規模)**
   * **目的**: 現在 stub になっている `npm run lint:docs` に対し、`scripts/lint-links.cjs` を接続して docs 変更時のマークダウンリンク切れ自動検証を CI に組み込む。
3. **`test: stabilize-flaky-e2e-wait` (中規模)**
   * **目的**: Playwright の E2E テストで発生頻度の高い flaky なアサーションに対し、タイムアウト値の適切な調整や明示的な locator の locator wait への書き換えを行い、CI 成功率を底上げする。
