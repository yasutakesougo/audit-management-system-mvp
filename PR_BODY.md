# PR: Hardening Users Domain SharePoint Drift Resilience

## Summary
`fix(users): unify SharePoint drift resolution across persistence and diagnostics, including suffixed physical field names`

## Overview
This change hardens the Users domain against SharePoint schema drift by unifying candidate resolution across write paths, split-list persistence, and drift diagnostics, including suffixed physical field names such as `*0`.

## Key Changes
1.  **Unified SSOT Candidates (`userFields.ts`)**:
    *   Consolidated field candidates for `Users_Master`, `UserBenefit_Profile`, and `UserTransport_Settings` into a single source of truth.
    *   Added support for suffixed field names (e.g., `IsHighIntensitySupportTarget0`, `UsageStatus0`) to handle common SharePoint field recreation drift.
2.  **Write-Path Hardening (`DataProviderUserRepository.ts`)**:
    *   Ensured all write operations (including split-list accessory updates) use the same SSOT candidate definitions as the read and diagnostic paths.
    *   Eliminated "silent drop" issues where data was read correctly but failed to persist due to naming mismatches.
3.  **Diagnostic Infrastructure Hardening (`SharePointDriftEventRepository.ts`)**:
    *   Implemented drift-resilient field resolution for the `DriftEventsLog` list itself (e.g., handling `ListName` vs `NameOfList`).
    *   Applied "Fail-Open" patterns to ensure diagnostic logging does not block core business persistence.
4.  **Regression Testing**:
    *   Added `src/sharepoint/fields/__tests__/userFields.ssot.drift.spec.ts` to lock in the contract for drift resolution.

## Impact
This PR resolves persistent "data reversion" bugs and "silent save failures" in drifted SharePoint environments. By aligning the read, write, and diagnostic logic under a single candidate definition, the system becomes significantly more robust against physical schema variations.

## Verification
*   **Browser-Based Verification**: Confirmed persistence of `UsageStatus`, `IsHighIntensitySupportTarget`, and `DisabilitySupportLevel` in drifted environments.
*   **Unit Tests**: All 5 new regression tests and existing integration tests passed.
- `HANDOFF.md`: 完了済みの横展開リストおよび運用引き継ぎ情報の更新
- 既存テストの修正: 型定義の厳格化に伴う期待値の調整 (`billingFields`, `surveyTokuseiFields`, `usersMasterFields`)

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------| 
| `src/sharepoint/fields/meetingMinutesFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/handoffFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/nurseObservationFields.ts` | 変更 | CANDIDATES/ESSENTIALS 定義の追加 |
| `src/sharepoint/fields/meetingSessionFields.ts` | 追加 | CANDIDATES/ESSENTIALS 新規定義 |
| `src/pages/HealthPage.tsx` | 変更 | 診断レジストリへの追加、型キャストの修正 |
| `src/sharepoint/fields/__tests__/*.drift.spec.ts` | 追加/修正 | 計18ファイル・145件のドリフト検証テスト |

## テスト
- [x] 既存テスト通過: `npx vitest run src/sharepoint/fields/__tests__/*.drift.spec.ts` (145/145 pass)
- [x] 型チェック通過: `tsc --noEmit`
- [x] 新規テスト追加: 各追加ドメインに対して、正常解決・ドリフト解決・必須項目バリデーションを網羅

**テスト統計:**
- **今回追加したテスト数**: 29件
- **全体のドリフトテスト総数**: 145件 (すべて Green)

## 影響範囲と運用ステータス
- **診断ダッシュボード**: `/admin/status` で主要リストすべての整合性が可視化されます。
- **残 FAIL の整理**: 現在の FAIL は SharePoint 側の環境・権限（列不足、アクセス拒否）に起因するもののみで、**今回の対象範囲におけるコード起因の誤 FAIL・固定内部名依存は解消済み** です。

## 補足
今回の変更により、SharePoint の内部名ドリフトが発生しても、
- 物理名の揺れは `CANDIDATES` で吸収
- 必須欠落のみ `FAIL`
- 代替名解決は `WARN`
- 管理者対応は `/admin/status` と runbook で案内
という運用契約が主要リスト全体で一貫しました。
