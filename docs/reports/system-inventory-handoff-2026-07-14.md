# 現システム棚卸し調査レポート

## 0. 調査条件

| 項目 | 内容 |
| --- | --- |
| 調査目的 | 次の開発者・保守担当者が、システムの配置、実装成熟度、データ経路、主要リスクを短時間で把握できるようにする |
| 調査日 | 2026-07-14 |
| 基準コミット | `05fea33645c2802159d23f62b05aad9327b714b9` |
| 対象リポジトリ | `audit-management-system-mvp` |
| 主な対象 | `src/features`、`src/app/routes`、Hub定義、データアクセス、テスト、CI、運用スクリプト、既存棚卸し資料 |
| 調査方式 | リポジトリ内のコード、設定、既存ドキュメントに基づく静的調査 |
| 対象外 | SharePoint実環境、Firestore実データ、実利用状況、権限設定、性能実測、本番ブラウザでの操作確認 |

### 0.1 参照した既存資料

- `docs/architecture/feature-inventory.md`
- `system-map-v2.md`
- `system-map.md`
- `docs/reports/schedule-feature-analysis-2026-07-13.md`
- `README.md`
- `package.json`

`system-map-v2.md` は2026-03-27生成、`system-map.md` は2026-06-12生成、`feature-inventory.md` は2026-06-19作成のスナップショットである。

このため、既存資料の件数や成熟度をそのまま現在値とは扱わず、対象コミットのルート定義と主要実装を優先した。

`docs/reports/schedule-feature-analysis-2026-07-13.md` は基準コミットには含まれない。

同資料は2026-07-13時点の補助資料として参照し、基準コミットの確定事実と分けて扱った。

### 0.2 保護対象

次の既存変更には触れない前提とした。

- `tests/e2e/daily-pdca.integration.spec.ts`
- `docs/design/schedules-to-be-design.md`
- `docs/reports/schedule-feature-analysis-2026-07-13.md`

本調査の成果物は、このMarkdownレポート1件だけである。

---

## 1. エグゼクティブサマリー

### 1.1 確認結果

本システムは、React、TypeScript、Viteで構築されたSPAである。

主データ基盤はSharePoint Onlineであり、MSALによる認証とアクセストークン取得を前提とする。

画面構造は、Hubを入口とし、ドメイン別ルート群を薄いルーターで合成する方式である。

ルーターは、13個のドメイン別ルート群と看護ルートを合成している。

業務機能は、現場実行、計画・分析、運営、統制、基盤、帳票・請求に分かれる。

主要機能にはRepositoryパターンが導入され、SharePoint実装とInMemory実装を環境条件で切り替える。

一方で、すべての機能が共通Repositoryパターンへ統一されているわけではない。

日次記録には、DataProvider版と直接SharePoint版の2系統のRepository Factoryが残っている。

申し送りは、共通Repository Factoryではなく、`useSP`を利用する専用API、キャッシュ、楽観的更新、LocalStorage補完を組み合わせる。

Todayは単一データの管理画面ではなく、日次記録、出欠、予定、送迎、申し送り、例外、電話ログ、アクション提案を集約するオーケストレーション画面である。

スケジュール画面は`/schedules/week`へ集約されているが、旧URL、タブ、運用ビュー、書き込み制御、SharePoint契約が重なり、利用者から見た複雑さが残る。

品質基盤にはVitest、Playwright、TypeScript、ESLint、Lighthouse CI、dependency-cruiser、夜間監視スクリプトがある。

ただし、`lint:docs`は常に成功する暫定スタブであり、Markdownの実質的な検査は行っていない。

### 1.2 評価

主要業務を支える機能量とテスト資産は十分に蓄積されている。

現在の主要課題は、機能不足よりも、同一責務の複数経路、データ正本の曖昧さ、生成資料と実装のずれ、運用ゲートの複雑化である。

引継ぎ時に最初に確認すべき対象は、画面の追加要望ではない。

最初に、日次記録、スケジュール、利用者、出欠・送迎の正本と同期境界を確定する必要がある。

次に、実際のルートとHub、機能メタデータ、生成済みシステムマップを同期させる必要がある。

### 1.3 未検証

SharePoint上のリスト名、列、選択肢、件数、インデックス、権限は未検証である。

Firestoreのテレメトリ収集状況と保持方針は未検証である。

LocalStorageに残る既存データと、複数端末間の整合性は未検証である。

成熟度評価はコード構造とテスト資産に基づく評価であり、本番利用実績を表さない。

---

## 2. システム全体像と技術スタック

### 2.1 システムのレイヤー

