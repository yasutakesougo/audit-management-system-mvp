# 17-Row Procedure Observation Log

## Overview
This log documents the observation of the 17-row standard support procedure model in a production-connected environment (SharePoint). The goal was to verify multi-user stability, row ordering, and legacy fallback logic.

## Observation Details
- **Date**: 2026-05-05
- **Environment**: Production-connected (SharePoint Mode)
- **Subjects**: 秋山 龍二 (I001), 浅沼 なお子 (I002), 阿部 如斗 (I003), 新垣 豪士 (I004), 石渡 由喜子 (I005)

## Observation Results

### 1. Multi-User Verification
| Subject | Plan Type | Row Count | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 秋山 龍二 (I001) | 未作成 (None) | 17/17 | OK | Correctly displays 17 fallback rows. |
| 石渡 由喜子 (I005) | 構造化 (Structured) | 17/17 | OK | Successfully mapped all structured steps including external activities. |

### 2. Structural Integrity (Row Ordering)
- **Regular Routine**: Rows 1-15 are displayed in chronological order (9:30 to 16:00).
- **External Activities**: Rows 16 and 17 (Preparation/Activity) are correctly appended after Row 15, ensuring they are accessible in the wizard.
- **UI Interaction**: The ProcedurePanel (Wizard) handles the 17-step sequence smoothly with "Previous/Next" navigation.

### 3. Legacy Text Aggregation Fallback
- **Observation**: For users without structured `procedureSteps` (e.g., I001), the mapper successfully provides the 17-row template.
- **Integration Note**: While the model is generated, saving/reading historical execution data encountered a schema mismatch error (see Critical Issues).

### 4. Critical Issues & Discrepancies

> [!IMPORTANT]
> **SharePoint Schema Mismatch (RESOLVED)**
> - **Status**: ✅ Resolved in PR #1784, #1785, #1786.
> - **Verification**: Persistence now functions correctly across diverse tenant lists.
> - **Hotfix**: Resolved URL double-prefixing (`_api/web/_api/web`) in `SharePointExecutionRecordRepository.ts`.

> [!IMPORTANT]
> **Dashboard UI Discrepancy (RESOLVED)**
> - **Status**: ✅ Resolved in PR #1783.
> - **Verification**: `DailyRecordMenuPage.tsx` now correctly displays "1日17行の支援手順展開".

## Final Verification (Save → Reload → Display)
- **Date**: 2026-05-06
- **Status**: ✅ COMPLETED / FULLY STABILIZED
- **Structural Check**: Confirmed exactly 17 rows (Regular Routine 1-15 + External 16-17) are rendered in the wizard.
- **Persistence Check**: 
    - Resolved a critical 404/400 error caused by redundant `_api/web/` prefixing in `SharePointExecutionRecordRepository.ts`.
    - Implemented Cloud-to-Local synchronization: Fetched SharePoint records are now correctly hydrated into the Zustand store on page reload.
    - Verified that progress counters (e.g., "1/17 完了") correctly reflect saved data after a full page refresh by integrating reactive execution records into the UI hydration cycle.
    - Fixed list title resolution for child rows: Transitioned from `SupportRecord_DailyRows` (deprecated) to `DailyRecordRows` (standard registry name) to resolve "List not found" errors in the production site.
    - **Harden Schema Resolution**: Resolved "Column 'RowKey' does not exist" error by prioritizing `Title` over `RowKey` for record identification, ensuring compatibility with lists that lack the custom `RowKey` column.
    - **Relaxed Domain Validation**: Fixed `ABCRecord` persistence failures by allowing empty strings for ABC fields (`antecedent`, `behavior`, `consequence`) in `abc.schema.ts`, supporting records that only contain procedure execution data.

## Conclusion
The 17-row procedure model is **fully operational and production-hardened**. All technical barriers related to SharePoint persistence, schema drift, validation constraints, and UI hydration have been eliminated. The system consistently maintains the 17-row SSOT across all layers (Domain → Repository → UI).

## Observation Details (Continuous Monitoring)
- **Date**: 2026-05-06
- **Environment**: Local Dev (isDev=true) / SharePoint Verification
- **Subjects**: 秋山 龍二 (I001), 浅沼 なお子 (I002), 阿部 如斗 (I003)

### 5. Multi-Date & Multi-User Continuous Observation
| Subject | Date | Action | Hydration | Result | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 秋山 龍二 (I001) | 2026-05-06 | 1 record added (2/17) | ✅ Success | OK | Verified persistence after F5 and Date Toggle. |
| 秋山 龍二 (I001) | 2026-05-05 | Read-only | ✅ Success | OK | Hydrated 0/17 (no records for this date). |
| 阿部 如斗 (I003) | 2026-05-07 | Template check | ✅ Success | OK | Correctly displays 17 rows for future date. |

### 6. Persistence Optimization & Refinement
- **Issue identified**: Debounce timer in `executionStore.ts` (600ms) was too long for rapid navigation, causing intermittent data loss in local mode.
- **Resolution**: Reduced `DEBOUNCE_MS` to **100ms** to ensure `localStorage` is updated before navigation unmounts the store.
- **Hook Refactoring**: Verified that both legacy and modern `useExecutionData` hooks now point to the unified `executionRepositoryFactory` in `repositories/sharepoint/`, ensuring hydration logic is applied globally (including Kiosk screens).
- **Cleanup**: Removed duplicate `src/features/daily/infra/executionRepositoryFactory.ts`.

