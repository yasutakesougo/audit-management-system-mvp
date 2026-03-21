# PDCA SharePoint Provisioning

## 1. 目的

PDCA（Check/Act）で使用する SharePoint リストを、アプリ実装と一致する定義で作成する。

- 対象実装:
  - `src/sharepoint/fields/pdcaCycleFields.ts`
  - `src/sharepoint/fields/listRegistry.ts`
  - `src/data/isp/sharepoint/SharePointBehaviorMonitoringRepository.ts`
  - `src/data/isp/sharepoint/SharePointPlanningSheetReassessmentRepository.ts`

## 2. 対象リスト

- `BehaviorMonitoringRecord_Master`（Check）
- `PlanningSheetReassessment_Master`（Act）

必須ルール:

- リスト名は完全一致
- 列は **InternalName 完全一致**
- 表示名の変更は任意（InternalName が一致していれば可）
- 既存の別列・別リストの流用は禁止

## 3. 列定義一覧

### 3.1 BehaviorMonitoringRecord_Master

| InternalName | 型 | 必須 | 備考 |
| --- | --- | --- | --- |
| `UserId` | Single line of text | Yes | 利用者キー |
| `PlanningSheetId` | Single line of text | Yes | 親計画シートキー |
| `PeriodStart` | Date only | No | 観測期間開始 |
| `PeriodEnd` | Date only | No | 観測期間終了 |
| `SupportEvaluationsJson` | Multiple lines of text | No | JSON 配列文字列 |
| `EnvironmentFindingsJson` | Multiple lines of text | No | JSON 配列文字列 |
| `EffectiveSupports` | Multiple lines of text | No | |
| `DifficultiesObserved` | Multiple lines of text | No | |
| `NewTriggersJson` | Multiple lines of text | No | JSON 配列文字列 |
| `MedicalSafetyNotes` | Multiple lines of text | No | |
| `UserFeedback` | Multiple lines of text | No | |
| `FamilyFeedback` | Multiple lines of text | No | |
| `RecommendedChangesJson` | Multiple lines of text | No | JSON 配列文字列 |
| `Summary` | Multiple lines of text | No | |
| `RecordedBy` | Single line of text | No | |
| `RecordedAt` | Date and Time | No | 推奨 |

### 3.2 PlanningSheetReassessment_Master

| InternalName | 型 | 必須 | 備考 |
| --- | --- | --- | --- |
| `PlanningSheetId` | Single line of text | Yes | 親計画シートキー |
| `UserId` | Single line of text | No | |
| `ReassessmentTrigger` | Choice | No | 値は 4章参照 |
| `ReassessmentDate` | Date only | No | |
| `Summary` | Multiple lines of text | No | |
| `CreatedByText` | Single line of text | No | |
| `CreatedAtText` | **Date and Time** | No | **型固定（Textにしない）** |
| `VersionNo` | Number | No | |
| `PlanChangeDecision` | Choice | No | 値は 4章参照 |
| `AbcSummary` | Multiple lines of text | No | |
| `HypothesisReview` | Multiple lines of text | No | |
| `ProcedureEffectiveness` | Multiple lines of text | No | |
| `EnvironmentChange` | Multiple lines of text | No | |
| `NextReassessmentAt` | Date only | No | |
| `Notes` | Multiple lines of text | No | |
| `ReassessedBy` | Single line of text | No | |

## 4. Choice 値一覧

### 4.1 ReassessmentTrigger

- `scheduled`
- `incident`
- `monitoring`
- `other`

### 4.2 PlanChangeDecision

- `no_change`
- `minor_revision`
- `major_revision`
- `urgent_revision`

## 5. JSON 列の保存ルール

対象列:

- `SupportEvaluationsJson`
- `EnvironmentFindingsJson`
- `NewTriggersJson`
- `RecommendedChangesJson`

運用ルール:

- 空値は `[]` を保存する
- 配列データは JSON 文字列として保存する
- 自由文（改行付きテキスト）を JSON 列に入れない
- 不正 JSON は Repository 側で reject される（取得失敗の原因になる）

## 6. インデックス定義

`BehaviorMonitoringRecord_Master`

- `PlanningSheetId`（Indexed）
- `UserId`（Indexed）

`PlanningSheetReassessment_Master`

- `PlanningSheetId`（Indexed）

## 7. 初期投入データ例

### 7.1 BehaviorMonitoringRecord_Master（1件）

- `UserId`: `U-001`
- `PlanningSheetId`: `PS-001`
- `PeriodStart`: `2026-03-01`
- `PeriodEnd`: `2026-03-15`
- `SupportEvaluationsJson`: `[{"methodDescription":"声かけ","achievementLevel":"partial","comment":"午前は有効"}]`
- `EnvironmentFindingsJson`: `[{"adjustment":"席配置変更","wasEffective":true,"comment":"離席減少"}]`
- `NewTriggersJson`: `[]`
- `RecommendedChangesJson`: `["午後の声かけ頻度を増やす"]`
- `RecordedBy`: `staff-a`
- `RecordedAt`: `2026-03-16T09:00:00+09:00`

### 7.2 PlanningSheetReassessment_Master（1件）

- `PlanningSheetId`: `PS-001`
- `UserId`: `U-001`
- `ReassessmentTrigger`: `monitoring`
- `ReassessmentDate`: `2026-03-20`
- `Summary`: `手順効果を再評価`
- `CreatedByText`: `staff-b`
- `CreatedAtText`: `2026-03-20T10:30:00+09:00`
- `VersionNo`: `1`
- `PlanChangeDecision`: `minor_revision`
- `AbcSummary`: `ABC観点の要約`
- `HypothesisReview`: `仮説の再確認`
- `ProcedureEffectiveness`: `一部有効`
- `EnvironmentChange`: `環境調整あり`
- `NextReassessmentAt`: `2026-06-20`
- `Notes`: `次回まで観測継続`
- `ReassessedBy`: `staff-b`

