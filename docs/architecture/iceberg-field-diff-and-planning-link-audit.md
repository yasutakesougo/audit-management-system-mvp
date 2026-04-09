# Iceberg SharePoint差分表と planningSheetId 欠落監査

更新日: 2026-04-09

## A. Iceberg_Analysis / Iceberg_PDCA 実フィールド差分表

### A-1. Iceberg_Analysis（List: `Iceberg_Analysis`）

| logical field | SharePoint internal name | required / optional | repository read/write | UI使用箇所 | drift吸収 |
|---|---|---|---|---|---|
| id | `Id` | required (SP system) | R: yes / W: no | 永続化内部（直接UI表示なし） | なし（固定） |
| title | `Title` | required | R: indirect (`PayloadJson.title`) / W: yes | `IcebergAnalysisPage` セッション名表示 | なし（固定） |
| entryHash | `EntryHash` | required | R: yes / W: yes | UI直接利用なし（upsertキー） | なし（固定） |
| sessionId | `SessionId` | required | R: indirect (`PayloadJson.sessionId`) / W: yes | `IcebergAnalysisPage` 再開導線 | なし（固定） |
| userId | `UserId` | required | R: yes / W: yes | `IcebergAnalysisPage`, `NewPlanningSheetForm` 読込条件 | なし（固定） |
| payloadJson | `PayloadJson` | required | R: yes / W: yes | `IcebergAnalysisPage` / `NewPlanningSheetForm` で実体復元 | **あり**（`icebergSnapshotSchema`でJSON契約を検証） |
| schemaVersion | `SchemaVersion` | optional (運用上は必須扱い) | R: payload側で検証 / W: yes | UI直接利用なし | なし（固定） |
| updatedAt | `UpdatedAt` | required | R: yes / W: yes | 最新順取得に利用 | なし（固定） |
| planningSheetId (payload内) | `PayloadJson.planningSheetId` | optional | R: yes / W: yes | 連結基盤（計画連携） | **あり**（Zod optional + backward compat） |

補足:
- `Iceberg_Analysis` は物理列に `planningSheetId` を持たず、`PayloadJson` 内の論理フィールドとして保持。
- 物理列レベルの InternalName drift 吸収は未実装（固定名依存）。

### A-2. Iceberg_PDCA（List: `Iceberg_PDCA`）

| logical field | SharePoint internal name | required / optional | repository read/write | UI使用箇所 | drift吸収 |
|---|---|---|---|---|---|
| id | `Id` | required (SP system) | R: yes / W: no | `IcebergPdcaPage` 一覧/編集 | あり（system field fallback） |
| userId | `UserID0` | required | R: yes / W: yes | `IcebergPdcaPage`, `useIcebergEvidence` | 部分的（read `$select`は動的） |
| planningSheetId | `PlanningSheetId`（候補解決） | optional | R: yes / W: yes | `IcebergPdcaPage`（sheet単位表示）, `aggregateIcebergEvidence` | **あり**（候補: `PlanningSheetId`, `PlanningSheetId0`, `PlanningSheetLookupId` 等） |
| title | `Title` | required | R: yes / W: yes | `IcebergPdcaPage` | 部分的（read `$select`は動的） |
| summary | `Summary0` | optional | R: yes / W: yes | `IcebergPdcaPage` | 部分的（read `$select`は動的） |
| phase | `Phase0` | optional | R: yes / W: yes | `IcebergPdcaPage`, `PdcaCycleBoard` | 部分的（read `$select`は動的） |
| createdAt | `Created` | required (SP system) | R: yes / W: no | UI表示/並び順補助 | あり（system field） |
| updatedAt | `Modified` | required (SP system) | R: yes / W: no | UI表示/並び順 | あり（system field） |

補足:
- 既存の read 側 drift 吸収（`buildIcebergPdcaSelectFields`）に加え、今回の修正で `planningSheetId` の read/write も候補解決で吸収。
- write 側は「フィールドが実在する場合のみ書く」ガードを追加済み。

## B. planningSheetId 欠落ポイント監査

### B-1. 結果サマリ

| 欠落候補 | 判定 | 根拠 |
|---|---|---|
| PDCA新規作成時に未設定 | **対処済み（導線経由）** | `support-planning` → `iceberg-pdca` URL に `planningSheetId` を付与し、`create/update` 入力へ伝播 |
| Iceberg→Intervention 変換時に未引継ぎ | **未対処（設計上）** | `BehaviorInterventionPlan` 型に `planningSheetId` が存在しない |
| Planning作成後の逆リンク保存漏れ | **未対処（要追加設計）** | `NewPlanningSheetForm` 作成後に Iceberg snapshot を逆更新する処理が未実装 |
| Repository read/write で null/undefined を落としている | **対処済み（PDCA） / 一部残** | PDCA repositoryは read/write/filter 対応済。Analysis側は sessionへのセット経路がまだ弱い |
| 旧データに列自体がない | **吸収済み（PDCA）** | `planningSheetId` 列未存在時は readでundefined扱い、filter時は空返却で誤結合回避 |

### B-2. 今回入れた実装修正

1. `Iceberg_PDCA` の `planningSheetId` を型だけでなく永続化I/Oへ接続。
2. `support-planning` → `iceberg-pdca` 遷移時に `planningSheetId` をクエリ引き継ぎ。
3. `IcebergPdcaPage` の list/create/update に `planningSheetId` フィルタ・保存を追加。
4. `InMemoryPdcaRepository` でも同等の挙動に揃え、テストを追加。
5. `icebergStore` の snapshot save/load で `planningSheetId` を保持。
6. `spListRegistry` の `iceberg_pdca` 定義に `PlanningSheetId` 列を追加（プロビジョニング定義整合）。

### B-3. 未解決タスク（次優先）

1. `IcebergSession` に `planningSheetId` をセットする明示API（例: セッション開始時/導線遷移時）を追加。
2. `NewPlanningSheetForm` 作成完了時に、元 Iceberg snapshot へ逆リンク保存する専用メソッドを repository に追加。
3. `icebergToInterventionDrafts` の入出力契約に `planningSheetId` を含めるか、別コンテキストで管理する方針を確定。
