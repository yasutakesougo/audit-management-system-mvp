# スケジュール機能 調査分析レポート

調査日: 2026-07-13
対象リポジトリ: `audit-management-system-mvp`
対象範囲: `src/features/schedules`、関連ルート、SharePoint連携、運用系ビュー、関連ドキュメントとスクリプト

## 1. エグゼクティブサマリー

スケジュール機能は、現在のアプリケーション内で独立した機能領域として整備されており、`/schedules/week` を中心に日・週・月・運用・一覧の各ビューを統合する構成になっている。Zodスキーマ、Repositoryパターン、SharePoint/DataProvider実装、インメモリ実装、ダイアログ・ビュー・フックの分離があり、基盤は比較的明確である。

一方で、実装の成熟度には領域差がある。通常の表示・作成・更新・削除・競合検知はおおむね実装済みだが、運用系タブ、SharePointリスト契約、フィルタ、書き込み制御、既存ドキュメントには不整合が残っている。特に、運用ビューの取得範囲が日次に固定されやすい点、`Category` フィールドの意味がカテゴリとサービス種別で混在している点、プロビジョニングスクリプトと現行スキーマのStatus値が異なる点は、実運用前に修正または明確化すべきである。

総合評価としては、利用者向けの基本スケジュール機能はMVPとして成立しているが、SharePoint本番運用と運用系ダッシュボードまで含めると、データ契約の固定化とリリース制御の再整理が必要である。

## 2. 現在の構成

### 2.1 ルーティング

中心ルートは `src/app/routes/scheduleRoutes.tsx` の `/schedules/week` である。旧URLの `/schedule`、`/schedule/*`、`/schedule-ops`、`/schedules/day`、`/schedules/month`、`/schedules/timeline` は、クエリパラメータ付きの `/schedules/week` に集約されている。

アクセス制御は以下の層で行われる。

| 層 | 実装 | 役割 |
| --- | --- | --- |
| 機能フラグ | `SchedulesGate` / `featureFlags.ts` | `schedules` フラグで表示可否を制御 |
| 認証 | `ProtectedRoute` | ログイン必須化 |
| ロール | `RequireAudience requiredRole="viewer"` | 閲覧以上の権限を要求 |
| 書き込み | `isWriteEnabled()` + RBAC | 作成・更新・削除可否を制御 |

### 2.2 フロントエンド構成

主要な画面構成は以下の通り。

| 種別 | 主な実装 | 状態 |
| --- | --- | --- |
| 統合ページ | `routes/WeekPage.tsx` | 中心画面 |
| 週ビュー | `routes/WeekView.tsx`, `WeekTimeGrid.tsx` | 実装済み |
| 日ビュー | `routes/DayView.tsx` | 実装済み |
| 月ビュー | `routes/MonthPage.tsx` | 実装済み |
| 作成・編集 | `components/dialogs/ScheduleCreateDialog.tsx` | 実装済み |
| 詳細表示 | `routes/ScheduleViewDialog.tsx` | 実装済み |
| 運用ビュー | `components/ops/*`, `hooks/useScheduleOps.ts` | 実装済みだが取得範囲に要注意 |
| 送迎・割当 | `domain/assignment`, `infra/SharePointAssignmentRepository.ts` | 部分実装 |

### 2.3 データアクセス

データアクセスは `ScheduleRepository` を中心に抽象化されている。

```text
WeekPage
  -> useSchedulesPageState
    -> useSchedules
      -> getScheduleRepository()
        -> DataProviderScheduleRepository または InMemoryScheduleRepository
          -> SharePoint List / local memory
```

本番相当では `DataProviderScheduleRepository` が `IDataProvider` 経由でSharePointリストを操作する。ローカル・テスト・デモ条件では `InMemoryScheduleRepository` が使われる。

Repository選択は `src/lib/createRepositoryFactory.ts` の共通ロジックに依存しており、以下の場合はデモ寄りになる。