| レイヤー | 主な責務 | 主なモジュール |
| --- | --- | --- |
| 現場実行 | 当日の判断、記録、共有、看護 | `today`、`daily`、`handoff`、`nurse`、`kiosk` |
| 計画・分析 | アセスメント、支援計画、モニタリング、行動分析 | `assessment`、`planning-sheet`、`support-plan-guide`、`monitoring`、`analysis`、`ibd` |
| 運営 | 予定、送迎、設備・職員配置 | `schedules`、`transport-assignments`、`resources`、`operationFlow` |
| 統制 | 監査、自己点検、制度遵守、例外、記録品質 | `audit`、`compliance-checklist`、`regulatory`、`safety`、`exceptions`、`record-quality` |
| 基盤 | 認証、利用者・職員、状態管理、診断、計測 | `auth`、`users`、`staff`、`attendance`、`sp`、`diagnostics`、`telemetry`、`settings` |
| 出力・請求 | 月次、提供実績、請求、国保連、帳票 | `records`、`service-provision`、`billing`、`kokuhoren-*`、`official-forms`、`reports` |

### 2.2 技術スタック

| 区分 | 採用技術 | 用途 |
| --- | --- | --- |
| UI | React 18 | SPA画面とコンポーネント |
| 言語 | TypeScript | 型定義、ドメインロジック、テスト |
| ビルド | Vite 7 | 開発サーバー、ビルド、プレビュー |
| ルーティング | React Router 6 | ルート合成、リダイレクト、ネスト |
| UIライブラリ | MUI 7、Mantine 8 | 業務画面、リッチエディタ周辺 |
| 状態管理 | Zustand、TanStack Query | クライアント状態、非同期キャッシュ |
| 認証 | MSAL Browser、MSAL React | Entra ID認証、トークン取得 |
| 主永続化 | SharePoint Online REST、PnP/SP | 業務データ、マスタ、監査 |
| 補助永続化 | LocalStorage、Firestore | 一時状態、オフライン補完、テレメトリ |
| スケジュールUI | FullCalendar | カレンダー、タイムライン |
| 検証 | Zod | 入力、SharePoint行、設定値の検証 |
| 単体・統合テスト | Vitest、Testing Library、MSW | ロジック、フック、UI、APIモック |
| E2E | Playwright | 画面遷移、主要業務フロー、a11y |
| 品質 | ESLint、TypeScript、dependency-cruiser、Lighthouse CI | 静的検査、依存境界、性能 |

### 2.3 実行モード

`src/lib/createRepositoryFactory.ts` は、実行環境から`demo`または`real`を選択する。

テスト、開発、デモ、ログイン省略、SharePoint省略、SPFxコンテキスト不足では、原則としてInMemory実装が選ばれる。

`VITE_FORCE_SHAREPOINT=true`を指定した場合は、SharePoint実装を優先する。

したがって、通常のローカル開発画面が正常でも、本番相当のSharePoint経路が検証済みとは限らない。

---

## 3. ルート、Hub、機能モジュールの棚卸し

### 3.1 ルート合成方式

`src/app/router.tsx` は、画面を直接大量定義しない。

次のルート群を配列として合成する。

| ルート群 | 主なパス | 主な対象 |
| --- | --- | --- |
| `dashboardRoutes` | `/`、`/dashboard`、`/today`、`/ops` | ダッシュボード、Today、運用指標 |
| `hubRoutes` | `/planning`、`/operations`、`/master`、`/platform`、`/severe` | 独立Hub |
| `dailyRoutes` | `/dailysupport`、`/daily/*` | 日次記録、出欠、健康記録 |
| `recordRoutes` | `/records/*`、`/billing`、`/handoff-*`、`/meeting-minutes/*` | 記録、請求、申し送り、議事録 |
| `analysisRoutes` | `/analysis/*`、`/assessment`、`/support-review` | 分析、アセスメント、見直し |
| `supportPlanRoutes` | `/support-plan-guide`、`/planning-sheet-list`、`/support-planning-sheet/:planningSheetId` | 支援計画 |
| `ibdRoutes` | `/ibd` | 強度行動障害支援Hub |
| `adminRoutes` | `/admin/*`、`/users/*`、`/staff/*`、`/checklist`、`/audit` | 管理、マスタ、診断、監査 |
| `safetyRoutes` | `/incidents`、`/exceptions`、`/exceptions/audit` | 安全、例外、通知監査 |
| `scheduleRoutes` | `/schedules/week`、旧URLリダイレクト | スケジュール |
| `transportRoutes` | `/transport/assignments`、`/transport/execution` | 送迎 |
| `callLogRoutes` | `/call-logs` | 電話・連絡ログ |
| `kioskRoutes` | `/kiosk/*` | 現場キオスク |
| `nurseRoutes` | `/nurse/*` | 看護記録 |

