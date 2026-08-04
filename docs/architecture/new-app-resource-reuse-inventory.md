# 新アプリ再利用資源の棚卸し

## 1. 目的と判定範囲

この文書は、現行 `audit-management-system-mvp` から新アプリへ持ち込める資源と、持ち込んではならない資源の境界を固定するための一次棚卸しである。

この工程では、新アプリの構成、認証、権限、保存方式、公開方式、SharePoint構成を決定しない。現行アプリ全体の移植計画でもない。

判定は次の3分類で行う。

| 分類 | 意味 |
|---|---|
| `domain` | 外部I/O、認証、保存、表示に依存しない業務ロジックの候補 |
| `contracts` | 新アプリで再設計するスキーマ、ポート、DTOの材料 |
| `fixtures` | 完全に合成したデータと境界テストの候補 |

実在情報または匿名化状態が確認できない資源は、再利用せず `未確認/HOLD` とする。

資源の分類と利用可否は、別の軸として記録する。

| 軸 | 値 |
|---|---|
| 資源分類 | `domain` / `contracts` / `fixtures` |
| 利用判定 | `GO` / `CONDITIONAL` / `HOLD` / `NO-GO` |

## 2. 調査スナップショット

| 項目 | 内容 |
|---|---|
| 対象リポジトリ | `yasutakesougo/audit-management-system-mvp` |
| 基準 | `origin/main` |
| 基準SHA | `61de858fc30fff1d4eff0052082b54b591a344c3` |
| 調査日 | 2026-08-04 JST |
| 現在の作業ツリー | 別作業の未コミット変更あり。本調査では変更しない |
| 実SharePoint・実運用データ | 未確認。本調査では接続・書き込みを行わない |

SHA、PR状態、実データの分類は時間依存であるため、次工程の開始時に再確認する。

## 3. P0 情報管理判定

### 3.1 対象

次の2ファイルには、利用者に結び付く可能性がある識別子、別名、具体的な支援手順、原資料由来の記述が含まれる。

- `src/features/planning-sheet/constants/userProcedureDetails.ts`
- `src/features/daily/utils/normalizeExecutionLookup.ts`

この一次調査だけでは、情報が実在情報なのか、匿名化済みのテスト情報なのかを確定できない。したがって、判定は次のとおりとする。

```text
資源分類: 未分類
情報分類: 未確認
利用判定: NO-GO
状態: HOLD
```

### 3.2 禁止事項

- 内容、氏名、利用者ID、ID別名、具体的手順を新アプリへコピーしない。
- 新しいfixture、サンプルJSON、README、設計書へ実値を転記しない。
- これらの値を匿名化したつもりで再利用しない。匿名化 fixture は新規の合成値で作る。
- 調査目的で実SharePoint、端末、保存済みデータへ接続しない。
- 現行リポジトリを外部へ配布する判断を、この文書だけで行わない。

### 3.3 別承認が必要な対応

実在情報であることが確認された場合は、次を本棚卸しとは別の承認作業として扱う。

1. 公開範囲とアクセス可能なclone・forkの影響確認
2. 公開範囲変更の要否判断
3. Git履歴からの除去方針と影響確認
4. 必要に応じた関係者・データ管理責任者への報告

本工程では、公開設定変更、履歴書換え、削除、秘密情報変更を行わない。

## 4. 再利用候補の分類

### 4.1 条件付きで `domain` / `contracts` の材料にできるもの

| 資源 | 資源分類 | 利用判定 | I/O | 失敗時の扱い | 次工程での扱い |
|---|---|---|---|---|---|
| `src/domain/isp/schema/` | `contracts` | `CONDITIONAL` | なし | Zod検証エラーとして拒否 | 新アプリのJSON Schema・ドメイン入力の材料にする。現行の型・SP行形式をそのまま公開契約にしない |
| `src/domain/isp/planningSheetVersion.ts` | `domain` | `CONDITIONAL` | なし | 不正な対象版は明示的に失敗 | 期限判定、版履歴整形などの純粋関数だけを抽出する。保存・同時更新の契約は新設する |
| `src/domain/regulatory/severeDisabilityAddon.ts` | `domain` | `CONDITIONAL` | なし | 制度判定不能は適格とみなさない | 制度根拠を確認したうえで、純粋な閾値判定として再構成する |
| `src/features/kiosk/domain/kioskProcedureMemo.ts` | `domain` または移行用`contracts` | `CONDITIONAL` | なし | 不明な旧形式は安全なメモ扱いまたは明示エラー | 旧データ互換が必要な場合だけ、隔離した移行パーサーとして利用する |

上記は業務ロジックの候補であって、現行の保存モデル、SharePoint列名、利用者ID体系を再利用する許可ではない。

### 4.2 `fixtures` として選別できるもの

- 現行の純粋関数テストの境界条件。
- ISPの状態遷移、期限、版切替の合成ケース。
- 制度判定の閾値、欠損、不正値、算定不能ケース。
- 旧メモ形式のラベル解析・シリアライズケース。

fixtureは次の制約を満たす合成値だけで作る。

