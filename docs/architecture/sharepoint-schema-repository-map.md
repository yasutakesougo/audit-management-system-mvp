# Audit Management System MVP SharePoint Schema / Repository Contract Mapping Report

- **調査実施日**: 2026年6月19日
- **対象コミット**: `d171c77142750e68d06b47c0e704bbd5db8d9f4e`
- **関連ドキュメント**: 
  - `docs/architecture/frontend-structure.md`（構造レポート）
  - `docs/architecture/feature-inventory.md`（機能棚卸）
  - `docs/architecture/data-flow-readiness.md`（実運用レディネス）

---

## 第1章 調査の目的とデータ境界の全体像

フロントエンドのリファクタリングにより導入された **Ports & Adapters** アーキテクチャに基づき、UI・ドメイン層と物理データソースである **SharePoint Lists** はリポジトリ境界によって隔離されている。
本レポートは、「SharePoint Lists 側のスキーマ定義」と「TypeScript の型・Repository の実装コード」の対応関係（マッピング）を明らかにし、データアクセス時における整合性、変換オーバーヘッド、およびスキーマの不一致（ドリフト）に対する防御能力を評価する。

### 1.1 アーキテクチャの全体像

データアクセスは以下の階層構造を通じて行われる。

```
[UI / Page Components] ── 呼出 ──> [Custom Hooks / Stores (Zustand)]
                                             │
                                        (インターフェース依存)
                                             ▼
                                  [Repository Interfaces]
                                             │
                                   (Factoryによる解決)
                                             ▼
                              [DataProvider Implementations]
                                             │
                                        (OData 変換)
                                             ▼
                               [IDataProvider / spFetch]
                                             │
                                        (REST API)
                                             ▼
                                     [SharePoint Lists]
```

### 1.2 主な評価観点

1. **リスト・フィールド定義の正確性**: `src/sharepoint/definitions` 配下のスキーマと、Repository 側の期待値が一致しているか。
2. **型変換（Row ⇄ Domain）**: OData のプレーンな Row レコードからドメインエンティティへのマッピング処理の堅牢性。
3. **Choice（選択肢）項目のマッピング精度**: SharePoint の `Choice` / `MultiChoice` 列と、アプリ側の Union 型の整合性。
4. **スキーマドリフト・不整合への耐性**: 内部列名のズレや、必須列の欠損が発生した際のエラーハンドリング、自動修復機能の有無。

---

## 第2章 主要リストと Repository の対応サマリー

主要ドメインで利用されている物理リスト、Repository クラス、変換モデル、およびドリフト耐性の評価を以下に整理する。

| 調査ドメイン | SharePoint物理リスト | Repository実装クラス | ドメインモデル・型 | ドリフト防御・マッパー | レディネスランク |
|---|---|---|---|---|---|
| **Daily Records** | `SupportRecord_Daily`<br>`SupportProcedureRecord_Daily`<br>`DailyRecordRows`<br>`DailyActivityRecords` | `DataProviderDailyRecordRepository` | `DailyRecordItem`<br>`DailyRecordUserRow` | `fromSpItem` (RowAggregate用)<br>No-op Guard (`isIdentical`) | **A** |
| **Users** | `Users_Master`<br>`UserTransport_Settings`<br>`UserBenefit_Profile`<br>`UserBenefit_Profile_Ext` | `DataProviderUserRepository` | `IUserMaster`<br>`UserRow` | `UserJoiner` (アクセサリ結合)<br>`applyBenefitCutoverRead` | **A** |
| **Attendance** | `DailyAttendance`<br>`AttendanceUsers`<br>`AttendanceDaily`<br>`TransportLog` | `DataProviderAttendanceRepository` | `AttendanceUserItem`<br>`AttendanceDailyItem` | `AttendanceSchemaResolver`<br>自己修復プロビジョニング | **A** |
| **Kiosk Toilet** | `ToiletRecords` | `SharePointToiletRecordRepository` | `ToiletRecord`<br>`ToiletRecordInput` | `filterPayload` (列自動選別)<br>セーフティ・フォールバッククエリ | **A** |
| **Record Quality**| `RecordQualityReview` | `RecordQualityReviewRepository` | `RecordQualityReview` | `saveDailyRecordWithQualityReview` | **A** |
| **Checklist** | `Compliance_CheckRules` | `useChecklistApi` (※直接参照) | `ChecklistItem`<br>`ChecklistItemDTO` | `mapToChecklistItem` (直結型) | **C** |

---

## 第3章 ドメイン別マッピング詳細分析

### 3.1 Daily Records (支援記録)

日次支援記録は、一括 JSON を保持する **Canonical スキーマ** と、利用者ごとの詳細レコードを持つ **RowAggregate スキーマ** の両方を透過的にサポートする。