### 3.2 canonical routeと互換ルート

スケジュールのcanonical routeは`/schedules/week`である。

`/schedule`、`/schedule/*`、`/schedule-ops`、`/schedules`、`/schedules/unified`、`/schedules/create`は、`/schedules/week`へ誘導される。

`/schedules/day`、`/schedules/month`、`/schedules/timeline`も、統合ページのタブまたはクエリへ変換される。

日次記録の入口は`/dailysupport`である。

`/daily`と`/daily/menu`は`/dailysupport`へ誘導される。

利用者詳細の旧パス`/users/:userId`は、`/users/hub/:userId`側へ誘導される。

互換ルートは既存ブックマークを保護するが、仕様書、テスト、問い合わせ対応でURLの重複を生む。

新規資料ではcanonical routeと互換ルートを区別する必要がある。

### 3.3 Hub構成

Hub定義は`src/app/hubs/hubDefinitions.ts`に集約される。

| Hub | ルート | 主な導線 |
| --- | --- | --- |
| Today | `/today` | 支援手順、出欠、日次記録、申し送り、送迎、健康記録 |
| Schedules | `/schedules/week` | 週間予定、統合リソース、送迎配車 |
| Records | `/records` | 記録一覧、月次、提供実績、業務日誌、申し送り分析 |
| Planning | `/planning` | 個別支援計画、支援計画シート、アセスメント、モニタリング、分析 |
| Operations | `/operations` | 運用指標、職員勤怠、設備、例外、制度遵守 |
| Billing | `/billing` | 請求、提供実績 |
| Master | `/master` | 利用者、職員、支援活動テンプレート |
| Platform | `/platform` | 管理ツール、自己点検、監査、診断、テレメトリ |
| Intensive Support | `/severe` | 支援計画シート、行動分析 |

Hubは業務上の入口であり、機能モジュールの所有境界ではない。

同一画面が複数Hubから参照されるため、Hub件数と画面件数を一致させてはならない。

### 3.4 権限と機能ゲート

| ガード | 主な役割 |
| --- | --- |
| `RequireAudience` | `viewer`、`reception`、`admin`の最低ロールを要求する |
| `ProtectedRoute` | 認証完了を要求する |
| `ProtectedRoute flag="..."` | 認証に加えて機能フラグを要求する |
| `AdminSurfaceRouteGuard` | 管理・分析面の公開範囲を制御する |
| `SchedulesGate` | スケジュール機能の利用条件を制御する |
| `IcebergPdcaGate` | 氷山PDCAの閲覧・編集条件を制御する |

`/compliance`は`viewer`向けに公開されているが、対象コミットでは「近日公開」のプレースホルダである。

### 3.5 機能ディレクトリとメタデータのずれ

`system-map.md`と`feature-inventory.md`は、`src/features`配下を57ディレクトリとして扱う。

`scripts/system-map/metadata.ts`は、そのうち53モジュールをレイヤーと成熟度へ分類する。

次の実ディレクトリは、メタデータに定義がない。

| 対象 | 確認結果 | 評価 |
| --- | --- | --- |
| `admin` | 実ディレクトリが存在する | 単一業務ではなく管理画面用設定・入口の集合であり、PlatformまたはRouting Supportとして分類要確認 |
| `kiosk` | 実ディレクトリと`/kiosk/*`ルートが存在する | 現場実行レイヤーとして分類する候補 |
| `record-quality` | 実ディレクトリと`/records/quality-review`ルートが存在する | GovernanceまたはOutput Qualityとして分類する候補 |
| `sp` | 実ディレクトリが存在し、Todayの接続劣化表示などから参照される | Platform Infraとして分類する候補 |

計画に記載された`iceberg-pdca`は、対象コミットでは独立した公開エントリを確認できなかった。

氷山PDCAの実装は主に`src/features/ibd/analysis/pdca`配下にある。

`src/lib/createRepositoryFactory.ts`のコメントには`features/iceberg-pdca/repositoryFactory.ts`が残るが、対象コミットでは同ファイルを確認できない。

この記述は、過去構成または設計途中の参照が残っている可能性を示す。

計画に記載された`support`も、対象コミットでは独立した公開エントリを確認できなかった。

実際の支援計画領域は`support-plan-guide`、`planning-sheet`、`shared`、関連ページへ分散している。

### 3.6 機能モジュール一覧

既存生成物とメタデータを突き合わせた57モジュールは、次の通りである。

