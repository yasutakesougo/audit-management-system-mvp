# OData Query Builder Migration: Next Steps

PR #1351 で導入された `src/sharepoint/query/builders.ts` をベースに、残る手動 OData クエリを排除する計画です。

## 1. 残件スキャン結果 (Remaining Targets)

以下のファイルに手動の `$filter` 文字列組み立てが残存しています。

### 高優先 (Active Production) - COMPLETED
* [x] **`src/features/today/transport/transportRepo.ts`** (Completed)
* [x] **`src/features/handoff/useCreateHandoffFromExternalSource.ts`** (Completed)
* [x] **`src/features/records/monthly/map.ts`** (Completed)
* [x] **`src/features/attendance/infra/DataProviderAttendanceRepository.ts`** (Completed)
* [x] **`src/features/meeting/api/meetingSessionApi.ts`** (Completed)

---

## 2. Builder の拡張要件 (Builder Extensions) — COMPLETED

`builders.ts` に以下の関数を追加済みです（ユニットテスト通過）。

*   [x] `buildSubstringOf(field, value)`
*   [x] `buildStartsWith(field, value)`
*   [x] `buildDateTime(isoString)`
*   [x] `joinOr(filters)`

---

## 3. アクションプラン (Action Plan)

1.  [x] **Phase 1: Builders 拡張** (Done)
2.  [x] **Phase 2: 主要機能の移行** (Done)
3.  [x] **Phase 3: 残存ターゲットの系統的スキャンと移行** (Done)
    - [x] 主要な全 Repository / API モジュールの移行完了。
    - [x] `handoffCommentApi`, `handoffAuditApi`, `DataProviderCallLogRepository`, `sharePointAdapter` 等の移行も完了。
4.  [x] **Phase 4: 禁止事項の自動化 (Lint/Rule)** (Done)
    - `.eslintrc.cjs` に `no-restricted-syntax` を追加し、OData の手動構築を禁止。
    - ユニットテスト、シミュレーション、builders 自身を除外設定。
