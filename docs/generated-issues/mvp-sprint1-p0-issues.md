# GitHub Issue 一括起票用 — MVP P0 (7件)

> mvp-backlog.md の P0 Issue を `/issue` ワークフロー準拠フォーマットで生成。
> `gh issue create` でそのまま起票可能。

---

## Issue分割計画

| # | Issue タイトル | 依存 | 優先度 | 見積もり |
|---|--------------|------|:------:|---------:|
| 1 | `feat(ui): EmptyStateAction 共通コンポーネント` | なし | P0 | 2h |
| 2 | `feat(today): ActionQueueCard — 未入力キュー表示` | #1 推奨 | P0 | 4h |
| 3 | `feat(users): UserDetailPage ハブ化再設計` | #1 推奨 | P0 | 6h |
| 4 | `feat(daily): 構造化タグ・次遷移追加` | なし | P0 | 4h |
| 5 | `feat(ui): ContextPanel — 同時参照サイドパネル` | なし | P0 | 6h |
| 6 | `feat(control): ExceptionTable — 例外一覧テーブル` | #1 推奨 | P0 | 4h |
| 7 | `feat(control): ExceptionCenterPage 最小版` | #6 | P0 | 3h |

---

## Issue 1/7

## `feat(ui): EmptyStateAction 共通コンポーネント`

### 概要
全画面で使用する「行動指向のエンプティステート」共通コンポーネントを作成する。

### 背景
要件定義書 §3 情報設計原則 #8 で「行動指向のエンプティステート」が定義されている。現状は各画面で空状態表示がバラバラで、ユーザーが「次に何をすべきか」が分からない。MVPの全画面で統一的に使用する基盤コンポーネント。

### 要件
#### 必須（P0）
- [ ] `src/components/ui/EmptyStateAction.tsx` を新規作成
- [ ] Props: `icon`, `title`, `description`, `actionLabel`, `onAction`
- [ ] 3バリアント: `success`（全完了✅）、`info`（データなし）、`warning`（要対応）
- [ ] アクションボタンクリックでコールバック実行

#### 任意（P1）
- [ ] フェードインアニメーション
- [ ] アイコンの軽微パルスアニメーション

### 技術的な方針
- 変更対象: `src/components/ui/EmptyStateAction.tsx`（新規）
- アプローチ: MUI の Box + Typography + Button で構成。バリアントは `color` prop で制御
- 注意点: 既存の空状態表示（散在）との段階的置換を想定。初回は共通コンポーネント作成のみ

### 受入条件
- [ ] 3バリアント（success/info/warning）が正しく表示される
- [ ] アクションボタンが機能する
- [ ] 既存テストが通ること
- [ ] ユニットテストが追加されていること

### 関連
- Blocks: MVP-002, MVP-003, MVP-006（推奨利用先）
- Related: 要件定義書 §3 情報設計原則 #8, Screen Catalog 付録

### ラベル
`feat`, `ui`, `P0`, `sprint-1`, `mvp`

---

## Issue 2/7

## `feat(today): ActionQueueCard — 未入力キュー表示`

### 概要
Today 画面に「未入力キュー」を表示し、現場職員が残タスクを一目で把握できるようにする。

### 背景
Today 画面は「やって消す」画面だが、現状は `NextActionCard` が次の1件を示すのみで、全体の未処理数と種別を俯瞰できない。要件定義書 §4.2 で「完了したタスクは即座にキューから消える」と定義。

### 要件
#### 必須（P0）
- [ ] `src/features/today/widgets/ActionQueueCard.tsx` を新規作成
- [ ] 3カテゴリ集約: 未入力記録 / 未確認申し送り / 未完了タスク
- [ ] 各項目クリックで対象画面へ直接遷移
- [ ] 完了項目はリアルタイムにキューから除去
- [ ] `TodayBentoLayout.tsx` に BentoCard として追加（NextAction 直下）

#### 任意（P1）
- [ ] カテゴリ別のカウントバッジアニメーション
- [ ] 全件完了時に EmptyStateAction で "完了 🎉" 表示

### 技術的な方針
- 変更対象: `src/features/today/widgets/ActionQueueCard.tsx`（新規）, `TodayBentoLayout.tsx`（追加）
- アプローチ: `useSupportRecordCompletion` + `useTodayTasks` からデータ集約
- 注意点: `TodayBentoLayout` の Props 型 `TodayBentoProps` の拡張が必要

### 受入条件
- [ ] 3カテゴリの未処理件数が正しく表示される
- [ ] クリックで対象画面へ遷移する
- [ ] モバイル1カラム / PC横並び表示
- [ ] 既存テストが通ること
- [ ] キュー件数計算のユニットテストが追加されていること

### 関連
- Depends on: #1（EmptyStateAction）推奨
- Related: Screen Catalog A1 TodayPage
- Blocks: MVP-009（Today 役割別表示切替）

### ラベル
`feat`, `today`, `P0`, `sprint-1`, `mvp`

---

## Issue 3/7