| 分類 | モジュール | 件数 |
| --- | --- | ---: |
| 現場実行 | `today`、`daily`、`handoff`、`nurse`、`timeline`、`dailyOps`、`meeting`、`meeting-minutes`、`callLogs`、`dashboard` | 10 |
| 計画・分析 | `assessment`、`planning-sheet`、`support-plan-guide`、`ibd`、`analysis`、`monitoring`、`recommendation`、`tag-analytics` | 8 |
| 運営 | `schedules`、`resources`、`transport-assignments`、`operationFlow`、`ops-dashboard`、`planDeployment` | 6 |
| 統制 | `audit`、`compliance-checklist`、`regulatory`、`safety`、`exceptions`、`import` | 6 |
| 基盤 | `users`、`staff`、`auth`、`attendance`、`org`、`telemetry`、`settings`、`cross-module`、`shared`、`operation-hub`、`context`、`diagnostics`、`demo`、`accessibility`、`action-engine` | 15 |
| 出力・請求 | `service-provision`、`kokuhoren-csv`、`kokuhoren-preview`、`kokuhoren-validation`、`billing`、`official-forms`、`records`、`reports` | 8 |
| 分類要確認 | `admin`、`kiosk`、`record-quality`、`sp` | 4 |
| 合計 |  | 57 |

`iceberg-pdca`は`ibd`内の実装名として、`support`は複数支援モジュールの総称として扱う方が、対象コミットの構造に合う。

### 3.7 成熟度の読み方

既存資料の`Core`、`Expanding`、`Infra`、A〜E評価は、コード構造に基づくメタデータである。

「本番運用中」「業務で十分使える」「実データが正しい」を直接保証しない。

特に、ファイル数やテスト数が多いことは、データ契約が一本化されていることを意味しない。

---

## 4. データ連携と永続化方式

### 4.1 SharePoint中心のデータアクセス

主な業務データはSharePointリストに保存される。

共通経路は、`createSpClient`、`createDataProvider`、ドメイン別Repositoryの順に構成される。

Repository Factory適用済みの主要領域は、次の通りである。

- `attendance`
- `billing`
- `daily`
- `schedules`
- `service-provision`
- `staff`
- `support-plan-guide`
- `users`

DataProviderは、SharePointアクセスを抽象化し、フィールド名解決やテスト差し替えを可能にする。

一方で、`handoff`のように`useSP`と専用APIを直接使う領域も残る。

### 4.2 InMemory実装

Repository Factoryを持つ領域は、InMemory実装をデモ・テストで利用する。

この方式により、SharePointへ接続しなくても画面とロジックを確認できる。

一方で、InMemory実装とSharePoint実装のフィールド解決、競合、権限、日付境界、欠損データの挙動は一致しない可能性がある。

本番相当の判断には、SharePointモードの統合テストが必要である。

### 4.3 LocalStorage

LocalStorageは、設定、一時状態、互換データ、補完情報、オフラインキューに使われる。

例として、申し送りの持越日補完、看護記録の未送信キュー、UI状態、提案状態などがある。

LocalStorageは端末単位である。

複数端末で共有すべき業務状態をLocalStorageへ置く場合は、正本ではなく一時補完であることを画面と設計で明示する必要がある。

### 4.4 Firestore

Firestoreは、業務データの主正本ではなく、テレメトリや一部横断機能で利用される。

`/admin/telemetry`はFirestoreのtelemetryコレクションを直接読む。

SharePoint診断とFirestoreテレメトリは、データ基盤も責務も異なる。

### 4.5 状態管理

Zustandは、認証、UI状態、提案状態、各機能のクライアント状態で利用される。

TanStack Queryは、非同期取得とキャッシュ無効化に利用される。

Todayは複数QueryとStoreを集約するため、個別機能の状態変更が集約画面へ反映される条件をテストで固定する必要がある。

### 4.6 データ正本を判断する基準

次の条件を満たす保存先を正本候補とする。

1. 複数端末から同じ結果を取得できる。
2. 更新者、更新日時、履歴または競合情報を追跡できる。
3. 帳票、Today、月次、監査が同じ読み取り経路を利用する。
4. 旧形式と新形式の移行条件が文書化されている。
5. 実SharePointのリスト・列契約とコードが一致する。

---

## 5. 重点機能の深掘り

### 5.1 `schedules`

#### 確認結果

中心画面は`src/features/schedules/routes/WeekPage.tsx`である。

日、週、月、運用、一覧を、URLクエリとタブで統合する。

データアクセスは`ScheduleRepository`を境界とする。

本番相当では`DataProviderScheduleRepository`を使い、デモ・テストでは`InMemoryScheduleRepository`を使う。

