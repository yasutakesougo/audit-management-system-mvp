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

---

## 3. アクションプラン (Action Plan)

1.  [x] **Phase 1: Builders 拡張** (Done)
2.  [x] **Phase 2: 主要機能の移行** (Done)
    - [x] Today Flow / Active Repository 関連の主要 5 ファイルを移行完了。
3.  [ ] **Phase 3: 残存ターゲットの系統的スキャンと移行** (Next)
    - [ ] `src/features/daily/infra/DataProviderDailyRecordRepository.ts`
    - [ ] `src/features/users/infra/DataProviderUserRepository.ts`
    - [ ] `src/infra/sharepoint/repos/schedulesRepo.ts`
    - [ ] `src/features/meeting-minutes/infra/DataProviderMeetingMinutesRepository.ts`
    - [ ] その他 grep で検出された 20+ ファイル
4.  [ ] **Phase 4: 禁止事項の自動化 (Lint/Rule)**
    - `no-restricted-syntax` を使って、テンプレートリテラルによる OData フラグメント構築を検知・警告する。
