# スケジュール機能 完成設計書（To-Be Design）

作成日: 2026-07-13
位置づけ: スケジュール機能の最終形を定義する設計書
参照元: `docs/reports/schedule-feature-analysis-2026-07-13.md`

## 1. 目的

本書は、スケジュール機能を単なる予定表ではなく、利用者支援、職員配置、送迎、会議、個別支援計画、通知を接続する運用基盤として設計するためのTo-Be設計である。

この設計書の目的は以下である。

- スケジュール機能のドメイン境界と責務を固定する。
- SharePoint Listsをバックエンド契約として明文化する。
- Repository/API契約、UIフロー、権限、通知、繰り返し予定の判断を先に決める。
- 実装フェーズで、既存契約を壊さず段階的に改善できる状態にする。

本書は現状分析ではない。現状の実装が本書と矛盾する場合、実装側を段階的にTo-Beへ寄せる。

## 2. 設計原則

| 原則 | 内容 |
| --- | --- |
| Repository First | UIはSharePointやGraphを直接扱わず、Repository契約だけを見る。 |
| SharePoint as Contract | SharePoint Listsの内部名、型、選択肢を実装契約として固定する。 |
| Local Day Key | 日付判定は施設ローカル日付、既定では `Asia/Tokyo` を正とする。 |
| Intent over Field | `category`、`serviceType`、`status` は業務意味を優先し、物理フィールドへ混在させない。 |
| Read Safe / Write Explicit | 読み取りは広く安全に、書き込みはロールと機能フラグで明示的に許可する。 |
| Audit Ready | 作成、更新、取消、削除、通知送信は監査可能なイベントとして残す。 |
| Integration by Domain Event | 送迎、会議、個別支援計画などの連携は、直接参照ではなくドメインイベントを介する。 |

## 3. 業務ドメイン

### 3.1 スケジュールの対象

スケジュール機能は以下の予定を扱う。

| 種別 | `category` | 主な対象 | 例 |
| --- | --- | --- | --- |
| 利用者予定 | `User` | 利用者個人 | 通所、欠席、早退、面談、個別支援計画関連 |
| 生活支援予定 | `LivingSupport` | 支援サービス | 入浴、服薬、食事、短期入所、レスパイト |
| 職員予定 | `Staff` | 職員個人またはチーム | 勤務、会議、研修、送迎担当 |
| 組織予定 | `Org` | 施設・部署・全体 | 行事、休所日、監査、全体会議 |

`category` は予定の所有単位を表す。支援内容の分類は `serviceType` で表す。

### 3.2 サービス種別

`serviceType` は支援・運用上の意味を持つ分類であり、`category` とは分離する。

代表的な種別は以下である。

| グループ | 例 |
| --- | --- |
| 利用状態 | 出席、欠席、遅刻、早退、事前欠席 |
| 生活支援 | 入浴、食事、服薬、排泄、短期入所 |
| 送迎 | 迎え、送り、往復、同乗、車両調整 |
| 会議 | 職員会議、ケース会議、個別支援計画会議 |
| 支援計画 | モニタリング、アセスメント、計画見直し |
| 組織運営 | 行事、研修、監査、保守、休所 |

実装では文字列拡張を許可するが、UIの選択肢と集計ロジックはメタデータSSOTから取得する。

### 3.3 状態

スケジュールの状態は以下を正とする。

| 値 | 意味 |
| --- | --- |
| `Planned` | 予定済み。通常表示・集計対象。 |
| `Postponed` | 延期。履歴として残し、通常の稼働集計からは除外可能。 |
| `Cancelled` | 中止・取消。監査上は残し、既定では集計から除外する。 |

古い `Draft`、`Confirmed` はTo-Be契約では使用しない。既存データに存在する場合は移行対象とする。

## 4. UIフロー

### 4.1 主要導線

正規ルートは `/schedules/week` とし、表示モードは `tab` クエリで切り替える。

| 表示 | URL | 目的 |
| --- | --- | --- |
| 日表示 | `/schedules/week?tab=day&date=YYYY-MM-DD` | 1日の予定、支援、送迎、担当確認 |
| 週表示 | `/schedules/week?tab=week&date=YYYY-MM-DD` | 職員・利用者・設備の週次把握 |
| 月表示 | `/schedules/week?tab=month&date=YYYY-MM-DD` | 月次予定、行事、休所日、会議確認 |
| 運用表示 | `/schedules/week?tab=ops&date=YYYY-MM-DD` | 稼働負荷、支援タグ、注意事項、職員配置 |
| 一覧表示 | `/schedules/week?tab=list&date=YYYY-MM-DD` | 検索、絞り込み、一括確認 |