- 利用者名、職員名、実在ID、実在コードを使わない。
- 実在の支援内容、原資料名、事業所名を使わない。
- 日付はテスト専用の固定日を使用する。
- 識別子とテキストには `synthetic-*` 等の合成値を使用する。
- 日付型の検証では、ISO 8601など対象スキーマに適合する値を使用する。例として `2099-01-01` を使用できる。
- fixtureの目的と期待結果をテスト内で説明し、実運用データを暗黙に参照しない。

### 4.3 再利用しないもの

| 資源 | 判定理由 |
|---|---|
| `src/features/planning-sheet/constants/userProcedureDetails.ts` | 個人に結び付く可能性がある具体データ。P0未確認のため禁止 |
| `src/features/daily/utils/normalizeExecutionLookup.ts` | 個人に結び付くID別名の固定表。新アプリの識別子設計に持ち込まない |
| 現行の実施記録Repository | 複合キー、upsert、削除、旧スキーマ吸収が新アプリの正式契約になっていない |
| `src/infra/sharepoint/repos/SharePointAbcRecordRepository.ts` | SharePoint API・UUID・論理削除に依存し、冪等保存契約を新アプリへ保証しない |
| `src/lib/sp/spListSchema.ts` およびProvisioning | リスト作成・列追加・外部API・運用権限に依存する。新アプリの保存方式を拘束しない |
| 現行の版切替workflow | 複数行更新、ETag、同時実行、二回目変更ゼロの保証が新契約として固定されていない |
| `procedureStore.v1` 等のlocalStorage正本 | 端末ローカルであり、共有正本・監査正本ではない |
| 現行React画面、権限設定、公開workflow | 新アプリのUI、認証、認可、公開責務と結合している |

## 5. PR #2541 の扱い

[PR #2541](https://github.com/yasutakesougo/audit-management-system-mvp/pull/2541) は、調査時点で `OPEN`、未マージ、Ready for review、head `405e16f254b83b7853fe6491d994b0ecd2915272` である。

PR #2541のGitHub上のPR差分は、制度ロジック、テスト、UI、handoff境界を含む15ファイルである。一方、基準mainとPR headを直接比較すると、履歴分岐の影響により22ファイルとなり、別系統のCI handoff、fixture、設定変更も含まれる。したがって、PR差分だけでなく、ブランチ全体も新アプリへ移植しない。

候補は次に限定する。

- `src/domain/regulatory/behaviorScoreResolution.ts`
- `src/domain/regulatory/severeAddonUserResolution.ts`
- 上記の欠損・不正値・境界を扱う、P0混入検査を通過した、合成値だけで構成する単体テスト

ただし、再利用前に次のレビュー指摘を解消・再確認する。

- 行動関連点数は整数かつ `0～24` だけを有効とする。
- 保存上の正式値 `none` は、算定不能ではなく非該当として扱う。
- 利用者データの算定不能を、施設全体の研修比率判定へ波及させない。
- 有効な行動関連点数が閾値未満なら、支援区分が欠損・不正でも確定的不適格として扱う。
- 算定不能時の空finding一覧を、制度要件充足として表示しない。

これらが確認されるまで、PR #2541由来のコードは `domain` 候補に留め、再利用承認はしない。

## 6. 新アプリとの境界

この工程では、次の公開API・型・保存スキーマを追加しない。

- 新アプリの認証・認可API
- 新アプリの保存Repository
- JSON Schemaの確定版
- SharePoint、Firestore、SQL等の永続化アダプター
- 公開・デプロイworkflow

次工程で設計する場合も、現行コードからは意味と境界条件だけを参照し、識別子、保存形式、権限、外部接続は新規に決める。

## 7. 次PRの分割案

1. `docs`: P0判定と再利用禁止境界を固定する
2. `contracts`: 合成fixtureを前提に新アプリのJSON Schema、DTO、portを設計する
3. `domain`: 承認済みの純粋関数だけを再構成する
4. `fixtures`: 実値を含まない境界テストを追加する
5. `infra`: 認証、保存、権限、公開を新アプリとして個別設計・検証する

各PRで対象を混ぜない。特に、domain移植と外部接続、権限、公開処理を同じPRに入れない。

## 8. 本文書の受入条件

- P0対象を `未確認/HOLD` と明記している。
- P0対象の内容、氏名、実ID、具体的手順を本文書へ転記していない。
- `domain`、`contracts`、`fixtures` の各候補に判定理由がある。
- 再利用しないRepository、Provisioning、localStorage、UI、権限、公開workflowを列挙している。
- PR #2541をブランチ全体で再利用しないことと、再利用前のレビュー確認事項を記録している。
- 本文書以外のソースコード、fixture、設定、公開状態を変更していない。
- `git diff --check` と、本文書への実ID・具体的支援内容の混入検査が成功している。

## 9. 固定後の判定

```text
P0情報管理境界: READY
再利用資源の一次分類: READY
PR #2541由来コードの再利用: HOLD
新アプリのcontracts設計: 条件付きGO
domain実装: NO-GO
データ移行: NO-GO
SPFx実装: NO-GO
現行キオスク変更: 禁止
```
