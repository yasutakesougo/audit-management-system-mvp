# schedules モジュール Hardening 計画

## 1. 現状の責務一覧
`src/features/schedules` は、スケジュールのタイムライン表示、予定のCRUD操作、利用者・職員のアサイン状態管理、および週次/日次のビュー切り替えを担っている。UIとデータ取得・更新ロジックが密結合しており、以下のファイルで肥大化が見られる。

- **巨大な Hooks**
  - `useScheduleCreateForm.ts` (~18KB)
  - `useSchedulesCrud.ts` (~13KB)
  - `useSchedules.ts` (~13KB)
  - `useSchedulesPageState.ts` (~11KB)
  - `useWeekPageOrchestrator.ts` (~11KB)
- **巨大な UI**
  - `UserStatusQuickDialog.tsx` (~14KB)
  - `ScheduleDialogManager.tsx` (~13KB)
  - `SchedulesSpLane.tsx` (~12KB)

## 2. 旧 `/schedule` 系の残骸
- `src/pages/ScheduleUnavailablePage.tsx` などの古い参照や、関連する不要なコンポーネントの整理が必要。
- `useSchedules.ts` と `useSchedulesCrud.ts` の間などで機能の重複・肥大化（ファストパスとレガシーの混在）が疑われるため棚卸し対象とする。

## 3. route / tab / audience / role guard
- **Route / Tab**: 日次（Today）と週次（Week）ビュー間の状態同期や、URLクエリ（日付やフィルタ状態）への反映。
- **Audience Guard**: 施設長・管理職・現場スタッフ向けに表示内容を出し分ける設定の厳密な適用（`RequireAudience` の適用）。
- **Role Guard**: サビ管や特定の権限を持つユーザーのみが特定の更新（実積確定やドラッグ&ドロップによる予定強制変更）を行える機能のガード。

## 4. shared logic 候補
- **日付・重複チェック**: 予定のコンフリクト（二重登録）、営業時間内外判定などの純粋関数化とテスト。
- **表示用データ整形**: タイムライン（レーン）表示のためのデータ構造マッピングやレイアウト計算の純粋化。
- **メタデータ管理**: サービス種別、ステータスのバッジカラー抽出等の独立化。

## 5. orchestrator 抽出候補
`daily` で成功したパターンを踏襲し、以下の Orchestrator （副作用のオーケストレーション層）を検討する。
- **`useScheduleSaveOrchestrator`**: 新規作成・更新時の非同期処理、バリデーション、キャッシュ更新の集約。
- **`useScheduleHydrationOrchestrator`**: URLクエリと連動した初回データロードや、週次・日次データのフェッチ管理。
- **`useScheduleDragDropOrchestrator`** (または Interaction Orchestrator): カレンダー上の操作（移動・時間変更）に伴う状態変更と保存シーケンスの管理。

## 6. PRの刻み方
`daily` ででの成功体験（段階的かつ安全な切り離し）をベースに、以下の順でPRを切る。

1. **PR 1: `schedules` の構造可視化と純粋関数の抽出 (Non-behavioral)**
   - 既存の巨大フックから、副作用を持たない純粋関数（ドメインロジック）を抽出する。ファイル移動が主で動作変更なし。
2. **PR 2: Orchestrator の分離**
   - Save / Hydration Orchestrator を抽出し、フォーム操作に関わる副作用を分離する。
3. **PR 3: ViewModel の導入**
   - `ScheduleViewModel` (および `vm.sections`) を定義し、表示に必要なデータを State / Actions / Flags に整理する。
4. **PR 4: UIの薄化 (Wiring完了)**
   - 巨大UI (`ScheduleDialogManager`, `UserStatusQuickDialog`等) から個別配線を排除し、ViewModelベースへと完全移行。直書きされた `useEffect` を駆逐する。