旧URLは互換リダイレクトとして残すが、設計上の正規URLは `/schedules/week` に統一する。

### 4.2 作成フロー

作成は以下の入力経路を許可する。

| 経路 | 既定値 |
| --- | --- |
| カレンダー空き枠クリック | date、start、end、category |
| ヘッダーの新規作成 | dateのみ |
| 利用者詳細から作成 | userId、category=`User` |
| 送迎画面から作成 | serviceType=送迎、vehicleId候補 |
| 個別支援計画から作成 | userId、relatedPlanId、serviceType=計画関連 |

作成時は `title`、`category`、`startLocal`、`endLocal` を必須とする。`User` と `LivingSupport` では `serviceType` を必須とする。担当職員を必須にするかは種別ごとに定義し、UIとドメイン検証を一致させる。

### 4.3 編集・取消・削除フロー

編集は原則として監査可能な更新とする。

| 操作 | 方針 |
| --- | --- |
| 時刻変更 | `startLocal` / `endLocal` を更新し、etagで競合検知する。 |
| 担当変更 | 担当職員、車両、支援タグを更新する。 |
| 取消 | 物理削除ではなく `status=Cancelled` を優先する。 |
| 削除 | 誤登録やテストデータなど、監査上削除可能なケースに限定する。 |
| 競合 | 412は競合として表示し、再読込または差分確認を促す。 |

## 5. SharePoint Lists設計

### 5.1 正リスト

To-Beの正リスト名は `Schedules` とする。

`ScheduleEvents` は旧称または移行元として扱う。新規プロビジョニング、ドキュメント、環境変数、チェックリストは `Schedules` に統一する。

### 5.2 `Schedules` リスト

| 論理名 | SharePoint内部名 | 型 | 必須 | 備考 |
| --- | --- | --- | --- | --- |
| id | `Id` | Number | 自動 | SharePoint item id |
| title | `Title` | Text | Yes | 表示タイトル |
| start | `EventDate` | DateTime | Yes | 開始日時 |
| end | `EndDate` | DateTime | Yes | 終了日時 |
| category | `ScheduleCategory` | Choice | Yes | `User` / `LivingSupport` / `Staff` / `Org` |
| serviceType | `ServiceType` | Text or Choice | 条件付き | 支援・運用種別 |
| status | `Status` | Choice | Yes | `Planned` / `Postponed` / `Cancelled` |
| userId | `TargetUserId` | Text | No | 利用者ID |
| userName | `TargetUserName` | Text | No | 表示用冗長化 |
| assignedStaffId | `AssignedStaffId` | Text | No | 担当職員ID |
| assignedStaffName | `AssignedStaffName` | Text | No | 表示用冗長化 |
| vehicleId | `VehicleId` | Text | No | 送迎車両ID |
| location | `Location` | Text | No | 場所 |
| notes | `Note` | Note | No | 備考 |
| visibility | `Visibility` | Choice | Yes | `Org` / `Team` / `Private` |
| ownerUserId | `OwnerUserId` | Text | No | Private予定の所有者 |
| statusReason | `StatusReason` | Text | No | 延期・取消理由 |
| acceptedOn | `AcceptedOn` | DateTime | No | 確認日時 |
| acceptedBy | `AcceptedBy` | Text | No | 確認者 |
| acceptedNote | `AcceptedNote` | Note | No | 確認メモ |
| dayKey | `DayKey` | Text | Yes | `YYYY-MM-DD`、施設ローカル日付 |
| monthKey | `MonthKey` | Text | Yes | `YYYY-MM` |
| fiscalYear | `FiscalYear` | Number | Yes | 年度 |
| relatedRecordId | `RelatedRecordId` | Text | No | 連携元レコード |
| relatedRecordType | `RelatedRecordType` | Text | No | `transport` / `meeting` / `isp` など |
| recurrenceId | `RecurrenceId` | Text | No | 繰り返しグループID |
| recurrenceInstanceDate | `RecurrenceInstanceDate` | Text | No | 例外処理用の日付 |

