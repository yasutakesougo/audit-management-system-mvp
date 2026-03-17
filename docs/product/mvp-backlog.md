# 福祉オペレーションOS — MVP Backlog v1

> **ドキュメント種別:** MVPバックログ（Issue分解版）  
> **ステータス:** Draft  
> **初版:** 2026-03-17  
> **最終更新:** 2026-03-17  
> **準拠:** [要件定義書](welfare-operations-os-requirements-v1.md) / [Screen Catalog](screen-catalog.md) / [ロードマップ](roadmap.md)

---

## 目次

- [Part 1: バックログ一覧](#part-1-バックログ一覧)
- [Part 2: Issue 詳細](#part-2-issue-詳細)
  - [Epic A: Execution Layer 強化](#epic-a-execution-layer-強化)
  - [Epic B: Synthesis Layer 強化](#epic-b-synthesis-layer-強化)
  - [Epic C: Control Layer 立ち上げ](#epic-c-control-layer-立ち上げ)
  - [Epic D: 共通基盤](#epic-d-共通基盤)
- [Part 3: 実装順序](#part-3-実装順序)
- [変更履歴](#変更履歴)

---

## Part 1: バックログ一覧

### 凡例

| 記号 | 意味 |
|------|------|
| **P0** | MVP成立に必須 |
| **P1** | 現場運用で強く効く |
| **P2** | 管理者価値を上げる |
| **P3** | Polish / 拡張 |
| **EXT** | 既存画面を拡張するIssue |
| **NEW** | 完全新規のIssue |

### 全Issue一覧

| ID | Priority | Epic | Type | Summary | Screen | 依存 |
|----|----------|------|------|---------|--------|------|
| MVP-001 | P0 | D | NEW | `EmptyStateAction` 共通コンポーネント作成 | 全画面 | — |
| MVP-002 | P0 | A | NEW | `ActionQueueCard` — 未入力キュー表示 | A1 Today | — |
| MVP-003 | P0 | A | EXT | UserDetailPage ハブ化再設計 | A3 | — |
| MVP-004 | P0 | A | EXT | DailyRecord に構造化タグ・次遷移を追加 | A2 | — |
| MVP-005 | P0 | B | NEW | `ContextPanel` — 同時参照サイドパネル | A2, B2 | — |
| MVP-006 | P0 | C | NEW | `ExceptionTable` — 例外一覧テーブル | C2 | — |
| MVP-007 | P0 | C | NEW | ExceptionCenterPage — 最小版 | C2 | MVP-006 |
| MVP-008 | P1 | D | NEW | `SyncStatusIndicator` — 同期状態表示 | A1, A2, B2 | — |
| MVP-009 | P1 | A | EXT | Today 役割別表示切替 | A1 | MVP-002 |
| MVP-010 | P1 | C | NEW | `HeroMetricCard` — KPI表示カード | C1, C2 | — |
| MVP-011 | P1 | C | NEW | `DrilldownDrawer` — ドリルダウン詳細 | C1, C2 | MVP-006 |
| MVP-012 | P1 | B | NEW | `DiffViewer` — 差分表示コンポーネント | B2, B3 | — |
| MVP-013 | P1 | B | EXT | Monitoring に前回比較・差分ハイライト追加 | B3 | MVP-012 |
| MVP-014 | P2 | C | NEW | AuditLogPage — 最小版 | C4 | — |
| MVP-015 | P2 | D | EXT | 権限別ナビゲーション強化 | 全画面 | MVP-009 |
| MVP-016 | P2 | A | NEW | `SaveBar` — 保存状態＋次遷移フッター | A2 | MVP-004 |
| MVP-017 | P2 | B | NEW | `SuggestionPanel` — 候補提案表示 | B2, B3 | MVP-005 |
| MVP-018 | P3 | C | NEW | `CorrectionActionForm` — 是正記録 | C2 | MVP-007 |
| MVP-019 | P3 | D | EXT | OperationsDashboard に HeroKPI 統合 | C1 | MVP-010 |
| MVP-020 | P3 | B | EXT | ProposalCard 共通コンポーネント実装 | B2, B3 | MVP-017 |

---

## Part 2: Issue 詳細

---

# Epic A: Execution Layer 強化

> 現場職員が毎日使う画面の高速化と導線改善

---

### MVP-002: `ActionQueueCard` — 未入力キュー表示

**Priority:** P0 | **Type:** NEW | **Screen:** A1 TodayPage | **Epic:** A

#### 背景

Today 画面は「やって消す」画面だが、現状は「何が未完了か」をキュー表示する専用コンポーネントがない。`NextActionCard` は次の1件を示すが、全体の未処理数と種別を俯瞰できない。

#### 目的

現場職員がログイン直後に「今日の残タスク」を一目で把握し、優先順から着手できるようにする。

#### 実装内容

1. `src/features/today/widgets/ActionQueueCard.tsx` を新規作成
2. 未入力記録・未確認申し送り・未完了タスクを 3 カテゴリで集約表示
3. 各項目クリックで対象画面へ直接遷移
4. 完了した項目はリアルタイムにキューから除去
5. `TodayBentoLayout.tsx` に新しい BentoCard として追加（NextAction の直下）

#### データソース

- `useSupportRecordCompletion.ts` — 記録完了率
- `useNextAction.ts` — 未処理アクション
- `useTodayTasks.ts` — タスクエンジン

#### Acceptance Criteria

- [ ] 未入力記録件数・未確認申し送り件数・未完了タスク件数が表示される
- [ ] 各カテゴリのクリックで対象画面へ遷移する
- [ ] 全件完了時に `EmptyStateAction`（MVP-001）で "完了 🎉" 表示
- [ ] モバイルで1カラム、PCで横並び表示
- [ ] ユニットテスト: キュー件数の計算ロジック

#### 依存

- MVP-001（EmptyStateAction）推奨

---

### MVP-003: UserDetailPage ハブ化再設計

**Priority:** P0 | **Type:** EXT | **Screen:** A3 UserDetailPage | **Epic:** A

#### 背景

現在の `/users/:userId` は編集フォーム中心の画面。要件定義書 §4.3 では「利用者の全情報への**ハブ画面**」として、基本情報＋注意事項＋関連画面ショートカットを提供する起点として定義されている。

#### 目的

利用者を選択した際に、注意事項が即座に確認でき、「記録する」「計画を見る」「分析を見る」へ1タップで遷移できるハブ画面を実現する。

#### 実装内容

1. `UserDetailPage.tsx` を ハブレイアウト に再設計
2. `CriticalNoticeBar` — アレルギー・禁忌・特別対応の常時上部表示
3. `QuickActionGroup` — 3ボタン CTA（記録/計画/分析）
4. `RecentRecordSummary` — 直近3日の記録ハイライト（InfoCard）
5. リスク情報カード（`riskScoring.ts` 接続）
6. 既存の編集機能は「編集」ボタンで展開するセカンダリ操作に降格

#### Acceptance Criteria

- [ ] 画面上部に注意事項が常時表示される（CriticalNoticeBar）
- [ ] 「記録する」→ DailyRecordPage へ遷移（userId パラメータ付き）
- [ ] 「計画を見る」→ PlanningSheetPage or SupportPlanGuide へ遷移
- [ ] 「分析を見る」→ AnalysisWorkspace or IcebergAnalysis へ遷移
- [ ] 直近3日の記録が要約表示される
- [ ] モバイルでカード型スタック表示
- [ ] 既存の編集テストが壊れない

#### 依存

なし

---

### MVP-004: DailyRecord に構造化タグ・次遷移を追加

**Priority:** P0 | **Type:** EXT | **Screen:** A2 DailyRecordPage | **Epic:** A

#### 背景

要件定義書 §4.4 で「構造化タグとテンプレ入力」がMVP必須（#10）に含まれている。また「保存後に次の未入力へ遷移」の導線も現場効率に直結する。

#### 目的

記録入力の構造化を進め、保存→次の未入力への連続入力フローを実現する。

#### 実装内容

1. `tags: string[]` フィールドを記録フォームに追加（チップ型入力）
2. 既存 `behaviorTag.ts` のタグ定義を活用したサジェスト
3. `resolveNextUser.ts` を拡張し、保存後の「次の未入力」遷移ボタンを追加
4. `completionStatus: 'draft' | 'complete'` フィールドで下書き/完了を明示

#### Acceptance Criteria

- [ ] タグ入力がチップ型UIで動作する
- [ ] 既存タグ定義からサジェストが表示される
- [ ] 保存後に「次の未入力へ」ボタンが表示され、クリックで遷移する
- [ ] 下書き/完了の状態が表示上区別される
- [ ] 既存の TableDailyRecordForm テストが壊れない

#### 依存

なし

---

### MVP-009: Today 役割別表示切替

**Priority:** P1 | **Type:** EXT | **Screen:** A1 TodayPage | **Epic:** A

#### 背景

要件定義書 §4.2 で「役割別に表示内容が変わる」と定義。現在 Today は全職員に同一UIを表示している。管理者には例外KPIを優先表示し、現場職員にはタスクキューを優先すべき。

#### 目的

ログインユーザーの役割に応じて Today の表示ブロック優先順位を変更する。

#### 実装内容

1. `useTodayLayoutProps.ts` にロール判定ロジック追加
2. 管理者: `ActionQueueCard` の代わりに KPI サマリー優先
3. 現場職員: `ActionQueueCard` → `NextActionCard` → ユーザーリスト の順
4. `navigationConfig.ts` の `NavAudience` を活用

#### Acceptance Criteria

- [ ] 管理者ログイン時に例外KPIが上部に表示される
- [ ] 現場職員ログイン時にタスクキューが優先表示される
- [ ] 表示切替のユニットテスト

#### 依存

- MVP-002（ActionQueueCard）

---

# Epic B: Synthesis Layer 強化

> 支援設計者の計画作成体験を向上させる

---

### MVP-005: `ContextPanel` — 同時参照サイドパネル

**Priority:** P0 | **Type:** NEW | **Screen:** A2, B2 | **Epic:** B

#### 背景

要件定義書 §4.5 で支援計画画面の右側に「コンテキストパネル」を配置し、過去記録・前回計画・バイタル等を同時参照可能にすることが定義されている。Screen Catalog で B2 PlanningSheetPage と A2 DailyRecordPage 双方で使用。

#### 目的

記録入力中や計画編集中に、関連情報を別画面に遷移せず参照できるようにし、コンテキストスイッチを最小化する。

#### 実装内容

1. `src/components/ui/ContextPanel.tsx` を汎用コンポーネントとして作成
2. 右サイドパネル（PC: 固定表示、モバイル: 折りたたみ式ドロワー）
3. スロット型設計: 呼び出し元が表示内容を注入
4. B2 用: 過去記録サマリ / ヒヤリハット / 前回計画 / アセスメント / バイタル / モニタリング履歴
5. A2 用: 当日既存記録 / 前回記録 / 注意事項 / バイタル / 申し送り

#### Acceptance Criteria

- [ ] PC幅で右サイドに固定表示される
- [ ] モバイルで折りたたみボタンで展開/収納できる
- [ ] PlanningSheetPage に統合して動作する
- [ ] スロット型で表示内容をカスタマイズ可能
- [ ] パネル開閉状態が画面遷移で維持される

#### 依存

なし

---

### MVP-012: `DiffViewer` — 差分表示コンポーネント

**Priority:** P1 | **Type:** NEW | **Screen:** B2, B3 | **Epic:** B

#### 背景

UI規約 §4 で「適用後の差分プレビュー」が定義されている。支援計画の版管理（`planningSheetVersion.ts`）と合わせ、前回計画との差分を可視化する必要がある。

#### 目的

支援計画・モニタリングにおいて、前回との変更箇所を視覚的に確認できるようにする。

#### 実装内容

1. `src/components/ui/DiffViewer.tsx` を汎用コンポーネントとして作成
2. フィールド単位の追加/変更/削除をハイライト表示
3. インライン表示（フィールド横にバッジ）とフルビュー（一覧表示）の2モード
4. `planningSheetVersion.ts` のスナップショット比較ロジックと接続

#### Acceptance Criteria

- [ ] 2つのオブジェクトの差分がフィールド単位で表示される
- [ ] 追加=緑、変更=橙、削除=赤のハイライト
- [ ] インライン/フルビューの切替が可能
- [ ] PlanningSheetPage で前回版との差分が表示される
- [ ] ユニットテスト: 差分計算ロジック

#### 依存

なし

---

### MVP-013: Monitoring に前回比較・差分ハイライト追加

**Priority:** P1 | **Type:** EXT | **Screen:** B3 | **Epic:** B

#### 背景

Screen Catalog B3 で「前回との比較」が 📋 新規 と記載。モニタリング結果を前回と比較し、停滞・悪化を目立たせる必要がある。

#### 目的

モニタリング画面で前回評価との差分を可視化し、見直しが必要な目標を明確にする。

#### 実装内容

1. `GoalProgressCard.tsx` に前回スコアとの比較表示を追加
2. 停滞（変化なし）→ 橙バッジ、悪化 → 赤バッジの視覚的トリアージ
3. `DiffViewer`（MVP-012）をモニタリングセクション内に埋め込み
4. 「見直しが必要」な目標を上部にソート

#### Acceptance Criteria

- [ ] 前回モニタリングスコアとの差分が表示される
- [ ] 悪化している目標に赤バッジが付く
- [ ] 各目標で `DiffViewer` による詳細差分が確認できる
- [ ] 既存の GoalProgressCard テストが壊れない

#### 依存

- MVP-012（DiffViewer）

---

### MVP-017: `SuggestionPanel` — 候補提案表示

**Priority:** P2 | **Type:** NEW | **Screen:** B2, B3 | **Epic:** B

#### 背景

Proposal Engine（`proposalBundle.ts`）は型と3ソースアダプターが完成しているが、統合表示UIがまだない。UI規約 §2 の ProposalCard 標準に従い、計画編集中に候補を表示する。

#### 目的

支援計画画面・モニタリング画面で、3ソースからの候補提案を統一UIで表示する。

#### 実装内容

1. `src/components/ui/SuggestionPanel.tsx` を作成
2. `PlanningProposalBundle[]` を受け取り、UI規約 §2 準拠で表示
3. `ContextPanel`（MVP-005）内のタブとして配置
4. 緊急度バッジ + カテゴリラベル + 根拠セクション

#### Acceptance Criteria

- [ ] 3ソース（handoff/abc/monitoring）の提案が統一UIで表示される
- [ ] 緊急度による並び替え（urgent → recommended → suggested）
- [ ] UI規約 §2 の ProposalCard 構造に準拠
- [ ] ContextPanel 内で他の参照情報とタブ切替できる

#### 依存

- MVP-005（ContextPanel）

---

### MVP-020: ProposalCard 共通コンポーネント実装

**Priority:** P3 | **Type:** EXT | **Screen:** B2, B3 | **Epic:** B

#### 背景

UI規約 §2 で定義済みの `<ProposalCard>` 共通コンポーネントが未実装。3ボタン標準（採用/却下/後で確認）、ProposalAdoptionRecord 保存を含む。

#### 実装内容

1. `src/components/ui/ProposalCard.tsx` を UI規約 §2 準拠で作成
2. `ProposalAdoptionRecord` の永続化ロジック
3. 却下理由選択UI（UI規約 §4）
4. `SuggestionPanel`（MVP-017）内で使用

#### Acceptance Criteria

- [ ] UI規約 §2 の基本構造（カテゴリ/緊急度/根拠/3ボタン）に準拠
- [ ] 採用時に `ProposalAdoptionRecord` が保存される
- [ ] 却下時に理由選択UIが表示される
- [ ] 全画面で同一コンポーネントが使用される

#### 依存

- MVP-017（SuggestionPanel）

---

# Epic C: Control Layer 立ち上げ

> 管理者の例外管理・異常検知を新規構築

---

### MVP-006: `ExceptionTable` — 例外一覧テーブル

**Priority:** P0 | **Type:** NEW | **Screen:** C2 | **Epic:** C

#### 背景

要件定義書 §4.7 で「平常値の全表示は避け、閾値超過のみ強調」と定義。管理者が例外を一覧で確認し、即座にドリルダウンできるテーブルが必要。

#### 目的

未記入・期限超過・インシデント集中・負荷偏在を統一テーブルで管理する。

#### 実装内容

1. `src/components/ui/ExceptionTable.tsx` を汎用コンポーネントとして作成
2. 列: 種別 / 対象（利用者 or スタッフ）/ 緊急度 / 状態 / アクション
3. ソート（緊急度優先）・フィルタ（種別・状態）機能
4. 行クリックで DrilldownDrawer（MVP-011）を展開
5. 例外データの集約ロジック: `src/domain/control/exceptionAggregator.ts` を新規作成

#### データソース

| 例外種別 | ソース |
|---------|--------|
| 未入力記録 | `DailyRecordRepository` + 出欠データ |
| 計画期限超過 | `monitoringSchedule.ts` |
| インシデント集中 | `localIncidentRepository.ts` |
| モニタリング遅延 | `monitoringSchedule.ts` |

#### Acceptance Criteria

- [ ] 4種類の例外が統一テーブルで表示される
- [ ] 緊急度順にデフォルトソートされる
- [ ] 種別・状態でフィルタリングできる
- [ ] 行クリックで詳細が確認できる
- [ ] 例外ゼロ時に EmptyStateAction で「異常なし ✅」表示
- [ ] ユニットテスト: exceptionAggregator のロジック

#### 依存

なし

---

### MVP-007: ExceptionCenterPage — 最小版

**Priority:** P0 | **Type:** NEW | **Screen:** C2 | **Epic:** C

#### 背景

Screen Catalog C2 で定義された新規画面。管理者が「まず例外を見る → 3クリックで対象特定」を実現する。

#### 目的

管理者専用の例外管理ハブを構築し、問題発見から対応までの導線を確立する。

#### 実装内容

1. `src/pages/ExceptionCenterPage.tsx` を新規作成
2. ルート: `/admin/exceptions` を `appRoutePaths.ts` と `navigationConfig.ts` に追加
3. 上部: 例外件数サマリー（将来 HeroMetricCard に昇格）
4. 中央: `ExceptionTable`（MVP-006）
5. 管理者権限チェック（`isAdmin` ガード）

#### Acceptance Criteria

- [ ] `/admin/exceptions` でアクセス可能
- [ ] 管理者のみ表示（非管理者はリダイレクト）
- [ ] ExceptionTable が正しく表示される
- [ ] サイドナビの「管理ツール」セクションに導線追加
- [ ] Nav↔Router 一貫性テストが通る

#### 依存

- MVP-006（ExceptionTable）

---

### MVP-010: `HeroMetricCard` — KPI表示カード

**Priority:** P1 | **Type:** NEW | **Screen:** C1, C2 | **Epic:** C

#### 背景

要件定義書 §4.7 で上部 Hero KPI（3〜5件）が定義。未作成計画数 / 未入力率 / インシデント件数 / モニタリング遅延数 / 稼働率 を一目で確認。

#### 実装内容

1. `src/components/ui/HeroMetricCard.tsx` を汎用コンポーネントとして作成
2. Props: `label`, `value`, `threshold`, `trend?`, `onClick?`
3. 閾値超過で警告色に変化（UI規約 §6 準拠）
4. オプション: スパークライン（直近7日トレンド）
5. `HeroMetricRow` — 横並び3〜5枚のレスポンシブコンテナ

#### Acceptance Criteria

- [ ] 値が閾値を超えた場合に `error` 色に変化する
- [ ] クリックで ExceptionTable のフィルタ状態へ遷移する
- [ ] モバイル: 2列、タブレット: 3列、PC: 5列のレスポンシブ
- [ ] ユニットテスト: 閾値判定ロジック

#### 依存

なし

---

### MVP-011: `DrilldownDrawer` — ドリルダウン詳細

**Priority:** P1 | **Type:** NEW | **Screen:** C1, C2, C3 | **Epic:** C

#### 背景

要件定義書 §5.3 で「問題発見から対象特定まで3クリック以内」と定義。ExceptionTable の行クリックで右ドロワーに詳細を表示し、対象の記録/利用者/スタッフへ遷移する。

#### 実装内容

1. `src/components/ui/DrilldownDrawer.tsx` を汎用コンポーネントとして作成
2. MUI `Drawer` の右スライド、`anchor="right"`, 幅 400px
3. ヘッダー: 例外種別＋対象名
4. ボディ: 詳細情報（スロット型）
5. フッター: 「対象を開く」「記録を見る」等のアクションボタン

#### Acceptance Criteria

- [ ] ExceptionTable の行クリックで右からスライド表示される
- [ ] 対象利用者の UserDetailPage へ遷移するリンクがある
- [ ] ESC / 外側クリックで閉じる
- [ ] モバイルでフルスクリーンドロワーに切替

#### 依存

- MVP-006（ExceptionTable）

---

### MVP-014: AuditLogPage — 最小版

**Priority:** P2 | **Type:** NEW | **Screen:** C4 | **Epic:** C

#### 背景

監査ログ基盤（`audit.ts`）は存在するが、閲覧UIがない。制度監査対応で必要。

#### 実装内容

1. `src/pages/AuditLogPage.tsx` を新規作成
2. ルート: `/admin/audit-log`
3. `AuditLogTable` — 操作種別/対象/操作者/日時の一覧
4. 既存 `HandoffAuditLogView` を参考実装として活用
5. フィルタ: 日付範囲、操作種別、操作者

#### Acceptance Criteria

- [ ] 監査ログが時系列で表示される
- [ ] 日付範囲でフィルタリングできる
- [ ] 管理者のみアクセス可能

#### 依存

なし

---

### MVP-018: `CorrectionActionForm` — 是正記録

**Priority:** P3 | **Type:** NEW | **Screen:** C2 | **Epic:** C

#### 背景

要件定義書 §5.3 で「対応履歴を残せる」と定義。例外に対する是正アクションを記録し、組織知として蓄積する。

#### 実装内容

1. `src/features/control/components/CorrectionActionForm.tsx` を作成
2. DrilldownDrawer 内に埋め込み
3. フィールド: 対応内容 / 対応者 / 対応日時 / ステータス
4. localStorage 永続化（将来 SharePoint）

#### Acceptance Criteria

- [ ] DrilldownDrawer 内で是正アクションを記録できる
- [ ] 記録した是正が ExceptionTable の「状態」列に反映される

#### 依存

- MVP-007, MVP-011

---

# Epic D: 共通基盤

> 全レイヤで使用される共通コンポーネントと基盤

---

### MVP-001: `EmptyStateAction` 共通コンポーネント作成

**Priority:** P0 | **Type:** NEW | **Screen:** 全画面 | **Epic:** D

#### 背景

要件定義書 §3 情報設計原則 #8「行動指向のエンプティステート」。空状態でも次の行動を促すUIが必要。現状は各画面で個別に空表示を実装しており統一されていない。

#### 目的

データがない状態でも「次に何をすべきか」を示し、迷子にならないUIを全画面に統一適用する。

#### 実装内容

1. `src/components/ui/EmptyStateAction.tsx` を作成
2. Props: `icon`, `title`, `description`, `actionLabel`, `onAction`
3. バリアント: `success`（全完了）、`info`（データなし）、`warning`（要対応）
4. アニメーション: フェードイン、アイコン軽微パルス

#### Acceptance Criteria

- [ ] 3バリアント（success/info/warning）が表示される
- [ ] アクションボタンクリックでコールバックが実行される
- [ ] 全画面で統一された空状態UIとして使用可能
- [ ] Storybook or VRTスナップショット

#### 依存

なし

---

### MVP-008: `SyncStatusIndicator` — 同期状態表示

**Priority:** P1 | **Type:** NEW | **Screen:** A1, A2, B2 | **Epic:** D

#### 背景

要件定義書 §8.2 で「同期状態を表示」が定義。SharePoint との通信状態を可視化し、オフライン入力の安心感を与える。

#### 実装内容

1. `src/components/ui/SyncStatusIndicator.tsx` を作成
2. 3状態: `synced`（✅ 緑）/ `syncing`（🔄 橙+アニメ）/ `offline`（⚠️ 灰）
3. アプリシェルのヘッダー右端に常時表示
4. クリックで最終同期時刻・エラー詳細をポップオーバー表示

#### Acceptance Criteria

- [ ] 3状態が視覚的に区別できる
- [ ] syncing 状態でスピナーアニメーションが表示される
- [ ] クリックで最終同期時刻が表示される
- [ ] アプリシェルに統合されている

#### 依存

なし

---

### MVP-015: 権限別ナビゲーション強化

**Priority:** P2 | **Type:** EXT | **Screen:** 全画面 | **Epic:** D

#### 背景

`navigationConfig.ts` に `NavAudience` は存在するが、要件定義書 §2 の3役割（現場/支援設計者/管理者）に合わせた最適化が不十分。C層画面の追加に伴いナビを整理。

#### 実装内容

1. `navigationConfig.types.ts` に `designer`（支援設計者）ロール追加
2. サイドナビのグループをレイヤ別に再構成
3. ExceptionCenterPage, AuditLogPage の管理者限定表示
4. B層画面の支援設計者優先表示

#### Acceptance Criteria

- [ ] 現場職員にはA層画面が優先表示される
- [ ] 管理者にはC層画面が追加表示される
- [ ] 既存の Nav↔Router 一貫性テストが通る

#### 依存

- MVP-009（Today 役割別）

---

### MVP-016: `SaveBar` — 保存状態＋次遷移フッター

**Priority:** P2 | **Type:** NEW | **Screen:** A2 | **Epic:** D

#### 背景

要件定義書 §4.4 で「保存状態・次アクション」のフッター表示が定義。オートセーブの状態を可視化し、次の未入力へワンタップ遷移する。

#### 実装内容

1. `src/components/ui/SaveBar.tsx` を作成
2. 左: 保存状態（「💾 自動保存済 18:05」/ 「⏳ 保存中...」/ 「⚠️ 未保存」）
3. 右: 「→ 次の未入力へ」ボタン
4. 画面下部に固定表示（sticky footer）
5. `resolveNextUser.ts` と接続

#### Acceptance Criteria

- [ ] 保存状態が3パターンで表示される
- [ ] 「次の未入力へ」ボタンが機能する
- [ ] 画面スクロールに関係なく下部に固定表示される

#### 依存

- MVP-004（構造化タグ・次遷移）

---

### MVP-019: OperationsDashboard に HeroKPI 統合

**Priority:** P3 | **Type:** EXT | **Screen:** C1 | **Epic:** D

#### 背景

既存 `/dashboard` を要件定義書 §4.7 の 3層構造に拡張。上部に HeroMetricCard、中間に異常値ハイライトを追加。

#### 実装内容

1. `DashboardPage.tsx` の上部に `HeroMetricRow` を追加
2. KPI: 未作成計画数 / 未入力率 / インシデント件数 / モニタリング遅延数 / 稼働率
3. KPIクリックで ExceptionCenterPage へフィルタ付き遷移

#### Acceptance Criteria

- [ ] 5つの HeroMetricCard が表示される
- [ ] 閾値超過で警告色に変化する
- [ ] クリックで ExceptionCenterPage へ遷移する

#### 依存

- MVP-010（HeroMetricCard）

---

## Part 3: 実装順序

### 推奨スプリント計画

```
Sprint 1 (Week 1-2): 基盤 + Execution Layer P0
├─ MVP-001  EmptyStateAction 共通コンポーネント
├─ MVP-002  ActionQueueCard
├─ MVP-003  UserDetailPage ハブ化
└─ MVP-004  DailyRecord 構造化タグ・次遷移

Sprint 2 (Week 3-4): Synthesis + Control P0
├─ MVP-005  ContextPanel
├─ MVP-006  ExceptionTable
└─ MVP-007  ExceptionCenterPage 最小版

Sprint 3 (Week 5-6): P1 強化
├─ MVP-008  SyncStatusIndicator
├─ MVP-009  Today 役割別表示
├─ MVP-010  HeroMetricCard
├─ MVP-011  DrilldownDrawer
└─ MVP-012  DiffViewer

Sprint 4 (Week 7-8): P1-P2 拡張
├─ MVP-013  Monitoring 前回比較
├─ MVP-014  AuditLogPage 最小版
├─ MVP-015  権限別ナビ強化
└─ MVP-016  SaveBar

Sprint 5 (Week 9-10): P2-P3 polish
├─ MVP-017  SuggestionPanel
├─ MVP-018  CorrectionActionForm
├─ MVP-019  Dashboard HeroKPI統合
└─ MVP-020  ProposalCard 共通実装
```

### 依存関係図

```
MVP-001 (EmptyState) ─────────────────────────────────┐
                                                       │
MVP-002 (ActionQueue) ──→ MVP-009 (Today役割別)         │
                                                       │
MVP-003 (UserDetail)                                   │
                                                       │
MVP-004 (DailyRecord拡張) ──→ MVP-016 (SaveBar)        │
                                                       │
MVP-005 (ContextPanel) ──→ MVP-017 (SuggestionPanel)   │
                              └──→ MVP-020 (ProposalCard)
                                                       │
MVP-006 (ExceptionTable) ──→ MVP-007 (ExceptionCenter) │
                          ──→ MVP-011 (DrilldownDrawer) │
                                └──→ MVP-018 (是正記録)  │
                                                       │
MVP-008 (SyncStatus)                                   │
                                                       │
MVP-010 (HeroMetric) ──→ MVP-019 (Dashboard統合)       │
                                                       │
MVP-012 (DiffViewer) ──→ MVP-013 (Monitoring比較)      │
                                                       │
MVP-014 (AuditLog)                                     │
                                                       │
MVP-015 (権限ナビ) ← MVP-009                            │
```

### マイルストーン

| マイルストーン | 時期 | 達成条件 |
|-------------|------|---------|
| **🏁 MS1: OS感の最小成立** | Sprint 2 完了 | A層強化 + C層最小版 → 3レイヤすべてに画面が存在 |
| **🏁 MS2: 実用MVP** | Sprint 4 完了 | 全P0+P1完了 → 現場・支援・管理の全ロールで日常利用可能 |
| **🏁 MS3: 統合完成** | Sprint 5 完了 | 全Issue完了 → ProposalCard までUI統一完了 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-17 | 1.0 | 初版作成 — 20 Issue の完全定義 | プロダクトチーム |
