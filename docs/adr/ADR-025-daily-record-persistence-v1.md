# ADR-025: DAILY-RECORD-PERSISTENCE-V1

> **Status**: Accepted
> **Date**: 2026-08-27
> **ID**: DAILY-RECORD-PERSISTENCE-V1

---

## コンテキスト

日次記録の正本は `SupportRecord_Daily`（親）と `DailyRecordRows`（子）である。読込と Integrity Checker はすでに `LatestVersion` / `Version` を前提にしている一方、Saver は既存子行を DELETE してから POST し直し、Version を書いていなかった。

この DELETE → 再作成は、途中失敗で現行記録が部分欠損したり、DELETE 失敗を握りつぶすと重複行になったりする。本番記録として禁止する。

さらに、`nextVersion = LatestVersion + 1` だけで子を識別すると、失敗保存の ghost row や同時保存の losing Commit が同一 Version に混入し、現行 hydrate を汚染し得る。そのため Version に加えて **CommitId（1回の保存試行 identity）** を導入する。

既存 `DailyRecordRows` の削除・移行・SharePoint スキーマ変更はこの ADR の対象外とする。フィールド実体のプロビジョニングは別 Gate とする。

## 決定

```text
DAILY-RECORD-PERSISTENCE-V1

Status:
ACCEPTED

Canonical Parent:
SupportRecord_Daily

Canonical Record Store:
DailyRecordRows

Current identity:
ParentID + LatestVersion + LatestCommitId

Child commit identity:
ParentID + Version + CommitId

Version:
logical revision number

CommitId:
single save-attempt identity

Version alone is not a commit identity.

Identity (legacy row key):
Parent = RecordDate
Child  = ParentID + UserID + Version (+ CommitId for versioned saves)
RowKey = RecordDate + UserID + RowNo

Write Rule:
APPEND NEW VERSION

Existing Child DELETE:
PROHIBITED during normal save

Commit Point:
SupportRecord_Daily.LatestVersion + LatestCommitId update (together)

Read Rule:
Only LatestVersion + LatestCommitId children are current

Failed / losing CommitId:
Must not become current (may remain as non-current ghost)

Integrity Failure:
HOLD / UNKNOWN
Never PASS by empty fallback
```

保存手順:

1. 親を日付で lookup する（`Id` / `LatestVersion` / `LatestCommitId` / ETag）
2. lookup が不確実な場合は save を abort し、Parent/Child を一切書かない  
   - network failure → abort（Parent POST=0, Child POST=0）  
   - HTTP 403/500 → abort（mutation なし）  
   - `LatestCommitId` 欠落相当の lookup failure（例: $select HTTP 400）→ abort（新 Parent を作らない）  
   - HTTP 200 + `value=[]` のときだけ「親なし」とみなし、新 Parent 作成を許可する
3. 既存親がある場合: `nextVersion = LatestVersion + 1`
4. 保存開始ごとに一意の `CommitId` を生成する
5. `DailyRecordRows` に `Version = nextVersion` かつ `CommitId = current CommitId` の子行を全件追加する（DELETE しない）
6. 全子行 POST 成功後だけ、親を IF-MATCH 付きで更新する
7. 親へ `LatestVersion = nextVersion` と `LatestCommitId = CommitId` を同時 commit する
8. 親 commit 失敗時も child を DELETE しない
9. losing / failed CommitId rows は ghost として残してよいが current にはしない

途中失敗時は親の `LatestVersion` / `LatestCommitId` を動かさない。画面は旧 current identity を読む。

**Parent lookup fail-closed:** lookup 失敗を「親なし」と誤認して新規 Parent を作成してはならない。新規作成は HTTP 200 + 空結果のときだけ許可する。

**Parent uniqueness / create-race:** 同一日付 Title の `SupportRecord_Daily` は高々1件。新規 Parent POST の直後に必ず再 lookup し、作成した Id が唯一の親であることを確認してから子行を書く。競合で複数親が観測された場合は child を書かずに abort する（losing Parent は DELETE しない）。`load` / `list` も同一日付の親複数を検知したら fail closed する。

## 読込規則

