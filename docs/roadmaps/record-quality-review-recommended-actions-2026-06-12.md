# Record Quality Review 推奨アクションロードマップ

> 初版: 2026-06-12
> 更新: 2026-07-06
> 現在地: `main` 29f9bc6e 時点の実装・runbook・テストを反映

## 目的

Record Quality Review を「Daily 保存時に下書きを作る」段階から、「運用で確認し、判断し、改善につなげる」段階へ進める。

この文書は 2026-06-12 時点の未追跡ロードマップを、現在の `main` に合わせて更新したもの。既に完了した実装・テスト・runbook は完了済みとして分離し、残す推奨アクションを SharePoint 診断、E2E、月次改善ループに絞る。

## 現在の運用契約

Daily 保存後の Record Quality Review 下書き作成は `record-quality:daily-save` で観測する。ログと戻り値の契約は `docs/runbooks/record-quality-review-observability.md` に固定済み。

- `createdReviewCount`: 新規に作られたレビュー下書き数。
- `skippedReviewCount`: スキップした利用者行の合計。
- `emptyTextSkippedReviewCount`: レビュー対象本文がないためスキップした件数。
- `existingReviewSkippedReviewCount`: 既存レビューがあるためスキップした件数。
- `userRowCount`: Daily 保存対象の利用者行数。
- 元の支援記録本文はログにもレビュー metadata にも保存しない。

Human Review Queue では、未確認・修正済み・判断済み・採用済み・破棄の summary が表示される。Queue 側の summary 表示は最小運用に必要な状態まで到達済み。

## 完了済み / Superseded

| 項目 | 状態 | 現在の根拠 |
|---|---|---|
| `saveDailyRecordWithQualityReview` のローカル品質ゲート | 完了 | `src/features/record-quality/application/saveDailyRecordWithQualityReview.spec.ts` が Daily 保存、作成件数、空行スキップ、既存レビュー重複スキップ、本文非保存を保護している |
| ログ項目の運用契約化 | 完了 | `docs/runbooks/record-quality-review-observability.md` が各 count の意味と確認手順を固定している |
| スキップ理由の分類 | 完了 | `emptyTextSkippedReviewCount` と `existingReviewSkippedReviewCount` が戻り値とログに含まれる |
| Human Review Queue summary | 完了 | `HumanReviewQueueSummary` が pending / draft / revised / reviewed / accepted / discarded の件数を表示する |
| Human Review 判断操作の基本保護 | 完了 | accept / revise / discard の domain spec と workflow spec が存在する |
| PR 本文での初期説明 | Superseded | 実装済み契約は runbook とテストに移ったため、今後のPR本文では差分だけ説明すればよい |

## 残す推奨アクション

| 優先度 | アクション | 成果物 | 完了条件 |
|---|---|---|---|
| P1 | Record Quality Review 保存先の SharePoint 診断 | read-only 診断または preflight 結果 | 保存先リスト、権限、必須列、候補 internal name drift を WARN / FAIL 契約で確認できる |
| P1 | Daily 保存から Human Review Queue までの E2E | Playwright の最小スモーク | Daily 保存後にレビュー下書きが作成され、Queue summary に反映される最小フローを保護できる |
| P2 | 月次改善ループ化 | 月次レビュー指標の運用メモまたは集計ビュー | reviewed / accepted / revised / discarded と古い draft 件数を月次改善・教育材料として確認できる |

## 1. SharePoint 診断

Record Quality Review の永続化レーンは、実装の正しさだけでなく SharePoint 側の設定 drift に影響される。既存の SharePoint drift resilience と同じ考え方で、read-only 診断を先に置く。

確認対象:

- Record Quality Review 保存先リストの存在。
- 診断 identity の read 権限。
- 実行 identity の create / read / update 権限。
- 必須列の存在。
- 想定 display name と observed internal name の候補差分。
- 診断不能時の WARN / FAIL 分類。

最初のPRは診断契約または docs-only の設計記録に留める。実際の SharePoint resource 作成、権限変更、列追加は別PRで明示承認を取る。

## 2. E2E スモーク

現在は domain / hook / component のテストで主要契約を保護している。次は、Daily 保存から Human Review Queue summary までの最小ユーザーフローを E2E で守る。

最小シナリオ:

1. Daily record を保存する。
2. `createdReviewCount` が作られる前提の入力を使う。
3. Human Review Queue を開く。
4. 要確認件数または未確認件数が増えることを確認する。
5. 元の支援記録本文がレビュー metadata やログへ露出しないことを、E2Eで検証可能な範囲に限定して確認する。

注意:

- auth / secret 不足による失敗は E2E 実装欠陥と分けて記録する。
- Queue UI の見た目変更を主目的にしない。
- 既存の unit / component spec と重複する細部の断言を増やしすぎない。

## 3. 月次改善ループ

Human Review の判断結果を、月次監査と教育に接続する。最初は自動レポートではなく、手動で確認できる集計契約から始める。

候補指標:

- review draft 作成率: `createdReviewCount / userRowCount`
- 要修正率: `revised / reviewed`
- 採用率: `accepted / reviewed`
- 破棄率: `discarded / reviewed`
- 長期未確認数: draft のまま一定日数を超えた件数

使い道:

- 記録品質の低い項目を研修テーマにする。
- revised が多い分類・ルールを見直す。
- discarded が多い提案ロジックを改善する。
- 月次監査で「人が確認した提案」として根拠を示す。

## 推奨順

1. SharePoint 診断の read-only 契約を文書化する。
2. 診断実装を小PRにする。
3. Daily 保存から Queue summary までの E2E スモークを追加する。
4. 月次レビュー指標の運用メモを作る。
5. 必要になってから集計ビューまたは自動レポートを検討する。

## 先送りしてよいもの

- AI による本文評価ロジックの高度化。
- 現場入力画面への追加警告。
- 月次レポートの自動生成。
- 提案統合レイヤーへの完全統合。
- SharePoint resource 作成や権限変更。

理由: 現段階では、作成数・スキップ理由・判断結果が安定して追える状態を維持することが先。判断材料が蓄積してから UI や AI 評価を広げる方が、入力負担と誤提案リスクを抑えられる。

## この文書のスコープ

この更新は docs-only。実装、テスト、workflow、package、env は変更しない。