認証、ロール、機能フラグ、書き込み可否が別層で制御される。

作成、更新、削除、検索、URL状態、競合検知の実装がある。

#### 評価

基本的なMVPは成立している。

複雑さの主因は、機能不足ではなく、統合ページへ複数の表示モードと運用責務を載せたことにある。

旧URLが多数残るため、利用者と保守担当者が「別画面」と誤認しやすい。

2026-07-13の既存分析では、次の高リスクが指摘されている。

- 運用タブの取得範囲が日次に寄り、週次集計が欠ける可能性
- `Schedules`と`ScheduleEvents`のリスト名の不一致
- Status選択肢の不一致
- `Category`と`serviceType`の物理フィールド衝突
- 動的フィールド解決後の論理キーをマッパーが読まない可能性
- 組織フィルタの未接続
- 送迎割当Repositoryの部分実装

#### 未検証

実SharePointのリスト名、Status値、Category列、既存データ形式は未検証である。

運用週次ビューの取得範囲はテスト未実行である。

#### 引継ぎ判断

スケジュールUIの再設計を先に行わない。

先にSharePoint契約、取得範囲、書き込み条件を固定する。

`schedules-to-be-design.md`は、As-Isの不具合修正と分けて扱う。

### 5.2 `daily`

#### 確認結果

日次記録には、次の2つのFactoryが存在する。

- `src/features/daily/repositoryFactory.ts`
- `src/features/daily/repositories/repositoryFactory.ts`

前者は`DataProviderDailyRecordRepository`を生成し、既定リスト名を`SupportRecord_Daily`とする。

後者は`SharePointDailyRecordRepository`を生成し、`spFetch`とフィールド名取得を直接渡す。

両者は同名の`DailyRecordRepository`契約を返すが、実装とキャッシュ方式が異なる。

#### 評価

同じ契約を返すFactoryが2系統あるため、呼び出し元だけでは保存形式と読み取り範囲を判断しにくい。

既存調査では、DataProvider経路と直接SharePoint経路で、`UserRowsJSON`、親レコードと子行、旧集約リストの扱いが異なる可能性が指摘されている。

この状態では、画面保存が成功しても、月次、帳票、Today、監査が同じ利用者行を読めるとは限らない。

#### 未検証

`SupportRecord_Daily`、`DailyRecordRows`、`DailyActivityRecords`、`DailyRecords`の実データ件数と現役利用状況は未検証である。

同一日付を2つのRepositoryで読んだ結果の一致は未検証である。

#### 引継ぎ判断

削除や統合を先に行わない。

最初に、呼び出し元一覧、実データ形式、同一日付の読込比較を取得する。

正本形式と移行方針を決めた後に、Factoryを一本化する。

### 5.3 `today`

#### 確認結果

`/today`の実画面は`src/pages/today-isolated/TodayOpsPage_v3.tsx`である。

同画面は次の機能を集約する。

- 利用者と出欠のサマリー
- 日次記録の完了状況
- スケジュールレーン
- 送迎状態
- 申し送り
- 例外と期限
- 電話ログ
- Action Engineの提案
- SharePoint接続劣化表示
- キオスク自動更新とテレメトリ

Today自身が業務データの正本を持つというより、各機能の状態を集約して次の行動を提示する。

#### 評価

Todayは現場の価値が高い一方で、結合点が多い。

上流のどれかが空配列、古いキャッシュ、デモ実装、同期失敗になると、Todayの表示だけを見て原因を特定しにくい。

集約画面の修正時は、Today内部だけでなく、各データソースの責務を確認する必要がある。

基準コミットはToday E2Eのモック起動安定化を含み、同画面が現在も品質改善の重点対象であることを示す。

#### 未検証

実データでの自動更新間隔、キャッシュ整合、例外発生時の部分表示は未検証である。

#### 引継ぎ判断

Todayへ新しい業務状態を追加する場合は、正本モジュール、取得失敗時の表示、更新後のQuery無効化、E2E fixtureを同時に定義する。

### 5.4 `handoff`

#### 確認結果

申し送りは`handoffApi.ts`を中心とする専用SharePoint APIを持つ。

取得時は、動的フィールド解決、キャッシュ、リトライ、楽観的更新を利用する。

持越日は`CarryOverDateStore`によるLocalStorage補完を持つ。

一覧は`/handoff-timeline`、分析は`/handoff-analysis`から利用される。

Todayにも`HandoffPanel`として組み込まれる。

#### 評価

SharePoint側の状態とLocalStorage補完状態が合成されるため、端末差の説明が必要である。

