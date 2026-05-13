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

## 1-Minute Triage Checklist

### 1) どの画面で起きているか

| 画面 | 系統 |
| --- | --- |
| `/abc-record` | Dedicated ABC |
| `/daily/support`、日次支援記録内の行動観察 | Daily Behavior |
| キオスク → `/abc-record` deep link | Dedicated ABC |
| キオスク内の daily support flow 由来の行動観察 | Daily Behavior |

### 2) 型名を見る

| 型 | 系統 |
| --- | --- |
| `AbcRecord` | Dedicated ABC |
| `ABCRecord` | Daily Behavior |

### 3) Repository を見る

| Repository | 保存先 |
| --- | --- |
| `SharePointAbcRecordRepository.ts` | `AbcBehaviorRecords` |
| `SharePointBehaviorRepository.ts` | `DailyActivityRecords` |

### 4) SharePoint List を見る

| リスト | 意味 |
| --- | --- |
| `AbcBehaviorRecords` | 専用ABC記録 |
| `DailyActivityRecords` | 日次支援フロー内の行動記録 |

## Decision Rules

- `/abc-record` の不具合なら、まず `AbcBehaviorRecords` と `SharePointAbcRecordRepository` を見る。
- `/daily/support` 内の行動観察不具合なら、まず `DailyActivityRecords` と `SharePointBehaviorRepository` を見る。
- キオスク由来の場合は、入口が `/abc-record` deep link か、daily support flow 内の行動記録かを先に確認する。
- キオスクから `/abc-record` へ遷移して作成した記録は、Phase 1 では Dedicated ABC として扱い、`AbcBehaviorRecords` と `SharePointAbcRecordRepository` を見る。
- 「ABC記録が保存されない」と言われても、どちらのABCかを先に確定する。
- `AbcBehaviorRecords` にあるのに daily 側に出ない、またはその逆は、現行設計では即バグとは限らない。
- 連携が必要な場合は「同期漏れ」ではなく、Dedicated ABC と Daily Behavior の bridge 要件として扱う。

## Debug Intake Template

```txt
対象画面:
対象型:
対象Repository:
対象SharePoint List:
期待される表示/保存先:
実際の保存先:
```

## Kiosk Integration Plan

### Phase 1: Deep Link Only

Kiosk からの ABC 記録連携は、まず Dedicated ABC (`/abc-record`) への遷移連携のみを対象とする。

保存先は `AbcBehaviorRecords` とし、`DailyActivityRecords` への自動二重保存は行わない。

### Deep Link Contract

Kiosk から `/abc-record` へ遷移する際は、以下の query を渡す。

- `userId`
- `source=daily-support`
- `date`
- `slotId`
- `returnUrl`

`slotId` は既存 daily 規約と同じ `time|activity` 形式を使用する。

### Deep Link Encoding Rules

- `returnUrl` は必ず URL encode する。
- `slotId` に `|` を含めるため、query string では URL encode された値を許容する。
- `date` は `YYYY-MM-DD` 形式に統一する。
- `/abc-record` 側は未知の query を無視し、既存 standalone 利用を壊さない。

### UI Entry Points

- `/kiosk/users/:userId/procedures`
  - ユーザー単位の「ABC記録」CTA
- 手順詳細画面
  - スロット単位の「この手順でABC記録」CTA

### Source Context Policy

現行の `sourceContext.source` は `daily-support` を流用する。

将来 `kiosk-support` を追加する場合は、型拡張、既存データ互換、読み取り側の扱いを先に定義する。

### Read Policy

Kiosk から作成された ABC 記録は Dedicated ABC の証跡として扱う。

そのため、`AbcBehaviorRecords` に保存された記録が `DailyActivityRecords` 側の一覧や daily 観察一覧に即時表示されなくても、Phase 1 では仕様内とする。

### Phase 2: Bridge Design

Daily 側への反映が必要になった場合のみ bridge を設計する。

検討項目:

- `userId`
- `date`
- `slotId`
- `sourceContext`
- stable ID
- soft delete 参照ルール
- 重複防止キー
- 同期方向

方式候補:

- 明示的コピー
- 非同期ジョブ同期

同期方向は実装前に必ず 1 つに固定する。

## Entry Consolidation Rule

Kiosk からの ABC 記録入口は、利用者手順単位で管理する。

### Primary Entry

主入口は、手順詳細画面の「この手順でABC記録」とする。

この導線を正規導線とし、必ず `userId`, `date`, `slotId`, `source`, `returnUrl` を渡す。

### Secondary Entry

一覧画面の ABC 記録 CTA は補助導線とする。

一覧側では、単なる「ABC記録」ではなく「手順を選んでABC記録」と表記し、手順選択後に `slotId` を確定してから `/abc-record` へ遷移する。

### Standalone Entry

`/abc-record` への直アクセスは standalone 導線として扱う。

手順に紐づかない ABC 記録は、手順起点記録とは区別し、UI 上も standalone と分かる表示にする。

### Management Key

Kiosk 起点の ABC 記録は、以下を管理キーとして扱う。

- `userId`
- `date`
- `slotId`
- `sourceContext`

表示・監査の並びは、原則として次の順に固定する。

```txt
利用者 > 日付 > 手順(slot)
```

### Review Rule

- Kiosk 起点の ABC 記録導線では、`slotId` なしの deep link を追加しない。
- Kiosk 起点記録は Phase 1 では Dedicated ABC として扱う。
- 保存先は `AbcBehaviorRecords` とする。
- `DailyActivityRecords` への同期・二重保存は行わない。
- Daily 側の観察一覧に即時表示されることを期待しない。