## 8. 疎通確認手順

1. `BehaviorMonitoringRecord_Master` に 1 件投入する。
2. `PlanningSheetReassessment_Master` に 1 件投入する。
3. 対象利用者の `PDCAサイクル` タブを開く。
4. Check / Act が変化し、エラーなく表示されることを確認する。

## 9. 禁止事項

- ISP モニタリング用リスト（`MonitoringMeetings` 等）で代用しない
- 表示名だけ合わせて InternalName をずらさない
- JSON 列に自由文を入れない
- 既存の別リストを流用しない
- `usePdcaCycleState` に取得責務を追加しない

## 10. エラー時の症状

### 10.1 `BehaviorMonitoringRecord_Master` での典型症状

- 症状:
  - `PDCAサイクル` タブの Check 反映が進まない
  - バナーに `モニタリング長期未実施` / `モニタリング未実施` が継続して表示される
- 主な原因:
  - `PlanningSheetId` / `UserId` が対象と不一致
  - JSON 列が不正（配列でない、壊れた JSON）
  - InternalName のずれ
- 確認ポイント:
  - `PlanningSheetId` と `UserId` の一致
  - JSON 列が `[]` または正しい JSON 配列文字列

### 10.2 `PlanningSheetReassessment_Master` での典型症状

- 症状:
  - Act が未完了のまま変化しない
  - バナーに `再評価長期未実施` / `再評価未実施` が継続して表示される
- 主な原因:
  - `PlanningSheetId` 不一致
  - `CreatedAtText` を text 列で作成している
  - `PlanChangeDecision` / `ReassessmentTrigger` の値ずれ
- 確認ポイント:
  - `PlanningSheetId` の一致
  - `CreatedAtText` が Date and Time 型
  - Choice 値が 4章の定義に一致

### 10.3 InternalName ミス時の症状

- 症状:
  - 取得件数が 0 件扱いになる
  - 期待した値が常に空文字/空配列になる
- 主な原因:
  - 表示名のみ一致で InternalName が別名
- 対応:
  - 既存列を流用せず、InternalName 完全一致で再作成

## 11. よくあるミス

- 表示名だけ合わせて InternalName を確認しない
- JSON 列に箇条書きや自由文を直接入力する
- `CreatedAtText` を text 型で作成する
- `ReassessmentTrigger` / `PlanChangeDecision` に未定義値を入れる
- ISP 系リストを PDCA 用リストの代替に使う

## 12. PDCAタブ → Today導線の疎通確認

前提:

- `BehaviorMonitoringRecord_Master` と `PlanningSheetReassessment_Master` が作成済み
- 7章の初期データ例を投入済み

手順:

1. 対象利用者の `PDCAサイクル` タブを開く。
2. Check / Act の状態が投入データどおりに変化することを確認する。
3. 支援計画シート画面の Overview を開き、`次のアクション` バナーを確認する。
4. 以下の補助アラートが表示されることを確認する。
   - Check 状態: `モニタリング長期未実施` / `モニタリング未実施` / `モニタリング確認推奨`
   - Act 状態: `再評価長期未実施` / `再評価未実施` / `再評価確認推奨`
   - Health 低下: `支援状態が危険域` / `支援状態に注意` / `支援状態を確認`
5. 既存 CTA（主導線）が維持され、補助アラートが追記表示されることを確認する。

判定基準:

- 既存 CTA 文言と遷移先が変わっていない
- 補助アラートのみが追加されている
- 画面エラーが発生しない

## 13. 優先度判定表（PDCA alert）

| 条件 | 日数 / score | priority | 表示文言 | 推奨対応 |
| --- | --- | --- | --- | --- |
| Check 滞留 | 14日以上 | `p0` | モニタリング長期未実施 | 当日中にモニタリング確認 |
| Check 滞留 | 7〜13日 | `p1` | モニタリング未実施 | 近日中にモニタリング確認 |
| Check 滞留 | 0〜6日 | `p2` | モニタリング確認推奨 | 定例確認で対応 |
| Act 滞留 | 14日以上 | `p0` | 再評価長期未実施 | 当日中に再評価入力確認 |
| Act 滞留 | 7〜13日 | `p1` | 再評価未実施 | 近日中に再評価入力確認 |
| Act 滞留 | 0〜6日 | `p2` | 再評価確認推奨 | 定例確認で対応 |
| Health | `< 20` | `p0` | 支援状態が危険域 | 当日中にPDCA詳細確認 |
| Health | `< 40` | `p1` | 支援状態に注意 | 近日中にPDCA詳細確認 |
| Health | `< 60` | `p2` | 支援状態を確認 | 定例確認で対応 |

注記:

- healthScore は `0.0–1.0` / `0–100` の両形式を受け、内部で `0–100` に正規化して判定する。
- PDCA alert は補助レイヤーであり、既存 CTA を上書きしない。

## 14. 運用時の判定手順

1. Today もしくは支援計画シート Overview で PDCA alert の `priority` を確認する。
2. `p0` は当日中に対応し、対応後に PDCA タブで状態更新を再確認する。
3. `p1` は近日中（目安3営業日以内）に対応し、次回定例で残件を確認する。
4. `p2` は定例確認タスクとして処理し、他の高優先対応を妨げない。
5. いずれの priority でも、主導線は既存 CTA を使用し、alert は補助情報として扱う。