- `VITE_APP_ENV=demo`
- `VITE_SKIP_LOGIN=1`
- `VITE_SKIP_SHAREPOINT=1`
- SPFxコンテキスト不足
- 開発モード
- テスト実行時

`VITE_FORCE_SHAREPOINT=true` の場合はSharePoint実装が優先される。

## 3. データモデルとSharePoint契約

### 3.1 ドメインモデル

ドメインのSSOTは `src/features/schedules/domain/schema.ts` にある。

主要なモデルは以下の3層で構成される。

| 層 | 内容 |
| --- | --- |
| `ScheduleCoreSchema` | id、title、start、end、category、status、etag |
| `ScheduleDetailSchema` | visibility、location、notes、利用者・職員・車両・承認関連 |
| `ScheduleFullSchema` | source、createdAt、updatedAt、entryHash、ownerUserId、staffNames |

カテゴリは `User`、`Staff`、`Org`、`LivingSupport` が定義されている。ステータスは `Planned`、`Postponed`、`Cancelled` が現行の中心値である。

### 3.2 入力バリデーション

作成フォームは `scheduleFormState.ts` で検証される。タイトル、開始、終了、カテゴリは必須で、終了時刻は開始時刻より後である必要がある。`User` と `LivingSupport` では `serviceType` が必須になる。

ただし、UI上は `User` カテゴリでも担当職員が必須表示になっている一方、`toCreateScheduleInput()` で明示的に `assignedStaffId` を必須化しているのは `Staff` カテゴリのみである。このため、UIとドメイン検証の必須条件に差がある。

### 3.3 SharePointフィールド

SharePoint連携は以下のファイルに分散している。

| ファイル | 役割 |
| --- | --- |
| `data/spSchema.ts` | リスト名、論理フィールドと物理フィールドの対応 |
| `data/spRowSchema.ts` | SharePoint行のZod検証とScheduleItemへの変換 |
| `infra/DataProviderScheduleRepository.ts` | 実際のlist/create/update/delete |
| `sharepoint/fields/scheduleFields.ts` | 動的フィールド候補とensure定義 |
| `data/contract.ts` | 必須フィールド・選択肢検証 |

フィールド名の揺れに対応するため、`resolveInternalNamesDetailed()` と `washRow()` による動的解決が入っている。この設計は堅牢だが、現在の `mapSpRowToSchedule()` は `washRow()` が追加する論理キー `start` / `end` を直接見ていない。そのため、実フィールドが `EventDate0` や `EndDate0` のようにずれた場合、値は洗浄済み行に残っていてもマッパー側で拾われず、行が表示されない可能性がある。

## 4. 機能別評価

| 機能 | 状態 | コメント |
| --- | --- | --- |
| 日・週・月表示 | 実装済み | `/schedules/week?tab=day/week/month` に統合 |
| 作成 | 実装済み | 書き込みフラグとロールで制御 |
| 編集 | 実装済み | 権限判定と競合検知あり |
| 削除 | 実装済み | Repository経由 |
| 競合検知 | 実装済み | 412を `ScheduleConflictError` に変換 |
| URL状態管理 | 実装済み | date、tab、filter、dialog系クエリを利用 |
| カテゴリフィルタ | 実装済み | `cat` クエリとUIあり |
| 組織フィルタ | 未完了 | UI/URL状態はあるが、実フィルタに反映されていない |
| 検索 | 実装済み | タイトル、場所、メモ、利用者名、職員名など |
| 運用サマリ | 部分注意 | 集計ロジックはあるが、取得範囲の同期に問題がある |
| 送迎・割当 | 部分実装 | SharePoint実装はlist/saveBulk中心でcreate/delete未実装 |
| Dashboard Today連携 | 部分注意 | skip SharePoint時はデモデータではなく空配列を返す |
| Graph連携 | 事実上保留 | adapterはあるが主要経路では未使用に見える |