専用APIは機能内で高度に整備されているが、共通Repository Factoryと異なるため、保守担当者が同じデータアクセス規約を期待すると誤る。

#### 未検証

持越日がSharePoint列へ完全移行済みか、LocalStorage補完が現在も必要かは未検証である。

#### 引継ぎ判断

LocalStorage補完を削除する前に、実データと全端末の移行条件を確認する。

### 5.5 `planning-sheet`

#### 確認結果

支援計画シートは、単一画面だけでなく、複数のBridgeを持つ意思決定モジュールである。

主なBridgeは次の通りである。

- AssessmentからPlanningへの取込
- 特性アンケートからPlanningへの取込
- MonitoringからPlanningへの戻し
- Planningから日次記録・手順への展開
- 氷山分析からPlanningへの取込

一覧ルートは`/planning-sheet-list`である。

詳細ルートは`/support-planning-sheet/:planningSheetId`である。

#### 評価

このモジュールの価値はCRUDよりも、根拠を保ったデータ変換にある。

Bridgeの入出力型、冪等性、出典、更新履歴を壊さないことが最優先である。

既存棚卸し資料の一部は詳細パラメータを`:id`と記載するが、現在のルートは`:planningSheetId`である。

#### 未検証

実SharePoint上の版管理、過去版比較、Bridge再実行時の重複状況は未検証である。

#### 引継ぎ判断

画面から見えないBridgeを公開APIとして扱い、入力型と出力型の契約テストを維持する。

### 5.6 `users`と`staff`

#### 確認結果

利用者と職員は、どちらも共通Repository Factoryを利用する。

`users`は`DataProviderUserRepository`を本番実装とし、Split WriteとLazy Joinを前提とする。

`staff`は`DataProviderStaffRepository`を本番実装とする。

`/users`は`reception`以上、`/staff`は`admin`、`/staff/attendance`は`reception`以上を要求する。

#### 評価

利用者マスタは、基本情報だけでなく、出欠、送迎、支援計画、タイムラインなど多くの機能から参照される。

Split WriteとLazy Joinは列肥大を抑えるが、付帯リストの同期漏れと旧Repository到達経路を確認する必要がある。

職員マスタと職員勤怠は、同じ`staff`名称でも別の業務責務を持つ。

#### 未検証

`Users_Master`と付帯リストの実データ同期、旧列の残存、旧Repositoryの本番到達性は未検証である。

職員マスタと勤怠リストの整合性は未検証である。

#### 引継ぎ判断

利用者の項目追加時は、基本リスト、付帯リスト、フォーム、一覧、詳細、import、監査の更新範囲を確認する。

### 5.7 `diagnostics`と`telemetry`

#### 確認結果

`diagnostics`は、`drift`、`governance`、`health`、`remediation`に分かれる。

`/admin/status`は`HealthPage`を介して、環境値、SharePoint接続、リスト仕様、運用信号を診断する。

`telemetry`は、イベント計測、集計、可視化を担当する。

`/admin/telemetry`はFirestoreのtelemetryコレクションを表示する。

夜間運用では、SharePointテレメトリ取得、ドリフト台帳、例外サマリー、意思決定、ガバナンス処理がスクリプトとして分かれる。

#### 評価

診断は「現在の構成が正しいか」を調べる。

テレメトリは「実際に何が起きたか」を計測する。

両者を同じダッシュボードや同じデータ正本として扱わない方がよい。

`src/features/diagnostics/index.ts`は空のため、外部からは深いパスを直接参照する構成が残る。

#### 未検証

Firestoreの保持期間、個人情報の除外、イベント欠損、SharePoint診断結果との突合は未検証である。

#### 引継ぎ判断

診断結果、計測値、夜間判定の責務と保存先を運用図に分けて記載する。

---

## 6. テスト、品質ゲート、CI、運用スクリプト

### 6.1 テスト体系

| 種別 | 主な手段 | 対象 |
| --- | --- | --- |
| 型検査 | `npm run typecheck`、`npm run typecheck:full` | ビルド対象、CI全体 |
| Lint | `npm run lint`、`npm run lint:boundaries` | ソース、依存境界 |
| 単体・統合 | Vitest | ドメイン、Repository、フック、UI、契約 |
| 必須PRテスト | `npm run test:ci:required` | 契約、主要機能、smoke |
| E2E | Playwright | 画面遷移、業務フロー、SharePoint stub |
| a11y | jest-axe、Playwright a11y | 主要画面のアクセシビリティ |
| 性能 | Lighthouse CI、Web Vitals | ビルド、画面性能 |
| アーキテクチャ | dependency-cruiser | モジュール依存 |

### 6.2 Quality Gates

