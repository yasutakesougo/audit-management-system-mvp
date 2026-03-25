# Transport Assignment Page Spec (Phase 1)

`送迎配車表` を通常モードの本画面として追加するための実装仕様。
対象は「当日の迎え/送りの配車登録・編集」で、最小DoDを満たすためのスコープに限定する。

## Goal

- `/today` の閲覧中心UIとは別に、通常運用で配車を編集できる画面を持つ。
- 送迎配車の正本を既存 `Schedules` データで扱い、`/today` の送迎カードに反映させる。
- 4台固定の車両ボードで、運転者未設定・未割当を明確に可視化する。

## Scope

- 追加する画面: `送迎配車表`
- 対象操作:
  - 日付切替
  - 方向切替（`to`/`from`）
  - 車両ごとの運転者設定
  - 利用者の車両割当
  - 保存
- 対象データ: 既存 `Schedules`（`serviceType=transport` 系）を編集元に利用する

## Non-goals (Phase 1)

- ドラッグ&ドロップUI
- 専用永続化ストア（`TransportAssignments` の新設）
- 配車最適化ロジック（自動提案・自動再配置）

## Route / Navigation

### Route

- Path: `/transport/assignments`
- 想定配置: 通常モードのサイドメニュー「現場の実行 (daily)」

### ルート追加差し込み先

1. `src/app/routes/appRoutePaths.ts`
   - `transport/assignments` を追加
2. `src/app/routes/lazyPages.tsx`
   - `TransportAssignmentPage` の lazy import と suspended wrapper を追加
3. `src/app/routes/transportRoutes.tsx` を新規作成
   - `path: 'transport/assignments'` を定義
4. `src/app/router.tsx`
   - `transportRoutes` を compose 配列へ追加
5. `src/app/config/navigationConfig.ts`
   - サイドメニュー項目 `送迎配車表` を `daily` group に追加

## Screen Layout

## Header

- 日付選択
- 方向切替（`迎え`/`送り`）
- 保存状態（未保存/保存中/保存済み）
- `今日の業務へ戻る` ボタン（`/today`）

## Main

- `車両1〜4` 固定表示の車両カード
- 各カード:
  - 車両名
  - 運転者 Select（staff）
  - 乗車利用者 MultiSelect（方向別）
  - 警告表示（`乗車あり && 運転者未設定`）

## Supplemental Panel

- 未割当利用者一覧（方向別）
- 保存前プレビュー（誰がどの車両に入るか）

## Data Model (Phase 1: Schedules-based)

編集対象は既存 `ScheduleItem` を使用する。

- 参照必須フィールド:
  - `id`, `etag`
  - `userId`, `userName`
  - `serviceType`, `title`, `start`, `end`
  - `vehicleId`
  - `assignedStaffId`
- 表示用補助:
  - `assignedStaffName`（存在すれば優先）
  - staff マスタの `id/staffId/name` から表示名を解決

方向判定は既存 transport の推論規則に揃える。

- `src/features/today/transport/transportAssignments.ts` の判定（`inferDirections` 相当）を再利用
- 判定不能/unknown は安全に skip

## Save Unit

- 保存単位は「利用者×方向」に対応する schedule row 更新
- 更新 payload は `UpdateScheduleEventInput` で既存 `useSchedules().update()` を使用
- 保存時に更新する主フィールド:
  - `vehicleId`
  - `assignedStaffId`
- `driverName` は表示解決値で保持し、正本は `assignedStaffId` を優先

## Error / Conflict Handling

- 保存失敗時は行単位でエラー表示し、成功分は維持
- `etag` conflict は再取得導線を表示して再保存を促す
- 保存中は再保存ボタンを disable

## File Split Proposal

### Page

- `src/pages/TransportAssignmentPage.tsx`
  - 画面オーケストレーションのみ

### Feature module

- `src/features/transport-assignments/domain/buildTransportAssignmentDraft.ts`
  - 当日対象抽出
  - 方向別グルーピング
  - 未割当算出
- `src/features/transport-assignments/domain/buildTransportAssignmentUpdates.ts`
  - UI state から `UpdateScheduleEventInput[]` へ変換
- `src/features/transport-assignments/hooks/useTransportAssignmentsPage.ts`
  - 取得/編集状態/保存
- `src/features/transport-assignments/components/TransportAssignmentHeader.tsx`
- `src/features/transport-assignments/components/TransportVehicleBoard.tsx`
- `src/features/transport-assignments/components/TransportVehicleCard.tsx`
- `src/features/transport-assignments/components/UnassignedRidersPanel.tsx`

### Tests

- `src/features/transport-assignments/domain/__tests__/buildTransportAssignmentDraft.spec.ts`
- `src/features/transport-assignments/domain/__tests__/buildTransportAssignmentUpdates.spec.ts`
- `src/features/transport-assignments/hooks/__tests__/useTransportAssignmentsPage.spec.ts`
- `tests/e2e/transport-assignments.basic-flow.spec.ts`（Phase 1完了後）

## Minimal DoD

- サイドメニューから `/transport/assignments` を開ける
- 日付/方向の切替ができる
- 4台固定ボードが表示される（空車含む）
- 運転者設定ができる
- 利用者割当ができる
- 未割当が即時再計算される
- 保存結果が `/today` の送迎カードに反映される

## Rollout Steps

1. 画面仕様固定（本ドキュメント）
2. route/nav 追加（ページは空実装でも先に到達可能にする）
3. domain pure function 実装
4. hook 実装
5. page 接続
6. unit/hook test
7. e2e 1本で導線固定