## 5. 主要なリスクと不整合

### 5.1 運用タブの取得範囲が日次に寄りやすい

`WeekPage.tsx` は通常ビューでも `useScheduleOps()` を呼び出している。`useScheduleOpsPageState()` の `viewMode` 初期値は `daily` で、`tab=ops` や `tab=list` と明示的に同期していない。結果として、運用週次ビューや一覧タブで、週全体ではなく選択日の範囲だけを取得し、週次集計の他の日がゼロに見える可能性がある。

影響度: 高
推奨対応: `mode` と `viewMode` を同期する、または運用系コンポーネント側で必要範囲を明示的に渡す。

### 5.2 SharePointのリスト名・Status値・フィールド契約が文書と実装で異なる

現行実装の既定リスト名は `Schedules` である。一方、運用チェックリストには `ScheduleEvents` が現れ、スクリプトは `Schedules` を作成する。さらに、Status値は現行ドメインとensure定義では `Planned` / `Postponed` / `Cancelled` だが、古いスクリプトでは `Draft` / `Confirmed` / `Cancelled` が使われている。

影響度: 高
推奨対応: 本番リスト契約を1つに固定し、スクリプト、docs、`SCHEDULE_ENSURE_FIELDS`、`data/contract.ts` を同じ値にそろえる。

### 5.3 `Category` フィールドの意味が混在している

`spSchema.ts` では `serviceType` が物理フィールド `Category` を指すコメントがあり、`category` も別候補として解決される。`buildMappedPayload()` は論理キーを物理フィールドへ変換するため、同じ物理フィールドにカテゴリとサービス種別が重なると、値の上書きや意味の取り違えが起きる可能性がある。

影響度: 高
推奨対応: 「予定カテゴリ」と「サービス種別」をSharePoint上でも別フィールドに分離し、既存データ移行ルールを明文化する。

### 5.4 動的フィールド解決後のマッピングに抜けがある

`washRow()` は解決済みフィールドを論理キーへコピーするが、`mapSpRowToSchedule()` は候補名として `EventDate`、`EndDate` などを直接参照しており、論理キー `start` / `end` を参照していない。このため、フィールド名揺れ対応の効果が一部失われる。

影響度: 中から高
推奨対応: `mapSpRowToSchedule()` の候補に `start`、`end`、`title`、`category` などの論理キーを追加し、動的解決後の行を優先して読む。

### 5.5 書き込み制御の説明が散らばっている

実装上の書き込み可否は主に `VITE_WRITE_ENABLED` とロールで決まる。古いドキュメントには `VITE_FEATURE_SCHEDULES_CREATE` や `schedulesCreate` が残っているが、現行の `featureFlags.ts` にはこのフラグが見当たらない。

影響度: 中
推奨対応: 作成機能フラグを復活させるか、`VITE_WRITE_ENABLED` に統一してドキュメントから古い記述を削除する。

### 5.6 組織フィルタは未接続

`WeekPage` とフィルタバーには組織フィルタの状態があるが、`useSchedulesPageState()` の `filteredItems` では組織条件が使われていない。`docs/ARCHITECTURE_SCHEDULE_SPLIT.md` の「組織フィルタ未実装」という記述と実態は一致している。

影響度: 中
推奨対応: 未実装としてUIを隠すか、`orgParam` をフィルタ条件へ接続する。

### 5.7 月ビューの集計仕様がドキュメントと異なる

ドキュメントでは月表示の件数は開始日ベースとされているが、`MonthPage.tsx` の集計は複数日にまたがる予定を各日に加算する実装になっている。仕様としてはどちらも成立するが、ユーザーの期待とテスト基準がずれる。

影響度: 中
推奨対応: 開始日ベースか日跨ぎ展開かを仕様として決め、ドキュメントとテストを合わせる。

### 5.8 Today/Dashboard連携がデモモードで空になる

