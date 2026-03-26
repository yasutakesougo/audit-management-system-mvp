# /today 改善PR候補 3本（実装切り分け）

- 作成日: 2026-03-26
- 元資料: [today-side-effects-audit-matrix.md](./today-side-effects-audit-matrix.md)
- 目的: `/today` の改善を「小さく安全にマージできる単位」に分割する
- ステータス（2026-03-26）:
  - PR-1: 実装済み（`/today` hydration route key + matcher + tests）
  - PR-2: 実装済み（`useUsersQuery` 導入 + `/today` 配下4箇所置換 + dedupeテスト）
  - PR-3: 実装済み（`operationFeedback` SSOT + 412/rollback/non-blocking 文言統一）
  - 追確認: `tests/e2e/schedule-week.conflict.spec.ts` green（create 412競合の実UI挙動）

## 実施順（推奨）

1. PR-1 `/today` hydration 監視対象化（完了）
2. PR-2 `useUsers` 取得経路の整流（重複読取圧縮）（完了）
3. PR-3 更新失敗UXの統一（412 / rollback / non-blocking）（完了）

---

## PR-1: `/today` hydration 監視対象化

### 目的

- 最重要画面 `/today` を route hydration budget の監視対象に入れる。

### 変更範囲（最小）

- `src/hydration/routes.ts`
  - `HYDRATION_KEYS` に `today` エントリ追加
  - `MATCHERS` に `path.startsWith('/today')` 追加
- `docs/hydration/routes-guide.md`（必要なら追記）

### 受け入れ条件

- `/today` 初期表示時に `resolveHydrationEntry()` が non-null を返す。
- hydration span に `/today` 用 route id が出る。
- `getUnmatchedHydrationKeys()` に新規キーが残らない。

### 検証

- `npm run test`（hydration 関連テストがあれば実行）
- 手動: `/today` を開き、hydration HUD/ログで route span を確認

### リスク/ロールバック

- 低リスク（計測追加のみ）
- ロールバック容易（matcher/key 差し戻し）

---

## PR-2: `useUsers` 取得経路の整流（/today系）

### 目的

- `/today` 周辺で多点発火している `Users_Master` 取得を、共有キャッシュで1本化する。

### 変更範囲（推奨）

- 新規: `src/features/users/hooks/useUsersQuery.ts`（React Query化）
  - 共通 query key: 例 `['users', params]`
  - staleTime / refetchPolicy を明示
- 置換対象（まず `/today` 直下だけ）
  - `src/features/today/domain/useTodaySummary.ts`
  - `src/features/exceptions/hooks/useExceptionDataSources.ts`
  - `src/features/callLogs/components/CallLogQuickDrawer.tsx`
  - `src/features/handoff/HandoffQuickNoteCard.tsx`

### 受け入れ条件

- `/today` 初回表示時、`Users_Master` の実ネットワーク取得が実質1回に収束する。
- 既存UIの表示内容（利用者名/件数/選択肢）が変わらない。
- 例外時のフォールバック（demo/in-memory）は維持される。

### 検証

- 手動: DevTools Network で `Users_Master` 呼び出し回数比較（変更前後）
- `npm run test`（users/today/exceptions/callLogs/handoff 関連）

### リスク/ロールバック

- 中リスク（read path の土台変更）
- ロールバックは置換箇所を段階的に戻せるよう、PR内コミットを機能別に分ける

---

## PR-3: 更新失敗UXの統一（412 / rollback / non-blocking）

### 目的

- ユーザー視点で「同じ保存操作なのに失敗挙動がバラバラ」を解消する。

### 対象分類

- `412 conflict`（Schedules 更新競合）
- `optimistic rollback`（Transport_Log 保存失敗で戻る）
- `non-blocking sync failure`（AttendanceDaily 補助同期失敗）

### 変更範囲（推奨）

- 新規: `src/features/today/feedback/operationFeedback.ts`
  - 失敗種別→表示文言のマッピング（日本語文言SSOT）
- 適用先
  - `src/features/schedules/hooks/useSchedules.ts`（`kind: 'conflict'` の表示文言統一）
  - `src/features/schedules/components/UserStatusQuickDialog.tsx`（競合文言の翻訳）
  - `src/features/today/transport/useTransportStatus.ts`（rollback発生時のユーザー通知）
  - 必要に応じて `TodayOpsPage` で Snackbar 表示

### 受け入れ条件

- 412時: 「他の担当者が先に更新した」ことがUIで明示される。
- rollback時: 「一度反映されたが保存失敗で戻した」ことが明示される。
- non-blocking同期失敗時: 主操作は成功であることを保ちつつ、補助同期失敗が可視化される。

### 検証

- 単体: エラー分類関数 / 文言マッパー
- 手動: 通信失敗モックで3分類の表示確認

### リスク/ロールバック

- 中リスク（ユーザー通知の増加による運用負荷変化）
- ロールバックは文言層（feedback mapper）単位で可能

---

## 付記（PR運用）

- 3本とも「機能追加」より「可観測性・運用安定化」なので、PRテンプレに以下を固定記載する。
  - 変更前/変更後の失敗時挙動
  - 監視で見えるようになる指標
  - 影響範囲（read/write/UX）

## 完了サマリー（2026-03-26）

- PR-1: `/today` が hydration 監視対象に登録され、budget監視が有効化された。
- PR-2: `Users_Master` 読取が `useUsersQuery` に整流され、重複取得を抑制した。
- PR-3: `operationFeedback` に失敗文言/判定を統一し、`412 conflict` / `rollback` / `non-blocking` のUI契約を揃えた。
- 追確認: 週スケジュール競合E2Eで、create失敗時の 412 が conflictフィードバックとして表示されることを確認した。