- `load(date)` と `list(range)` の両方で、`LatestVersion > 0` の親は  
  `ParentID = parent AND Version = LatestVersion AND CommitId = LatestCommitId`  
  の `DailyRecordRows` だけを現行として hydrate する。
- `LatestVersion > 0` なのに `LatestCommitId` が欠落している場合、Version 単独で current 判定してはならない。整合性異常として失敗/HOLDにする。
- `LatestVersion = 0` の親は未バージョン行（`Version = 0 / null`）だけを対象とする。CommitId は要求しない（ADR-025 legacy 互換）。
- `LatestVersion = 0` かつ未バージョン子行が存在しない場合に限り、旧 `UserRowsJSON` をレガシー互換として利用できる。
- `LatestVersion > 0` なのに対応する current children（Version + CommitId）が0件の場合、旧 `UserRowsJSON` へフォールバックしてはならない。

## 理由

SharePoint Lists にトランザクションがないため、削除して作り直すとコミット前に現行データが消える。追記してから親の Version+CommitId ポインタだけ進める疑似コミットなら、失敗しても既存記録を失わない。

Version だけでは失敗再試行や同時保存で同じ番号が再利用され、ghost / losing rows が現行へ混入する。CommitId を current identity に含めることで、Integrity Scanner の事後検出だけに頼らず読込経路で混入を防ぐ。

## Acceptance Criteria

- **AC-1** 既存 `DailyRecordRows` を通常保存で DELETE しない
- **AC-2** すべての新規子行に Version を保存する
- **AC-3** 全子行保存完了後だけ `LatestVersion`（および `LatestCommitId`）を更新する
- **AC-4** 子行途中失敗時に旧 `LatestVersion` / `LatestCommitId` を保持する
- **AC-5** `load(date)` / `list(range)` とも `LatestVersion + LatestCommitId` のみを現行記録として扱う。0 のときはレガシー未バージョン行のみとし、`LatestVersion > 0` の子0件を旧JSONで隠さない
- **AC-6** `UserCount` と現行 identity の子件数を照合する
- **AC-7** Integrity Scanner 失敗は UNKNOWN / HOLD にする。空配列フォールバックで PASS にしない
- **AC-8** 旧 Version / 旧 CommitId は監査証跡として保持する
- **AC-9** 途中失敗した save の CommitId children が、後続 retry 成功後に current へ昇格しない
- **AC-10** partial failure → retry → successful commit → load() で retry 側 CommitId のみ hydrate される
- **AC-11** concurrent save A/B が同じ nextVersion を取得しても、Parent へ commit された LatestCommitId 側だけ current になる
- **AC-12** losing save の Parent MERGE が ETag 競合で失敗しても、losing CommitId children は current にならない
- **AC-13** load(date) と list(range) の両方で LatestVersion + LatestCommitId を current identity として使う
- **AC-14** Integrity Scanner は少なくとも以下を区別できる  
  - Version > LatestVersion ghost  
  - Version == LatestVersion だが CommitId != LatestCommitId  
  - current Version + current CommitId 内の duplicate identity  
  - LatestVersion > 0 だが LatestCommitId 欠落  
  - LatestVersion / LatestCommitId が指す current children = 0
- **AC-15** 通常保存で既存 DailyRecordRows を DELETE しない
- **AC-16** 既存の Version-only / unversioned データを勝手に migration しない
- **AC-17** 同一日付 Parent は高々1件。create-race で複数親が観測されたら child を書かず abort。load/list も duplicate parent を fail closed。losing Parent は DELETE しない

## 対象外

- 既存 `DailyRecordRows` の削除・バックフィル・Version / CommitId 付与移行
- SharePoint リスト / 列の新規プロビジョニング（resolver / canonical 契約のみ先行可）
- 17行実施記録 (`SharePointExecutionRecordRepository`) の保存経路

## トレードオフ

- 更新のたびに子行が増える。旧 Version / CommitId の整理は別途の監査・アーカイブ規則で行う。
- 同時保存が同じ `nextVersion` を採っても、親へ commit された `LatestCommitId` 以外は current にならない。負け側 CommitId の ghost は Integrity Scanner が検出する。
- `LatestCommitId` / `CommitId` 列が未プロビジョンの環境では、コード契約とテストのみ先行し、live schema は別 Gate とする。