#### マッピング仕様
- **データソース**: `SupportRecord_Daily` （`VITE_SP_LIST_DAILY_RECORD` で上書き可能）。
- **必須フィールド**: `Title`, `RecordDate`, `UserRowsJSON`。
- **データ変換**: 
  - Canonical 読み込み時、`UserRowsJSON` (Note型/テキスト) を `JSON.parse` し、`userRows` (TypeScript 配列) にパースして復元する。
  - RowAggregate 読み込み時は `fromSpItem` マッパーを利用し、アソシエーションをメモリ上で日付キーごとに集約（Grouping）する。
- **堅牢性設計**:
  `DataProviderDailyRecordRepository.save()` では、送信前に **No-op Guard (`isIdentical`)** が作動する。既存データと送信データの `date`, `reporter`, `userRows` の完全一致を検知した場合、無駄な SharePoint へのネットワーク書き込みを自動でスキップし、通信のオーバーヘッドを削減する。

---

### 3.2 Users (利用者マスタ)

8KB のリストカラムサイズ制限を回避するため、複数リストにデータを分割（Split Write）し、取得時にメモリ上でマージ（Bulk Join）する高度なマッピングを行う。

#### マッピング仕様
- **データソース**: `Users_Master`, `UserTransport_Settings`, `UserBenefit_Profile`, `UserBenefit_Profile_Ext`。
- **データ変換**: 
  - 単一取得時は、`Promise.all` を用いて 4つのリストから `UserID` キーで並行フェッチし、`UserJoiner.mergeExtraData` で統合する。
  - 複数取得時は、N回クエリによる 429 Throttle を防ぐため、**Bulk Join** 機構を作動させる。各アクセサリリストの全行（最大 4,999 件）を一括取得し、メモリ上でハッシュマップ化（`groupRowsByUserId`）してマージする。
- **Choices 整合性**:
  `TransportToDays`, `TransportFromDays` などの送迎曜日は、SharePoint 上で `MultiChoice` 型 (`['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']`) として定義され、配列データとして適切に相互変換される。
- **移行設計**:
  `applyBenefitCutoverRead` によって、`UserBenefit_Profile` (旧リスト) から `UserBenefit_Profile_Ext` (拡張リスト) へのデータ移行ステージに応じたデータの読み込み・上書き（オーバーレイ）を自動制御する。

---

### 3.3 Attendance (通所管理)

出欠、打刻時間、および送迎方法を管理し、スキーマドリフト検出とセルフヒーリングを最も厳格に行う。

#### マッピング仕様
- **データソース**: `DailyAttendance`, `AttendanceUsers`, `AttendanceDaily`。
- **必須フィールド**: `UserCode`, `RecordDate`, `Status`, `CheckInAt`。
- **データ変換**:
  `toAttendanceUser` および `toAttendanceDaily` マッパーを使用。打刻時間（`CheckInAt` / `CheckOutAt`）は OData の ISO 文字列から TypeScript の nullable string として変換。曜日情報は `normalizeAttendanceDays` を経由して配列化される。
- **Choices 整合性**:
  出欠状態（`Status`）は、SharePoint 上で Choice型 (`['通常', '欠席', '振替', '休止']`) として保存され、ドメイン側のステート定義と同期している。
- **ドリフトと修復**:
  `AttendanceSchemaResolver` を用いて実行時に物理列名をファジー解決する。もし書き込み時に必須のスキーマ定義が解決できなかった場合、**自己修復プロビジョニング (`ensureDailySchemaForWrite`)** が走り、SharePoint 側に物理カラムを自動でプロビジョニング（追加）して書き込みエラーを回避する。

---

### 3.4 Kiosk Toilet (トイレ記録)

現場端末から入力される排泄記録。ネットワークの不安定な環境での動作を保護する設計。

#### マッピング仕様
- **データソース**: `ToiletRecords`。
- **データ変換**: 
  `mapToDomain` メソッドでプレーンレコードからドメイン用の `ToiletRecord` に変換。論理削除フラグ `IsDeleted` (Boolean) は、SharePoint側の Boolean / Text / Number 表現を正規化して Boolean にマッピングする。
- **二重送信防止と部分更新**:
  `update` 時には `ToiletRecordCorrectionPatch` のみが送信される。`filterPayload` 機構によって、事前に取得された `availablePhysicalFields` に存在するカラム以外の余分なプロパティ（Titleなど）を送信対象から除外し、スキーマのズレによる書き込み拒否（Bad Request）を動的に防御する。
- **クエリフォールバック**:
  `listByDate` 時に日付の範囲クエリが 0 件を返した場合、タイムゾーン差等によるデータのすり抜けを防止するため、論理削除されていない最新 500 件を OData レベルで一括取得し、メモリ上で再フィルタするセーフティ・フォールバックが機能する。

---

### 3.5 Record Quality Review (品質レビュー)

記録データの監査レビュー結果を蓄積するリスト。