`useSchedulesToday.ts` は `shouldSkipSharePoint()` が真の場合に空配列を返す。ローカルデモではスケジュールリポジトリ自体はインメモリデータを持つため、スケジュール画面とTodayウィジェットで見えるデータが一致しない可能性がある。

影響度: 中
推奨対応: デモ時も `getScheduleRepository()` を使うか、Dashboard側はSharePoint専用であることを明記する。

### 5.9 タイムゾーン処理が一部で揺れている

主要な日付キーは `Asia/Tokyo` 前提で `toDateKey()` や `formatInTimeZone()` を使っている。一方で、運用集計の一部に `item.start?.slice(0, 10)`、インメモリ実装やフォーム周辺に `toISOString()` ベースの処理が残る。JST境界の予定で日付ずれが起きる可能性がある。

影響度: 中
推奨対応: スケジュール領域では日付キー生成を `toDateKey()` / `dayKeyInTz()` に統一する。

### 5.10 送迎・割当機能は部分実装

Assignment領域には型、純粋ロジック、インメモリリポジトリ、SharePointリポジトリがある。ただしSharePoint実装では `create()`、`delete()`、`getById()` が未実装または限定的で、`isOwner()` も常にtrueのプレースホルダである。

影響度: 中
推奨対応: MVP対象範囲を「既存スケジュール行の割当更新」に限定するか、CRUDと権限判定を実装してから運用機能として公開する。

## 6. テスト・品質状況

スケジュール領域には、単体テスト、統合テスト、E2Eテスト、アクセシビリティ系テストが存在する。`package.json` には以下のようなスケジュール専用スクリプトが定義されている。

| スクリプト | 目的 |
| --- | --- |
| `test:schedule:mini` | 主要な軽量テスト |
| `test:schedule:unit` | ドメイン・フック・コンポーネントの単体寄り |
| `test:schedule:e2e` | Playwright E2E |
| `test:schedule-week` | 週表示周辺 |
| `test:e2e:schedules:a` | フラグON系E2E |
| `test:e2e:schedules:sp` | SharePointモード想定E2E |

テスト資産は多いが、以下の観点は追加または強化した方がよい。

- `tab=ops` / `tab=list` で週次範囲を取得すること
- 動的フィールド解決後の `start` / `end` 論理キーをマッピングできること
- `Category` と `serviceType` が同一物理フィールドに解決された場合の挙動
- `User` カテゴリで担当職員未指定を許容するか拒否するか
- JST境界、特に0時前後の予定が日・週・月・運用集計で同じ日に入ること
- 組織フィルタの未実装状態をテストで明示するか、実装後に期待値を固定すること

この調査ではテスト実行は行っていない。ソースとドキュメントの静的調査に基づく分析である。

## 7. 推奨対応ロードマップ

### P0: 本番運用前に対応

1. SharePointリスト契約を一本化する
   `Schedules` / `ScheduleEvents`、Status値、必須フィールド、選択肢、プロビジョニングスクリプトを同じ契約にそろえる。

2. 運用タブの取得範囲を修正する
   `tab=ops` と `tab=list` では週次・一覧に必要な範囲を確実に取得する。通常のday/week/month表示では不要な運用データ取得を抑える。

3. フィールドマッピングの抜けを修正する
   `mapSpRowToSchedule()` が `washRow()` 後の論理キーを読めるようにする。

4. `Category` と `serviceType` の物理フィールドを分離する
   少なくとも上書きが起きないように、解決結果の衝突検知と警告を追加する。

### P1: MVP安定化

1. 書き込みフラグのドキュメントを更新する
   `VITE_WRITE_ENABLED` に統一するか、作成専用フラグを実装へ戻す。

2. 入力必須条件をUIとドメインで一致させる
   `User` カテゴリの担当職員必須有無を決め、`ScheduleFormSchema` と `toCreateScheduleInput()` を更新する。

