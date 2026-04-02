## 概要
E2Eテストの安定化、および SharePoint 通信のハードニング（Fail-Open/Lane-Isolation）の実装。

Closes #842

## 変更内容
### 追加
- `artifacts/stabilization_7day_field_check_sheet.md`: 運用移行後の 7日間健全性確認シート
- `tests/e2e/dump-health.spec.ts`: /admin/status 診断結果のエビデンス取得用テスト
### 変更
- `tests/e2e/daily.records-flow.spec.ts`: セレクタのスコープを `daily-record-list-container` に限定し、厳格モード違反（利用者名の重複検出）を解消
- `src/features/daily/infra/SharePointDailyRecordRepository.ts`: Fail-Open 設計に基づくエラーハンドリングとレーン割り当ての最適化
- `src/components/PageHeader.tsx` & `src/features/daily/components/pages/FullScreenDailyDialogPage.tsx`: 重複する `h1` セレクタによる E2E 競合の解消

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------| 
| tests/e2e/daily.records-flow.spec.ts | 変更 | ロケータのスコープ限定による安定化 |
| tests/e2e/dump-health.spec.ts | 追加 | 診断基盤のエビデンス化 |
| src/features/daily/infra/... | 変更 | SharePoint 通信の堅牢化 | 
| artifacts/stabilization_7day_field_check_sheet.md | 追加 | 運用監視用ドキュメント |

## テスト
- [x] 既存テスト通過 (`daily.records-flow.spec.ts` が正常終了することを確認)
- [x] 型チェック通過
- [x] 新規テスト追加 (`dump-health.spec.ts`)

## セルフレビュー
- [x] `console.log` 残していない
- [x] `any` 使っていない
- [x] 責務分離を守っている
- [x] 600行ルール違反なし

## 影響範囲
- DailyRecord 機能の表示・保存処理（Fail-Open により、SharePoint 遅延時も UI が固まらなくなります）
- 管理画面の診断機能（一部、スタブ環境による FAIL は許容範囲内であることを確認済み）
