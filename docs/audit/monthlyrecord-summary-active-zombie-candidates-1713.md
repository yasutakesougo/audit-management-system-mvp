# #1713 MonthlyRecord_Summary active zombie 候補監査（PR1: docs only）

- Scope: `MonthlyRecord_Summary` の `zombie_candidate` と `active_usage_in_code` 表示項目の監査
- Goal: 削除ではなく、source of truth 確認・コード参照監査・移行計画の文書化
- Date: 2026-04-29
- Change policy: **破壊的変更なし**（docs のみ）

## 1. Source of Truth（現時点）

`MonthlyRecord_Summary` の列定義は、以下を SoT として扱う。

1. Registry SoT: `src/sharepoint/spListRegistry.definitions.ts` (`key: billing_summary`)
2. Runtime Resolve SoT: `src/sharepoint/fields/billingFields.ts` (`BILLING_SUMMARY_CANDIDATES`)
3. Read/Write Runtime Path: `src/features/records/monthly/map.ts`

補足:
- Registry 側の `essentialFields` は `['UserId', 'YearMonth', 'KPI_TotalDays']`
- Runtime は `resolveInternalNamesDetailed` により候補列から実列を解決し、`toSharePointFields` / `fromSharePointFields` / `upsertMonthlySummary` で使用

## 2. コード参照監査（実使用）

`src/features/records/monthly/map.ts` で明示的に参照される実務列（fallback 含む）は以下。

- Key系: `UserCode`/`UserId`, `YearMonth`, `IdempotencyKey`
- 表示/更新: `DisplayName`, `LastUpdated`
- KPI系: `KPI_TotalDays`, `KPI_PlannedRows`, `KPI_CompletedRows`, `KPI_InProgressRows`, `KPI_EmptyRows`, `KPI_SpecialNotes`, `KPI_Incidents`
- 補助日付: `FirstEntryDate`, `LastEntryDate`
- 率: `CompletionRate`

結論:
- 実装上の active は「業務列 + 互換候補列」であり、`drift-ledger` 上の `active_usage_in_code` が必ずしも「その物理列が必須」を意味しない。
- 候補配列に含まれる別名（例: `CompletedCount`）は、現行物理列としての採用ではなく、ドリフト吸収のための互換入力として扱う。

## 3. `drift-ledger` での active zombie 候補の分類

参照: `docs/nightly-patrol/drift-ledger.md`（`MonthlyRecord_Summary` 行）

### A. keep-warn（no_data_no_usage）

- `WorkingDays`
- `CompletedCount`
- `PendingCount`
- `EmptyCount`
- `IncidentCount`
- `SpecialNoteCount`
- `Last_x0020_Updated`

判断:
- 現時点では削除判断をしない。
- 「現行データ無し + 実使用無し」のため、監視対象として keep-warn 維持。

### B. candidate（active_usage_in_code）

- 代表: `KPI_TotalDays`, `Total_x0020_Days`, `Key`, `SelectTitle`, `Last_x0020_Modified`, `Created_x0020_Date`, `FSObjType`, `ProgId`, `LinkFilename`, `ServerUrl`, `EncodedAbsUrl`, `BaseName` など

判断:
- 一部は実際に Runtime/Fallback 候補として利用される（例: `KPI_TotalDays`, `Total_x0020_Days`）。
- 一方で `Key` や SharePoint 標準メタ列群（`FSObjType` 等）は、汎用走査・標準応答由来の誤検知が混在している可能性が高い。
- 次フェーズで「業務列参照」と「標準メタ列参照」を台帳上で分離する必要あり。

### C. provision（data_exists_no_usage）

- `LinkTitle2`, `LinkFilename2`, `PermMask`, `PrincipalCount`

判断:
- SharePoint 管理メタ列寄り。業務 SoT と分離して扱う。

## 4. 移行計画（docs化、非破壊）

### Phase 1（この PR）

- SoT と実コード参照を固定化（本ドキュメント）
- 「削除はしない」前提を明文化

### Phase 2（次PR候補）

- `drift-ledger` 集計ロジック改善案を docs 化
- `active_usage_in_code` の判定を次の 2 系統に分離
  - `business_field_usage`
  - `sharepoint_meta_usage`

### Phase 3（次々PR候補）

- `billing_summary` に関する zombie 判定ルールを明示（allowlist / denylist）
- `keep-warn` の再評価条件（N日連続 no_data_no_usage など）を運用ルール化

## 5. Decision Log

- 2026-04-29: PR1 は docs のみ。コード変更・列削除・プロビジョニング変更は実施しない。
- 2026-04-29: `MonthlyRecord_Summary` の SoT は `spListRegistry.definitions.ts` + `billingFields.ts` + `map.ts` の三点セットで扱う。