`.github/workflows/test.yml`は、TypeScript、ESLint、必須Vitestを主要ゲートとする。

機能別mini testは実行されるが、`continue-on-error: true`である。

Playwrightと性能テストは、変更パス、main push、手動実行などの条件で実行範囲が変わる。

PRで`ci_full`対象となる場合は、`quality_extended`が追加実行される。

ドキュメントのみの変更では、アプリE2Eと性能テストを省略する設計である。

### 6.3 Nightly Health

`.github/workflows/nightly-health.yml`はJST 03:00に実行される。

主な処理は次の通りである。

- `npm run health`
- 送迎のcritical E2E
- 夜間E2E
- Lighthouse CIとWeb Vitals
- `typecheck:full`

`typecheck:full`は`continue-on-error: true`であり、現時点では非ブロッキングである。

`npm run test:ci`は`--dangerouslyIgnoreUnhandledErrors`を指定する。

Worker異常終了などが成功扱いになる可能性があるため、ジョブ結果だけでなくログとartifactを確認する必要がある。

`npm run health`は、typecheck、lint、Vitestをセミコロンで連結している。

途中の失敗が最終終了コードへ反映されない可能性があるため、各処理を独立ステップまたは`&&`で接続する方が判定しやすい。

### 6.4 Nightly Patrolと運用スクリプト

`package.json`には、次の運用系処理がある。

- SharePointテレメトリ取得
- テレメトリレーンの検証
- artifact安全性検査
- OSメトリクス生成
- 夜間生サマリー取得
- 管理画面・例外センターのサマリー出力
- 夜間意思決定
- ドリフト台帳生成
- ガバナンス判定
- zombieデータ削除

`nightly:maintenance`は監視と判定までを実行する。

`nightly:maintenance:full`は削除処理まで含む。

削除を伴う処理は、監視・提案処理と同じ権限・実行条件にしない方がよい。

### 6.5 ドキュメント検査

`npm run lint:docs`は実行可能である。

ただし、`scripts/lint-docs.cjs`は常に終了コード0を返す暫定スタブである。

現状の`lint:docs`成功は、見出し、リンク、表、Markdown構文が正しいことを保証しない。

ドキュメント変更では、参照パス、見出し階層、表の列数、相対リンクを別途確認する必要がある。

---

## 7. リスクと未整備領域

### 7.1 P0: データ正本を確定する

| 対象 | リスク | 最初の確認 |
| --- | --- | --- |
| 日次記録 | 2系統のRepositoryと複数保存形式 | 同一日付を両Repositoryで読み、利用者行と監査情報を比較する |
| スケジュール | リスト名、Status、Category、serviceTypeの契約差 | 実SharePointのリストと列をread-onlyで取得する |
| 利用者 | 基本リストと付帯リストの同期漏れ | 代表利用者の全関連リストを突合する |
| 出欠・送迎 | 予定、現在状態、実績、監査履歴の責務重複 | `Schedules`、`Transport_Log`、`AttendanceDaily`の状態遷移を確認する |

### 7.2 P1: 構造資料を現在実装へ合わせる

- `scripts/system-map/metadata.ts`へ未分類モジュールを追加する。
- `system-map-v2.md`と`system-map-v2.json`を再生成する。
- canonical routeと互換ルートを一覧化する。
- Hubと機能所有境界を分けて記載する。
- `iceberg-pdca`と`support`の独立モジュール扱いを確認する。
- `createRepositoryFactory.ts`の古い参照コメントを確認する。

### 7.3 P1: 品質判定の偽陽性を減らす

- `lint:docs`へ実際のMarkdown検査を導入する。
- `test:ci`の未処理エラー無視を限定または廃止する。
- `health`を独立ステップまたはfail-fastへ変更する。
- `typecheck:full`を非ブロッキングにする期限と解除条件を決める。
- mini testの失敗を可視化し、無期限の任意扱いにしない。

### 7.4 P1: スケジュール機能の理解負荷を下げる

- `/schedules/week`を唯一の通常入口として説明する。
- 旧URLは互換ルートとして別表へ移す。
- day、week、month、ops、listの役割を画面上で説明する。
- 未接続フィルタや部分実装機能は非表示または未対応表示にする。
- As-Is修正とTo-Be再設計を別PRで扱う。

### 7.5 P2: 運用実績で成熟度を更新する

- Hub別、画面別の利用頻度をテレメトリで確認する。
- SharePointクエリの件数と応答時間を計測する。
- モバイル、キオスク、通常PCの利用条件を分ける。
- a11y違反、Lighthouse、E2E失敗を機能成熟度へ反映する。
- 使用されていないlegacy adapter、route、fallbackを段階的に廃止する。