3. 組織フィルタを実装または非表示にする
   現状は未接続のため、ユーザーに見せる場合は実フィルタへ接続する。

4. 月ビュー集計仕様を固定する
   開始日ベースか日跨ぎ展開かを決め、ドキュメント・テスト・UI表現を一致させる。

5. Today/Dashboardのデモ挙動を合わせる
   デモデータを表示するか、SharePoint専用ウィジェットであることを明示する。

### P2: 保守性改善

1. `hooks/legacy/useSchedules.ts` と `hooks/useSchedules.ts` の役割を整理する
   現行エントリポイントが `legacy` 配下にあるため、保守時に誤解を生みやすい。

2. `data/port.ts`、`demoAdapter.ts`、`graphAdapter.ts` の利用方針を決める
   現行Repository経路と重複しているため、残すものと廃止するものを明確化する。

3. Assignment機能の公開範囲を決める
   部分実装のままUIから到達できる範囲を広げると、権限・競合・削除で運用事故につながりやすい。

4. タイムゾーン処理をユーティリティへ集約する
   `slice(0, 10)` と `toISOString()` ベースの日付判定を減らす。

## 8. 参照ファイル

主に確認したファイルは以下である。

- `src/app/routes/scheduleRoutes.tsx`
- `src/app/SchedulesGate.tsx`
- `src/app/config/routeGroups/schedulesRoutes.ts`
- `src/config/featureFlags.ts`
- `src/lib/env.ts`
- `src/lib/createRepositoryFactory.ts`
- `src/features/schedules/domain/schema.ts`
- `src/features/schedules/domain/scheduleFormState.ts`
- `src/features/schedules/domain/ScheduleRepository.ts`
- `src/features/schedules/data/spSchema.ts`
- `src/features/schedules/data/spRowSchema.ts`
- `src/features/schedules/infra/DataProviderScheduleRepository.ts`
- `src/features/schedules/infra/InMemoryScheduleRepository.ts`
- `src/features/schedules/repositoryFactory.ts`
- `src/features/schedules/hooks/legacy/useSchedules.ts`
- `src/features/schedules/hooks/view-models/useSchedulesPageState.ts`
- `src/features/schedules/hooks/orchestrators/useWeekPageOrchestrator.ts`
- `src/features/schedules/routes/WeekPage.tsx`
- `src/features/schedules/routes/WeekView.tsx`
- `src/features/schedules/routes/DayView.tsx`
- `src/features/schedules/routes/MonthPage.tsx`
- `src/features/schedules/components/dialogs/ScheduleCreateDialog.tsx`
- `src/features/schedules/hooks/useScheduleOps.ts`
- `src/features/schedules/domain/scheduleOps.ts`
- `src/features/schedules/domain/assignment/*`
- `src/features/schedules/infra/SharePointAssignmentRepository.ts`
- `src/sharepoint/fields/scheduleFields.ts`
- `docs/ARCHITECTURE_SCHEDULES.md`
- `docs/ARCHITECTURE_SCHEDULE_SPLIT.md`
- `docs/design/schedules.md`
- `docs/design/schedules-contracts.md`
- `docs/ops/schedules-prod-checklist.md`
- `docs/ops/schedule-env-rollout-checklist.md`
- `docs/runbooks/schedules-list-setup.md`
- `scripts/create-schedules-list.ps1`
- `scripts/add-schedules-phase1-fields.ps1`

## 9. 結論

スケジュール機能は、MVPとしての基本体験とデータアクセス基盤はすでに形になっている。特に、Repository抽象、Zodスキーマ、URL状態管理、主要ビューの統合は今後の拡張に耐えやすい。

ただし、本番運用に向けては「SharePoint契約」「運用タブの取得範囲」「カテゴリとサービス種別の分離」「書き込み制御の整理」を先に片付ける必要がある。これらはUIの微修正ではなく、データの意味と運用手順に関わるため、早い段階で仕様として固定するのが望ましい。