#### マッピング仕様
- **データソース**: `RecordQualityReview`。
- **特徴**:
  個人情報や支援内容そのものは保存せず、`daily:2026-06-19:user123` のような一意な `RecordID`（IDの境界分離）と、監査の「メタデータ（判定結果やタイムスタンプ）」のみを保存し、原本の非露出ルールを厳守する構成になっている。

---

### 3.6 Checklist (自己点検) / Exceptions (例外)

#### マッピング仕様
- **Checklist (自己点検)**:
  `useChecklistApi` が `useSP` クライアント経由で `Compliance_CheckRules` リストに直接クエリを発行する。
  `['Id', 'Title', 'RuleID', 'RuleName', 'EvaluationLogic', 'ValidFrom', 'ValidTo', 'SeverityLevel']` を直接 SELECT しているが、スキーマ定義側では一部が Legacy カラムとして扱われているため、接続先リストの物理カラムのプロビジョニング状況に強く依存しており、ドリフト耐性が極めて薄い。
- **Exceptions (例外)**:
  他ドメインのリポジトリ経由でデータを吸い上げるため、独自の SharePoint テーブルとの密結合は低く、データ取得失敗時の安全側（警告の抑止）フォールバックをフック側で実装している。

---

## 第4章 特殊フィールドのマッピング特性と懸念点

### 4.1 Choices（選択肢項目）の表記揺れ
SharePoint 側の Choice 列に定義されている選択肢と、TypeScript の Union 型（例: `'通常' | '欠席' | '振替' | '休止'`）の定義にズレが生じた場合、SharePoint への書き込み時に OData の検証エラーとなる。マスタ系の Choice (例: `Shift`, `Category`, `LunchAmount`) については、アプリ側でマッパーを介して検証することが極めて重要である。

### 4.2 Lookup / User（関連・ユーザー）項目
- ユーザー項目（例: `CreatedBy` や `PerformedBy`）は、アプリ側の `UserCode`（文字列マスタID）と異なり、SharePoint 内部の `UserLookupId` (数値) として扱われる場合がある。
- 看護師所見 (`nurse_observations`) 取得時のように、`UserLookupId` から数値へのパース (`parseInt`) と、アプリ側のマスタIDの突合で不一致が起きないよう、結合キーのマッピングをマッパー側で吸収している。

---

## 第5章 スキーマドリフト耐性とプロビジョニング機構

本システムは、SharePoint のデータ構造のドリフト（列名の変更やリストの欠損など）を自動検知・修復する強力な機構を備えている。

```
[System Startup]
       │
       ▼
[bootstrap()] ── 取得 ──> [既存リスト一覧]
       │
       ├─ (リスト未検出) ──> [ensureList()] ──> [SharePoint上にリスト/列を作成] ──> 【自己修復】
       │
       ├─ (必須列欠落) ───> [ensureList()] ──> [SharePoint上に列を自動追加] ───> 【自己修復】
       │
       ├─ (列名ドリフト) ──> [resolveInternalNamesDetailed()] ──> 【列名の動的マッピング解決】
       │                                                         │
       │                                                         ▼
       │                                             [reportSpHealthEvent()] ──> 【管理者へ通知】
       │
       ▼
[bootstrap完了] ──> キャッシュ保存 (sessionStorage / 12時間有効)
```

### 5.1 スキーマプロビジョニングの安全性
- **E2E/テストセーフガード**: `shouldSkipSharePoint()` により、テスト環境下では SharePoint 通信が完全にバイパスされ、安全にスタブデータへ切り替わる。
- **キャッシュ保護**: キャッシュ期間（12時間）の間はスキーマ検証リクエストが抑制されるため、ユーザーアクセス時のパフォーマンス劣化を防ぐ。

---

## 第6章 今後のスキーマ整合性向上のための提案

### 提案1: Checklist 領域への `resolveInternalNames` の適用
- **課題**: `compliance-checklist` 領域のみ、リスト定義の物理カラムを直接 SELECT しており、ドリフト検知やファジー解決の仕組みが入っていない。
- **対策**: 他のドメインと同様に `resolveInternalNamesDetailed` を介して、実行時に物理フィールド名を解決してクエリを組み立てるようにリファクタリングを行う。

### 提案2: Choices 定義の SSOT (Single Source of Truth) 化
- **課題**: `AttendanceStatus` や `ToiletType` などの選択肢リストが、`definitions/*.ts` のスキーマ定義と、アプリ側の TypeScript Union 型 / 定数ファイルで別々に定義されている。
- **対策**: スキーマ定義の `choices: [...]` 配列から TypeScript の Union 型を自動推論 (`typeof choices[number]`) する、または定数定義を一箇所に集約する。

---

## 改版履歴

| 日付 | 内容 |
|---|---|
| 2026-06-19 | 初版作成（主要6領域のリスト/Repository対応およびドリフト・プロビジョニング評価） |
