# ABC Record Boundary

## Purpose

このプロダクトには「ABC記録」が2系統ある。名称が同じでも、型・保存先・Repository・用途が異なるため、デバッグ時は最初に対象系統を固定する。

## A. Dedicated ABC Record (/abc-record)

- Domain: `src/domain/abc/abcRecord.ts` (`AbcRecord`)
- Route/Page: `/abc-record` → `src/pages/abc-record/AbcRecordPage.tsx`
- Repository selector: `src/infra/abc/useAbcRecordRepository.ts`
- SharePoint Repository: `src/infra/sharepoint/repos/SharePointAbcRecordRepository.ts`
- SharePoint List: `AbcBehaviorRecords`
- Local fallback: `src/infra/localStorage/localAbcRecordRepository.ts`
- Primary use: Iceberg PDCA / EvidenceLink / planning sheet evidence

### Notes

- `IsDeleted` を使ったソフトデリート運用。
- `sourceContext`（`daily-support` など）を保持。

## B. Daily Behavior Record (daily support flow)

- Domain: `src/domain/behavior/abc.ts` (`ABCRecord`)
- Store: `src/features/daily/stores/behaviorStore.ts`
- Repository Port: `src/features/daily/domain/BehaviorRepository.ts`
- SharePoint Repository: `src/features/daily/repositories/sharepoint/SharePointBehaviorRepository.ts`
- SharePoint List: `DailyActivityRecords`
- Primary use: daily activity / behavior observations in daily support

### Notes

- Daily系の行動観察用途。Dedicated ABC と同一エンティティ前提で扱わない。

## Debug Rule

ABC関連不具合を調査する場合、最初に次を固定する。

1. Source route/screen (`/abc-record` か daily画面か)
2. Domain type (`AbcRecord` か `ABCRecord` か)
3. Repository class
4. SharePoint list (`AbcBehaviorRecords` か `DailyActivityRecords` か)

## Source of Truth

- `/abc-record` の正本は `AbcBehaviorRecords`
- daily support flow の正本は `DailyActivityRecords`
- 片方の保存成功を、もう片方の保存成功とはみなさない
- 片方の一覧表示不具合を、もう片方の Repository で調査しない

## Current Policy

- Dedicated ABC と Daily Behavior は、現時点では別系統として並存。
- 相互変換・自動同期を前提にしない。
- 連携仕様を追加する場合は、ID対応（`userId/date/slotId/sourceContext`）を先に設計してから実装する。

## Future Integration Rule

Dedicated ABC と Daily Behavior を連携する場合は、直接同一テーブル化しない。

まず以下を明示する。

- どちらが作成元か
- どちらが参照先か
- 重複作成を許容するか
- `userId`
- `date`
- `slotId`
- `sourceContext`
- stable ID
- soft delete 時の参照表示ルール
