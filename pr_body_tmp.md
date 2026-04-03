## 概要
診断UI（Health Diagnosis）の視認性向上と、モニタリングから計画へのブリッジ導線の強化。

Closes #1377

## 変更内容
### 追加
- `tests/unit/useImportHandlers.spec.ts`: 個別提案反映機能のユニットテストを追加

### 変更
- **Health Diagnosis UI**:
    - テクニカルな「Drift」を業務用語「構造整合性」へ改称
    - カテゴリ別のタブ（Badge件数付き）を実装
    - サマリーセクションを Chip グリッドに刷新し、視認性を向上
- **Monitoring → Planning Bridge**:
    - モニタリング結果（BridgeCandidates）を個別反映する機能（`handleReflectCandidate`）を実装
    - 30文字以上の前方一致による重複検知ガードレールを実装
- **Type Infrastructure**:
    - `ToastState` を共通化し、`info` / `warning` severities をサポート
    - 各フックおよびコンポーネント（`useSupportPlanningPageHandlers`, `ImportDialogsSection` 等）の通知型を統一

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------| 
| `src/features/diagnostics/health/HealthDiagnosisPage.tsx` | 変更 | タブ、Chipグリッド、名称変更 |
| `src/pages/support-planning-sheet/hooks/useImportHandlers.ts` | 変更 | 反映ロジック、重複検知 |
| `src/pages/support-planning-sheet/sections/BridgeSuggestionsSection.tsx` | 変更 | 反映ボタン追加 |
| `src/pages/support-planning-sheet/hooks/useSupportPlanningSheetUiState.ts` | 変更 | `ToastState` 共通化 |
| `tests/unit/useImportHandlers.spec.ts` | 追加 | 新規ユニットテスト |

## テスト
- [x] 既存テスト通過 (`npm run test`)
- [x] 型チェック通過 (`npm run typecheck`)
- [x] 新規テスト追加 (`useImportHandlers.spec.ts` - 3 tests pass)
- [x] ブラウザ実機確認済み (Health Diagnosis UI, Tab Switching)

## セルフレビュー
- [x] `console.log` 残していない
- [x] `any` を適切に排除
- [x] 責務分離を守っている (Hooks / View 分離)
- [x] 600行ルール違反なし

## 影響範囲
- `/admin/status` (Health Diagnosis): 表示形式の変更のみでロジックに影響なし
- `/support-planning-sheet` (新支援計画書): モニタリング提案の反映利便性が向上、既存の反映機能への影響なし