---

## 8. 引継ぎ時の優先確認事項

### 8.1 最初の1日で確認すること

1. 基準コミットと作業ツリーを確認する。
2. `src/features`の実ディレクトリ一覧を再取得する。
3. `src/app/routes`とHub定義から到達可能画面を再生成する。
4. `repositoryFactory`と直接`useSP`経路を検索する。
5. 日次記録の2系統Factoryの呼び出し元を列挙する。
6. スケジュールの実SharePoint契約をread-onlyで確認する。
7. `Users_Master`と付帯リストの関係を確認する。
8. Nightly Healthの最新ログでWorker異常終了と性能失敗を確認する。

### 8.2 推奨確認コマンド

```powershell
git rev-parse HEAD
git status --short
Get-ChildItem src/features -Directory | Sort-Object Name
Get-ChildItem src/app/routes -File | Sort-Object Name
rg "repositoryFactory|createRepositoryFactory|useSP|createSpClient|createDataProvider" src
rg "ProtectedRoute|RequireAudience|SchedulesGate|IcebergPdcaGate|AdminSurfaceRouteGuard" src/app src/features
rg "localStorage|sessionStorage|zustand|firestore" src/features src/pages
rg "SharePoint|SupportRecord_Daily|DailyRecordRows|Schedules|Transport_Log|AttendanceDaily|Users_Master" src docs scripts
npm run lint:docs
```

`npm run lint:docs`は現状スタブであるため、成功だけで完了判定しない。

### 8.3 実装変更前に確認すること

- 変更対象の正本リストと列
- デモ実装とSharePoint実装の差
- 旧形式の実データ残存
- 複数端末で共有される状態か
- 監査履歴が必要か
- Hub、Today、帳票、月次への影響
- 既存E2E fixtureと機能フラグ
- 互換ルートと既存ブックマーク

---

## 9. 本調査の制約

本調査は静的棚卸しである。

SharePoint実環境とFirestore実環境へ接続していない。

対象コミットのファイルツリーをローカルコマンドで一括再生成していない。

そのため、機能ディレクトリ件数は、対象コミットに含まれる既存生成物と個別パス確認を組み合わせている。

`iceberg-pdca`と`support`の独立ディレクトリ扱いは、ローカル作業ツリーで再確認が必要である。

成熟度、リスク、優先度は、コード構造と既存資料に基づく評価である。

本番利用可否の最終判断には、実データ、権限、業務運用、利用者受入の確認が必要である。

---

## 10. 主な根拠ファイル

### ルーティングとHub

- `src/app/router.tsx`
- `src/app/routes/adminRoutes.tsx`
- `src/app/routes/analysisRoutes.tsx`
- `src/app/routes/callLogRoutes.tsx`
- `src/app/routes/dailyRoutes.tsx`
- `src/app/routes/dashboardRoutes.tsx`
- `src/app/routes/hubRoutes.tsx`
- `src/app/routes/ibdRoutes.tsx`
- `src/app/routes/kioskRoutes.tsx`
- `src/app/routes/recordRoutes.tsx`
- `src/app/routes/safetyRoutes.tsx`
- `src/app/routes/scheduleRoutes.tsx`
- `src/app/routes/supportPlanRoutes.tsx`
- `src/app/routes/transportRoutes.tsx`
- `src/app/hubs/hubDefinitions.ts`
- `src/features/nurse/routes/NurseRoutes.tsx`

### データアクセス

- `src/lib/createRepositoryFactory.ts`
- `src/features/schedules/repositoryFactory.ts`
- `src/features/daily/repositoryFactory.ts`
- `src/features/daily/repositories/repositoryFactory.ts`
- `src/features/users/repositoryFactory.ts`
- `src/features/staff/repositoryFactory.ts`
- `src/features/handoff/handoffApi.ts`

### 重点画面と基盤

- `src/pages/today-isolated/TodayOpsPage_v3.tsx`
- `src/app/routes/RecordQualityHumanReviewRoute.tsx`
- `src/pages/HealthPage.tsx`
- `src/pages/admin/TelemetryDashboardPage.tsx`
- `src/features/diagnostics/index.ts`

### テストと運用

- `package.json`
- `.github/workflows/test.yml`
- `.github/workflows/nightly-health.yml`
- `scripts/lint-docs.cjs`
- `scripts/system-map/metadata.ts`
- `scripts/generate-system-map-v2.ts`

### 既存資料

- `README.md`
- `docs/architecture/feature-inventory.md`
- `system-map.md`
- `system-map-v2.md`
- `docs/reports/schedule-feature-analysis-2026-07-13.md`