## `feat(users): UserDetailPage ハブ化再設計`

### 概要
`/users/:userId` を編集フォーム中心からハブ画面に再設計し、注意事項の常時表示と「記録/計画/分析」への1タップ遷移を実現する。

### 背景
Screen Catalog A3 で「利用者の全情報へのハブ画面」として定義。現状は編集フォーム中心で、注意事項確認や関連画面への導線が弱い。現場職員が利用者を選択した際の起点として機能させる。

### 要件
#### 必須（P0）
- [ ] `UserDetailPage.tsx` をハブレイアウトに再設計
- [ ] `CriticalNoticeBar` — アレルギー・禁忌・特別対応の常時上部表示
- [ ] `QuickActionGroup` — 3ボタンCTA（📝記録 / 📋計画 / 📊分析）
- [ ] 直近3日の記録サマリー表示
- [ ] 既存の編集機能を「編集」ボタンで展開するセカンダリ操作に降格

#### 任意（P1）
- [ ] リスクスコア表示（`riskScoring.ts` 接続）
- [ ] 関連ドキュメント一覧（支援計画リスト / モニタリング履歴）

### 技術的な方針
- 変更対象: `src/pages/UserDetailPage.tsx`（再設計）
- アプローチ: 既存の編集ロジックは保持しつつ、ラッパーとしてハブレイアウトを追加
- 注意点: 既存の編集テストを壊さないこと。編集UIは `Accordion` or `Dialog` で展開式にする

### 受入条件
- [ ] 注意事項が画面上部に常時表示される
- [ ] 「記録する」→ DailyRecordPage へ userId 付き遷移
- [ ] 「計画を見る」→ SupportPlanGuide or PlanningSheet へ遷移
- [ ] 「分析を見る」→ AnalysisWorkspace へ遷移
- [ ] 既存の編集テストが通ること
- [ ] モバイルでカード型スタック表示

### 関連
- Depends on: #1（EmptyStateAction）推奨
- Related: Screen Catalog A3

### ラベル
`feat`, `users`, `P0`, `sprint-1`, `mvp`

---

## Issue 4/7

## `feat(daily): 構造化タグ・次遷移追加`

### 概要
日次記録入力に構造化タグ（チップ型）と保存後の「次の未入力へ」遷移を追加する。

### 背景
要件定義書 §9.1 #10 で「構造化タグとテンプレ入力」がMVP必須と定義。また §4.4 で「保存後に次の未入力へ遷移可能」が要件化されている。記録入力の構造化と連続入力フローにより、入力効率が向上する。

### 要件
#### 必須（P0）
- [ ] `tags: string[]` フィールドをフォームに追加（MUI Autocomplete + Chip）
- [ ] 既存 `behaviorTag.ts` のタグ定義からサジェスト表示
- [ ] `resolveNextUser.ts` 拡張: 保存後「→ 次の未入力へ」ボタン表示
- [ ] `completionStatus: 'draft' | 'complete'` で下書き/完了を区別

#### 任意（P1）
- [ ] タグの利用頻度によるサジェスト順序の最適化

### 技術的な方針
- 変更対象: `TableDailyRecordForm.tsx`, `resolveNextUser.ts`
- アプローチ: Autocomplete freeSolo + Chip で実装。タグマスタは `behaviorTag.ts` を活用
- 注意点: SharePoint スキーマへのタグ列追加は別Issue。初回は localStorage 保存

### 受入条件
- [ ] タグがチップ型UIで入力・表示される
- [ ] サジェストが動作する
- [ ] 「次の未入力へ」ボタンクリックで次ユーザーへ遷移する
- [ ] 下書き/完了が表示上区別される
- [ ] 既存テストが通ること

### 関連
- Related: Screen Catalog A2, MVP-016（SaveBar — P2）

### ラベル
`feat`, `daily`, `P0`, `sprint-1`, `mvp`

---

## Issue 5/7

## `feat(ui): ContextPanel — 同時参照サイドパネル`

### 概要
記録入力中や計画編集中に、関連情報を同時参照できる汎用サイドパネルを作成する。

### 背景
要件定義書 §4.5 で「過去記録・前回計画・バイタル等を同時参照可能」と定義。Screen Catalog で B2 PlanningSheetPage と A2 DailyRecordPage の双方で使用するため、汎用コンポーネントとして設計。コンテキストスイッチの最小化が目的。

### 要件
#### 必須（P0）
- [ ] `src/components/ui/ContextPanel.tsx` を汎用コンポーネントとして作成
- [ ] PC: 右サイドに固定幅（320px）で常時表示
- [ ] モバイル: 折りたたみ式ドロワー（ボタンで展開/収納）
- [ ] スロット型設計: children で表示内容を注入
- [ ] B2 PlanningSheetPage に初回統合

#### 任意（P1）
- [ ] タブ型切替（過去記録 / 提案 / 参照情報）
- [ ] パネル幅のリサイズ対応
- [ ] A2 DailyRecordPage への統合