`Category` という物理フィールドは、To-Beでは予定カテゴリにもサービス種別にも使わない。既存リストに存在する場合は移行元として読むだけにする。

### 5.3 補助リスト

繰り返し予定、通知、外部連携は `Schedules` に詰め込みすぎず、補助リストで管理する。

| リスト | 目的 |
| --- | --- |
| `ScheduleRecurrences` | 繰り返しルール、期間、例外の管理 |
| `ScheduleNotifications` | 通知予定、送信状態、既読・確認状態 |
| `ScheduleAssignments` | 送迎・職員・設備の割当詳細 |
| `ScheduleLinks` | 個別支援計画、会議、日報、監査資料との関連 |

## 6. Repository/API契約

### 6.1 Repositoryの責務

`ScheduleRepository` は以下を提供する。

| メソッド | 責務 |
| --- | --- |
| `list(params)` | 指定期間、カテゴリ、可視性、所有者条件で予定を取得する。 |
| `create(input)` | 入力検証済みの予定を作成し、作成後のScheduleItemを返す。 |
| `update(input)` | etagを使って競合検知しながら部分更新する。 |
| `remove(id, options)` | 物理削除または論理取消を実行する。 |
| `getById(id)` | 詳細表示・競合解消用に単一予定を取得する。 |
| `checkListReady()` | SharePointリストと必須フィールドの準備状態を返す。 |

UIはSharePoint内部名、Graph API、DataProviderの詳細を参照しない。

### 6.2 入力契約

作成入力は以下を最低契約とする。

| フィールド | 必須 | 説明 |
| --- | --- | --- |
| title | Yes | 表示タイトル |
| category | Yes | 予定カテゴリ |
| serviceType | 条件付き | 利用者・生活支援・運用集計対象では必須 |
| startLocal | Yes | 施設ローカル日時 |
| endLocal | Yes | 施設ローカル日時 |
| userId | 条件付き | 利用者予定では必須 |
| assignedStaffId | 条件付き | 職員予定、送迎、担当必須サービスでは必須 |
| visibility | Yes | 既定は `Org` |
| relatedRecordId | No | 連携元 |
| relatedRecordType | No | 連携元種別 |

更新入力は部分更新を許可するが、`id` と競合検知用の `etag` を原則必須にする。etagがない更新は管理者権限または明示的な上書き操作に限定する。

### 6.3 ドメインイベント

スケジュール操作は、次のドメインイベントとして記録・連携できるようにする。

| イベント | 発火条件 | 主な利用先 |
| --- | --- | --- |
| `schedule.created` | 予定作成 | 通知、Today、監査ログ |
| `schedule.updated` | 時刻・担当・内容変更 | 通知、運用ビュー |
| `schedule.cancelled` | 取消 | 送迎、職員配置、利用者支援 |
| `schedule.deleted` | 物理削除 | 監査ログ |
| `schedule.conflict` | etag競合 | UI警告、運用ログ |
| `schedule.reminder_due` | 通知期限到来 | 通知送信 |

## 7. 権限設計

### 7.1 ロール

| ロール | 閲覧 | 作成 | 編集 | 取消 | 削除 | 管理 |
| --- | --- | --- | --- | --- | --- | --- |
| viewer | Yes | No | No | No | No | No |
| staff | Yes | 条件付き | 自分の担当予定 | 自分の担当予定 | No | No |
| reception | Yes | Yes | Yes | Yes | 条件付き | No |
| manager | Yes | Yes | Yes | Yes | Yes | Yes |
| admin | Yes | Yes | Yes | Yes | Yes | Yes |

### 7.2 可視性

| visibility | 説明 |
| --- | --- |
| `Org` | 組織内の閲覧権限者が閲覧可能 |
| `Team` | 所属チームまたは関連職員が閲覧可能 |
| `Private` | 所有者と管理者のみ閲覧可能 |

一覧取得時は `currentOwnerUserId` とユーザー権限をもとにフィルタする。UI側だけで隠すのではなく、Repository層でも可視性条件を適用する。

### 7.3 書き込み制御

To-Beでは、書き込み可否は次の3条件をすべて満たす場合のみ許可する。

