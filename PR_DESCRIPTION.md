## 概要
イソカツ（Isokatsu）システムのリリースに向けた最終統合。マージコンフリクトを解消し、ドメイン整合を担保した「運用可能（Verified GO）」な状態に硬化。

## 変更内容
### 追加
- `.github/workflows/pre-deploy-gate.yml`: 投入前の自動静的解析ゲートを追加。

### 変更
- `ExceptionCenterPage`: Orchestrator (useExceptionCenterOrchestrator) による状態管理へ全面移行し、データレイヤー異常の検知も統合。
- `exceptionLogic.ts`: ExceptionCategory の定義を統一し、統計計算ロジック（computeExceptionStats）を新旧カテゴリ両対応に更新。
- `repositoryFactory`: 主要4機能（Attendance/Daily/Schedules/Users）の Factory を共通基盤へ統合。
- `correctiveActions.ts`: `data-os-alert` 等、新カテゴリに対応する是正アクションを追加。
- `SupportPlanningSheetView`: 未実装の SharePoint リポジトリ依存をダミー（TODO付）に差し替え、ビルドを安定化。

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
| :--- | :--- | :--- |
| `src/features/exceptions/domain/exceptionLogic.ts` | 変更 | ドメインロジックの統一化 |
| `src/pages/admin/ExceptionCenterPage.tsx` | 変更 | UI 復旧と監視強化 |
| `src/features/*/repositoryFactory.ts` | 変更 | リポジトリ取得層の構造統一 |
| `correctiveActions.ts` | 変更 | 是正アクションの拡張 |
| `.github/workflows/pre-deploy-gate.yml` | 追加 | 自動ガードレールの設置 |

## テスト
- [x] npm run lint -- --max-warnings 0: PASS
- [x] npx tsc -p tsconfig.build.json --noEmit: PASS
- [x] Nightly Patrol (2026-03-30): 手動実行ベースで正常動作を確認

## セルフレビュー
- [x] `console.log` 残していない
- [x] `any` 使用をドメインポート（IspRepository等）に最小化
- [x] 責務分離（Orchestrator/ViewModel）を守っている
- [x] 600行ルール違反なし（ExceptionCenterPage を機能別に整理済み）

## 影響範囲
- 管理画面（監視センター）
- 各機能のデータ取得層（Factory）
- CI/CD パイプライン

---
### 🚦 次のアクション
1. 本 PR マージ
2. `pre-deploy-gate` 実行確認
3. 本番投入後の初日パトロール実行（`docs/nightly-patrol/PRODUCTION-GO-LIVE.md` 参照）