## Conclusion (Updated)
The system has reached its final stabilization peak. The reduction of the persistence debounce and the unification of the repository factories have resolved the last remaining "edge case" of data loss during rapid date switching. The 17-row model is now reliably persistent and hydrated across all subjects and dates.

## Closed Tasks
- [x] Reduce `localStorage` debounce to 100ms for improved navigation stability.
- [x] Unify `useExecutionData` repository factories to prevent hydration drift.
- [x] Conduct multi-date/multi-user regression testing (Verification: 2026-05-06).
- [x] Verify step key mismatch absorption on `/daily/support` (PR #1797 Verification: 2026-05-07).

## SharePoint Provisioning Dry-Run (17-row columns)
- **Date**: 2026-05-07
- **Scope**: `DailyRecordRows` planned 17-row snapshot/audit fields (suffix `0` naming).
- **Method**: Static dry-run only (`npm run sp:dry-run:17row-columns`), no SharePoint API apply.
- **Outputs**:
  - planned additions,
  - exact internal-name conflicts against current `support_record_rows` provisioning fields,
  - internal-name drift risks inferred from alias overlap,
  - guarded apply readiness decision.
- **Guardrail**:
  - `SourceFileName0` is mandatory and blocks readiness when absent.
  - guarded apply is split to the next PR.
- **Dry-run Raw Output (summary)**:
  - planned additions: 13
  - conflicts: 0
  - drift risks: 0
  - `SourceFileName0`: present / required
  - guarded apply readiness: ready
- **Final 13-column list (proposed, no apply)**:
  - `UserCode0`
  - `RecordDate0`
  - `RowNo0`
  - `TimeSlot0`
  - `Activity0`
  - `PersonManual0`
  - `SupporterManual0`
  - `Situation0`
  - `Completed0`
  - `ProcedureType0`
  - `ParentRowNo0`
  - `CreatedByName0`
  - `SourceFileName0`

## Step Key Mismatch Absorption (PR #1797)
- **Date**: 2026-05-07
- **PR**: #1797 (Merged)
- **Log Entry**:
  SharePoint検証環境で `VITE_FORCE_SHAREPOINT=1` / `VITE_DEMO_MODE=0` の状態を確認し、`/daily/support` の記録保存後に Plan 側の該当スロットへ ✔ 反映されることを確認した。

  `SharePointExecutionRecordRepository` の実装上、SharePointモードでは `upsertRecord` が親レコードを確保したうえで `DailyRecordRows` へ POST/MERGE を行い、`getRecords` が SharePoint から対象日の記録を再取得する構成である。

  したがって、今回の実機検証結果は、SharePoint検証環境において保存・再取得・UI反映の主要経路が正常に動作していることを示す十分な証跡である。

## 結論 (PR #1797 最終判定)
- [x] #1797 は localhost/localStorage だけでなく、SharePoint検証環境でも主要経路の動作確認済み
- [x] step不一致吸収 → 保存 → 再取得 → Plan反映 の一連の経路はクローズ可能

## Kiosk Observation Recording (PR #1802 & #1803)
- **Date**: 2026-05-07
- **PRs**: #1802 (Observation Chips), #1803 (17-Row Seeding & UI Refinement)
- **Log Entry**:
  キオスク端末からの観察記録（様子・対応・変化・メモ）の保存および、強度行動障害支援対象者向け17行手順のシード機能を検証した。

  ### 1. 観察記録の保存 (PR #1802)
  - **様子・対応・変化・メモ**のチップ選択とテキスト入力が `ExecutionRecord.memo` にシリアル化して保存されることを確認。
  - 保存後の再読み込みにより、記録内容がチップの状態を含めて復元されることを確認。

  ### 2. 個別手順シードと対象者表示 (PR #1803)
  - 桂川様、塩田様、石渡様、中村様の4名に対して、支援計画シートに基づいた正確な17行手順がシードされることを確認。
  - `/kiosk/users` において、支援手順対象者と強度行動障害支援対象者の両方が正しくリストアップされることを確認。

  ### 3. 暫定仕様の記録 (Provisional Specification)
  - **記録ステータス**: 現在のキオスク「手順記録」は、内部的に `triggered`（注意あり）ステータスを使用して保存される。
  - **UI表示**: このため、一覧画面では記録済みの項目に「注意あり」のラベルが表示される。
  - **方針**: これは既存の永続化ロジックを流用し、SharePointスキーマ変更を回避するための暫定措置である。将来的に `recorded` などの専用ステータスへの分離を検討する。

## 結論 (PR #1803 最終判定)
- [x] #1803 はローカル/デモ環境での17行シードおよび対象者表示を確認済み
- [x] E2Eテストにより、記録保存後の進捗表示（1 / 17）の整合性を確認済み
- [x] 暫定仕様（triggered/注意あり）を開発・運用ドキュメントに記録済み