1. `schedules` 機能フラグが有効。
2. `VITE_WRITE_ENABLED=true` または本番相当の書き込み許可設定が有効。
3. ユーザーのロールが対象操作を許可している。

作成専用フラグを導入する場合は、`VITE_FEATURE_SCHEDULES_CREATE` を正式に再定義し、ドキュメントと実装を一致させる。

## 8. 通知設計

### 8.1 通知対象

通知は以下のイベントを対象とする。

| 通知 | 対象者 |
| --- | --- |
| 予定作成 | 担当職員、受付、管理者、必要に応じて利用者担当チーム |
| 時刻変更 | 担当職員、送迎担当、関連チーム |
| 取消 | 担当職員、送迎担当、関連チーム |
| リマインド | 担当職員、管理者、当日運用担当 |
| 未確認 | 予定所有者、チーム責任者 |

### 8.2 通知チャネル

To-Beでは、通知チャネルを直接UIに埋め込まず、通知キューを経由する。

| チャネル | 用途 |
| --- | --- |
| In-App | Today、Schedule Ops、ヘッダー通知 |
| Teams | 職員向け即時通知、送迎変更 |
| Email | 管理者向けサマリ、外部連絡 |
| Power Automate | 定期リマインド、未確認チェック |

通知送信は冪等にする。同じ予定・同じイベント・同じ宛先への重複送信を防ぐため、`ScheduleNotifications` に送信キーを保持する。

## 9. 繰り返し予定

### 9.1 方針

繰り返し予定は、`Schedules` に全インスタンスを事前展開する方式を基本とする。繰り返しルールは `ScheduleRecurrences` に保存し、表示・編集・通知の対象は展開済みインスタンスとする。

この方式により、SharePoint検索、日・週・月表示、通知、競合検知を単純に保つ。

### 9.2 ルール

| 項目 | 方針 |
| --- | --- |
| frequency | daily / weekly / monthly |
| interval | 1以上の整数 |
| daysOfWeek | weeklyの場合に使用 |
| until | 終了日 |
| count | 最大回数 |
| exceptions | 個別日付の取消・時刻変更 |

繰り返し全体を変更する場合は、未来インスタンスのみ更新する。過去インスタンスは監査のため原則変更しない。

## 10. 関連機能連携

### 10.1 利用者支援

利用者予定は `userId` を必須とし、Today、利用者詳細、支援記録、個別支援計画から参照できるようにする。

支援記録とスケジュールは直接同じレコードにしない。スケジュールは「予定」、支援記録は「実施結果」として分離し、`relatedRecordId` または `ScheduleLinks` で接続する。

### 10.2 職員会議

職員会議は `category=Staff` または `category=Org`、`serviceType=meeting` として扱う。ケース会議や個別支援計画会議は、対象利用者や計画レコードとリンクする。

会議予定から議事録、アジェンダ、参加者、決定事項へ遷移できるようにする。ただし、議事録本文はスケジュールではなく会議ドメインに保存する。

### 10.3 送迎

送迎はスケジュールの一種として表示しつつ、割当詳細は `ScheduleAssignments` で管理する。

| 要素 | 方針 |
| --- | --- |
| 車両 | `vehicleId` で参照 |
| 運転者 | assignmentとして管理 |
| 同乗者 | assignmentとして管理 |
| 利用者 | `userId` またはassignment対象 |
| 方向 | `pickup` / `dropoff` / `roundtrip` |

送迎の時間変更や取消は、担当職員と運用ビューに通知する。

### 10.4 個別支援計画

個別支援計画との連携は、予定を計画データそのものにしない。予定は計画に関連する「実施・確認・会議・モニタリング」の日程として扱う。

| 連携 | 例 |
| --- | --- |
| アセスメント | 実施予定、担当者、対象利用者 |
| 計画会議 | 会議予定、参加者、議事録リンク |
| モニタリング | 実施予定、期限、未実施アラート |
| 見直し | 次回予定、担当者、通知 |

## 11. 運用ビュー

運用ビューは日次と週次を明確に分ける。

| 表示 | 取得範囲 | 主な用途 |
| --- | --- | --- |
| 日次Ops | 選択日1日 | 当日の支援量、注意事項、職員配置 |
| 週次Ops | 選択週 | 曜日別負荷、欠席傾向、配置計画 |
| 一覧Ops | 指定範囲 | 検索、一括確認、未確認抽出 |

