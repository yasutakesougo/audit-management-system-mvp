# Kiosk Toilet Correction Test Coverage

最終更新: 2026-06-13

## 目的

このドキュメントは、キオスク・トイレ記録の訂正機能について、現時点でテストにより固定済みの安全境界を整理する。

対象はテストカバレッジの記録のみで、runtime behavior、UI implementation、routing、SharePoint list definition、schema candidate、env file は変更しない。

関連ドキュメント:

- `docs/kiosk-toilet-correction-policy.md`
- `docs/architecture/kiosk-toilet-daily-board-architecture.md`

## 固定済み PR

| PR | Scope | Test file |
|---|---|---|
| `#2259` `test(kiosk-toilet): lock record correction repository behavior` | repository/update boundary | `src/features/kiosk/toilet/__tests__/toiletRecordRepository.spec.ts` |
| `#2260` `test(kiosk-toilet): cover correction dialog expectations` | correction dialog cancel boundary | `src/features/kiosk/toilet/__tests__/ToiletDailyBoard.spec.tsx` |
| `#2261` `test(kiosk-toilet): cover correction UI state boundaries` | save-in-flight UI boundary | `src/features/kiosk/toilet/__tests__/ToiletDailyBoard.spec.tsx` |

## Repository Boundary

Repository 層では、訂正を「既存 record の一部フィールド更新」として固定している。

固定済みの期待:

- 既存 record は `id` で lookup して更新する。
- `id`、`userId`、`recordDate`、`occurredAt`、`createdAt`、`recorderName`、`source`、`isDeleted` は訂正で上書きしない。
- 訂正で更新できる mutable fields は `toiletType`、`amount`、`memo` に限定する。
- local repository で missing id を訂正しようとした場合は reject する。
- missing id の reject 後も既存 records は変更しない。
- SharePoint adapter で lookup miss した場合は reject する。
- SharePoint adapter は lookup miss 時に `MERGE` を発行しない。

対象テスト:

- `LocalStorageToiletRecordRepository` correction tests
- `SharePointToiletRecordRepository` correction tests

## Dialog Cancel Boundary

訂正ダイアログでは、キャンセル操作を「保存ではない UI close」として固定している。

固定済みの期待:

- 既存 record の訂正ボタンから訂正ダイアログを開ける。
- 利用者、記録日、記録日時は readonly 表示にする。
- キャンセルを押すと訂正ダイアログを閉じる。
- キャンセル時に `correct` action を呼ばない。

対象テスト:

- `ToiletDailyBoard` correction dialog tests

## Save-In-Flight UI Boundary

訂正保存中は、二重操作と途中キャンセルを防ぐ UI state として固定している。

固定済みの期待:

- 訂正保存を開始すると保存ボタン表示は `保存中...` になる。
- 訂正保存中は保存ボタンを disabled にする。
- 訂正保存中はキャンセルボタンも disabled にする。
- pending correction が resolve した後、訂正ダイアログを閉じる。

対象テスト:

- `ToiletDailyBoard` save-in-flight correction tests

## Error Boundary

訂正保存失敗時は、ダイアログを閉じず、ユーザーが同じ context で失敗を確認できる状態として固定している。

固定済みの期待:

- `correct` action が reject した場合、訂正ダイアログ内にエラーを表示する。
- 訂正保存失敗時、訂正ダイアログは開いたままにする。

対象テスト:

- `ToiletDailyBoard` correction error tests

## 現在の Out of Scope

次は今回の固定範囲外とする。

- Correction reason の入力
- Correction history / before-after audit log
- SharePoint list field の追加
- SharePoint schema candidate の変更
- delete / mistaken-entry workflow
- routing の変更
- kiosk UI implementation の変更
- Record Quality 連携
- `docs/roadmaps/` 配下の未追跡 roadmap

## 次の候補

次に追加する場合は、実装変更より先に小さな test-only PR として次を検討する。

- `test(kiosk-toilet): cover correction error UI boundary`
- `test(kiosk-toilet): cover correction success refresh behavior`

ただし、現時点で訂正機能の中核安全境界は repository、dialog cancel、save-in-flight UI の 3 層で固定済みである。