### 技術的な方針
- 変更対象: `src/components/ui/ContextPanel.tsx`（新規）, `SupportPlanningSheetPage.tsx`（レイアウト変更）
- アプローチ: MUI Drawer (permanent/persistent 切替) + useMediaQuery で responsive
- 注意点: PlanningSheet は既に多数のセクションがある。レイアウト変更は css grid で対応

### 受入条件
- [ ] PC幅で右サイドに固定表示される
- [ ] モバイルでボタンにより展開/収納できる
- [ ] PlanningSheetPage で動作する
- [ ] 表示内容がスロット型でカスタマイズ可能
- [ ] 既存テストが通ること

### 関連
- Blocks: MVP-017（SuggestionPanel）
- Related: Screen Catalog B2

### ラベル
`feat`, `ui`, `P0`, `sprint-1`, `mvp`

---

## Issue 6/7

## `feat(control): ExceptionTable — 例外一覧テーブル`

### 概要
未記入・期限超過を統一テーブルで表示する汎用例外管理コンポーネントを作成する。

### 背景
要件定義書 §4.7 で「平常値の全表示は避け、閾値超過のみ強調」と定義。管理者が例外を一覧で確認し、即座にドリルダウンできるUIが Control Layer の基盤となる。

### 要件
#### 必須（P0）
- [ ] `src/components/ui/ExceptionTable.tsx` を汎用コンポーネントとして作成
- [ ] 列構成: 種別 / 対象 / 緊急度 / 状態 / アクション
- [ ] 緊急度順デフォルトソート、種別・状態フィルタ
- [ ] `src/domain/control/exceptionAggregator.ts` — 例外集約ロジック（純粋関数）
- [ ] 最小版は 2 種類: 未入力記録 + モニタリング期限超過

#### 任意（P1）
- [ ] インシデント集中の例外追加
- [ ] スタッフ負荷偏在の例外追加
- [ ] 行クリック → DrilldownDrawer 展開

### 技術的な方針
- 変更対象: `src/components/ui/ExceptionTable.tsx`（新規）, `src/domain/control/exceptionAggregator.ts`（新規）
- アプローチ: MUI DataGrid or Table + 純粋関数による集約。データソースは `DailyRecordRepository` + `monitoringSchedule.ts`
- 注意点: `domain/control/` は新規ディレクトリ。命名規約を既存パターンに合わせる

### 受入条件
- [ ] 2種類の例外が統一テーブルで表示される
- [ ] 緊急度順ソートが動作する
- [ ] フィルタリングが動作する
- [ ] 例外ゼロ時に EmptyStateAction 表示
- [ ] `exceptionAggregator` のユニットテスト
- [ ] 既存テストが通ること

### 関連
- Depends on: #1（EmptyStateAction）推奨
- Blocks: #7（ExceptionCenterPage）, MVP-011（DrilldownDrawer）

### ラベル
`feat`, `control`, `P0`, `sprint-1`, `mvp`

---

## Issue 7/7

## `feat(control): ExceptionCenterPage 最小版`

### 概要
管理者専用の例外管理ハブ画面を作成し、Control Layer の最小版を立ち上げる。

### 背景
Screen Catalog C2 で定義された完全新規画面。管理者が「まず例外を見る → 3クリックで対象特定」を実現する。これにより 3レイヤ（Execution / Synthesis / Control）すべてに画面が存在する状態が成立する。

### 要件
#### 必須（P0）
- [ ] `src/pages/ExceptionCenterPage.tsx` を新規作成
- [ ] ルート `/admin/exceptions` を `appRoutePaths.ts` に追加
- [ ] `navigationConfig.ts` の管理者セクションに導線追加
- [ ] 上部: 例外件数サマリー（Typography、将来 HeroMetricCard に昇格）
- [ ] 中央: ExceptionTable（#6）
- [ ] `isAdmin` 権限ガード

#### 任意（P1）
- [ ] HeroMetricCard による KPI 表示
- [ ] DrilldownDrawer 統合

### 技術的な方針
- 変更対象: `src/pages/ExceptionCenterPage.tsx`（新規）, `appRoutePaths.ts`, `navigationConfig.ts`, `lazyPages.tsx`
- アプローチ: lazy import + Suspense。管理者ガードは既存の `isAdmin` チェック流用
- 注意点: `appRoutePaths.ts` への追加時に Nav↔Router 一貫性テストの更新が必須

### 受入条件
- [ ] `/admin/exceptions` でアクセス可能
- [ ] 非管理者はリダイレクトまたは非表示
- [ ] ExceptionTable が正しく表示される
- [ ] サイドナビ「管理ツール」に導線がある
- [ ] Nav↔Router 一貫性テストが通る
- [ ] 既存テストが通ること

### 関連
- Depends on: #6（ExceptionTable）
- Blocks: MVP-011（DrilldownDrawer）, MVP-018（CorrectionActionForm）
- Related: Screen Catalog C2

### ラベル
`feat`, `control`, `P0`, `sprint-1`, `mvp`