`tab=ops` では週次表示に必要な範囲を取得する。通常の日・週・月表示で不要なOpsデータ取得は避ける。

## 12. テスト計画

### 12.1 Unit

- `category` と `serviceType` の分離を検証する。
- `Planned` / `Postponed` / `Cancelled` の状態変換を検証する。
- JST日付キー、月キー、年度計算を検証する。
- 繰り返し予定の展開と例外処理を検証する。
- 運用サマリの日次・週次集計を検証する。

### 12.2 Integration

- RepositoryがSharePoint内部名を正しく解決することを検証する。
- `Schedules` リストの必須フィールド不足を検出できることを検証する。
- etag競合時に `ScheduleConflictError` 相当のエラーへ変換されることを検証する。
- 通知キューへの重複登録を防げることを検証する。
- 送迎・会議・個別支援計画リンクが予定削除や取消で壊れないことを検証する。

### 12.3 E2E

- 日・週・月・運用・一覧タブをURL遷移込みで確認する。
- 予定の作成、編集、取消、競合表示を確認する。
- 権限別に作成・編集・削除ボタンの表示と実行可否を確認する。
- `tab=ops` が週次範囲を取得し、週全体の集計を表示することを確認する。
- 0時前後の予定がJST日付で正しく表示されることを確認する。
- 繰り返し予定の作成、未来分更新、単一例外を確認する。

## 13. 段階導入計画

### Phase 0: 契約固定

- `Schedules` リストを正とする。
- Status値を `Planned` / `Postponed` / `Cancelled` に統一する。
- `category` と `serviceType` の物理フィールド分離を決める。
- docs、runbook、provisioning scriptの不整合を解消する。

### Phase 1: MVP安定化

- 動的フィールド解決後の論理キーをマッパーで読む。
- Opsタブの取得範囲を修正する。
- 組織フィルタを実装または非表示にする。
- UIとドメインの必須条件を一致させる。
- `checkListReady()` をRepository契約として実装する。

### Phase 2: 運用機能拡張

- 送迎・職員割当を `ScheduleAssignments` へ分離する。
- Schedule Opsの週次・一覧機能を本番データで安定化する。
- Today、Dashboard、利用者詳細との連携を統一する。
- 通知キューと確認状態を導入する。

### Phase 3: 最終形

- 繰り返し予定を導入する。
- 個別支援計画、会議、支援記録とのリンクを正式化する。
- Teams / Email / Power Automate通知を段階導入する。
- 監査ログと運用レビュー資料を自動生成できるようにする。

## 14. ADR候補

本書のうち、以下はADRとして切り出す価値が高い。

| ADR候補 | 判断内容 |
| --- | --- |
| Schedule SharePoint Contract | `Schedules` リスト、Status値、カテゴリ/サービス種別分離を正とする。 |
| Schedule Repository Boundary | UIからSharePoint直接参照を禁止し、Repositoryを唯一の入口にする。 |
| Schedule Recurrence Strategy | 繰り返し予定を事前展開方式で扱う。 |
| Schedule Notification Architecture | 通知をキュー経由、冪等送信、監査可能イベントとして扱う。 |
| Schedule Integration Boundary | 支援記録、会議、送迎、個別支援計画とはリンクで接続し、同一レコードにしない。 |

## 15. 受け入れ条件

この設計書を実装フェーズの入力として扱うための受け入れ条件は以下である。

- 正規ルート、正リスト、正ステータス値が明記されている。
- `category` と `serviceType` の責務が分離されている。
- SharePoint ListsのTo-Beフィールドが定義されている。
- Repository/API契約がUIから利用可能な粒度で定義されている。
- 権限、通知、繰り返し予定、連携機能の方針が未決になっていない。
- Phase 0からPhase 3までの導入順が示されている。

## 16. 関連資料

- `docs/reports/schedule-feature-analysis-2026-07-13.md`
- `docs/design/schedules.md`
- `docs/design/schedules-contracts.md`
- `docs/design/schedule-ops-implementation-design.md`
- `docs/ARCHITECTURE_SCHEDULES.md`
- `docs/ARCHITECTURE_SCHEDULE_SPLIT.md`
- `docs/adr/ADR-014-sharepoint-ssot-drift-contract.md`
- `docs/adr/ADR-024-modular-monolith-module-boundaries.md`
