This PR is the first target in Phase 3 of the `schedules` module hardening, focusing on Orchestrator Extraction (PR 3-A).

## 変更内容
`useScheduleCreateForm` に混在していた「Formの状態管理（ViewModel）」と「保存時の副作用（Orchestrator）」の責務を適切に分離しました。

### 1. `useScheduleSaveOrchestrator` の抽出
* 新しく `hooks/orchestrators/useScheduleSaveOrchestrator.ts` を作成しました。
* バリデーションの実行
* ペイロード組み立て（`toCreateScheduleInput`）
* 保存APIの実行（`onSubmit`）と結果に応じたトースト・音声通知（A11y announce）の責務をここに集約しました。

### 2. `useScheduleCreateForm` の UI薄化 (ViewModel化)
* `onSubmit` 等の外部注入アクションと副作用の責務を剥がし、純粋な Form 状態と派生値（autoTitle 等）を提供するだけの ViewModel へ整理しました。

### 3. `ScheduleCreateDialog` でのつなぎ込み
* UI コンポーネント層で `useScheduleSaveOrchestrator` と `useScheduleCreateForm` の両方を呼び出し、ボタンクリック時に Orchestrator へ Form 状態を渡して Save を走らせる構成にしました。

## 補足事項
- このコミットには、前回のPR 2で実施が漏れていた実ファイルのフォルダ移動（`dialogs/`, `sections/`, `legacy/` への再配置）と、すべての `import` パスの完全な修復が含まれています。
- コンパイルエラー（tsc --noEmit）は全て Green になっています。
- Save 時の機能・挙動自体に変更は加えていません（non-behavioral changes）。
