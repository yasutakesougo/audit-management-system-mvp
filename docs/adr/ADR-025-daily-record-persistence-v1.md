# ADR-025: DAILY-RECORD-PERSISTENCE-V1

> **Status**: Accepted
> **Date**: 2026-08-27
> **ID**: DAILY-RECORD-PERSISTENCE-V1

---

## コンテキスト

日次記録の正本は `SupportRecord_Daily`（親）と `DailyRecordRows`（子）である。読込と Integrity Checker はすでに `LatestVersion` / `Version` を前提にしている一方、Saver は既存子行を DELETE してから POST し直し、Version を書いていなかった。

この DELETE → 再作成は、途中失敗で現行記録が部分欠損したり、DELETE 失敗を握りつぶすと重複行になったりする。本番記録として禁止する。

既存 `DailyRecordRows` の削除・移行・SharePoint スキーマ変更はこの ADR の対象外とする。Version 方式を実装したあとに移行規則を決める。

## 決定

```text
DAILY-RECORD-PERSISTENCE-V1

Status:
ACCEPTED

Canonical Parent:
SupportRecord_Daily

Canonical Record Store:
DailyRecordRows

Identity:
Parent = RecordDate
Child  = ParentID + UserID + Version
RowKey = RecordDate + UserID + RowNo

Write Rule:
APPEND NEW VERSION

Existing Child DELETE:
PROHIBITED during normal save

Commit Point:
SupportRecord_Daily.LatestVersion update

Read Rule:
Only LatestVersion children are current

Failed Version:
Must not become current

Integrity Failure:
HOLD / UNKNOWN
Never PASS by empty fallback
```

保存手順:

1. 親の `LatestVersion`（未設定は 0）を読む
2. `nextVersion = currentVersion + 1` を決める
3. `DailyRecordRows` に `Version = nextVersion` の子行を全件追加する（DELETE しない）
4. 全件保存を確認する
5. 親の `LatestVersion` を `nextVersion` に更新する（ここがコミット点）

途中失敗時は親 `LatestVersion` を動かさない。画面は旧 Version を読む。未完了の新 Version は Integrity Scanner が ghost / pending として検出する。

## 理由

SharePoint Lists にトランザクションがないため、削除して作り直すとコミット前に現行データが消える。追記してから親の Version ポインタだけ進める疑似コミットなら、失敗しても既存記録を失わない。

## Acceptance Criteria

- **AC-1** 既存 `DailyRecordRows` を通常保存で DELETE しない
- **AC-2** すべての新規子行に Version を保存する
- **AC-3** 全子行保存完了後だけ `LatestVersion` を更新する
- **AC-4** 子行途中失敗時に旧 `LatestVersion` を保持する
- **AC-5** 読込は `LatestVersion` のみを現行記録として扱う（0 のときはレガシー未バージョン行のみ）
- **AC-6** `UserCount` と現行 Version の子件数を照合する
- **AC-7** Integrity Scanner 失敗は UNKNOWN / HOLD にする。空配列フォールバックで PASS にしない
- **AC-8** 旧 Version は監査証跡として保持する

## 対象外

- 既存 `DailyRecordRows` の削除・バックフィル・Version 付与移行
- SharePoint リスト / 列の新規プロビジョニング
- 17行実施記録 (`SharePointExecutionRecordRepository`) の保存経路

## トレードオフ

- 更新のたびに子行が増える。旧 Version の整理は別途の監査・アーカイブ規則で行う。
- 同時保存が同じ `nextVersion` を採ると ghost 行になり得る。Integrity Scanner の `version_mismatch` で検出する。
