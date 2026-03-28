## 概要
`useScheduleCreateForm` に混在していた「Formの状態管理（ViewModel）」と「保存時の副作用（Orchestrator）」の責務を適切に分離し、関連するテストファイルのimport パスを修復し統合した PR です。

Closes #XXX_ISSUE_NUMBER_XXX

## 変更内容
### 追加
- `hooks/orchestrators/useScheduleSaveOrchestrator.ts` を新規作成 (バリデーションやAPI反映の責務が集約されました)

### 変更
- `useScheduleCreateForm` を純粋な Form 状態(ViewModel)に変更し、UIへの引き回しのみに特化
- `_pr3a_body.md` に記載されていたファイル配置基準（`dialogs/`, `sections/`, `legacy/`等）に合わせてディレクトリ構成を整理
- 移動に伴い切断されていた `src/features/schedules` 側のテストにおける `import` パス参照を一斉修復

## 変更ファイル一覧
| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------| 
| `__tests__/**/*.spec.ts(x)` | 修正 | ファイルの実移動に伴い、壊れた import パスを再結合 |
| `useScheduleSaveOrchestrator.ts` | 追加 | Orchestrator 層の新規抽出 |
| `useScheduleCreateForm.ts` | 修正 | ViewModel への薄化 |

## テスト
- [x] 既存テスト通過 ( `npx vitest run src/features/schedules` 対象テスト335件 ALL GREEN )
- [x] 型チェック通過 ( `npx tsc --noEmit` ALL GREEN )
- [ ] 新規テスト追加

## セルフレビュー
- [x] `console.log` 残していない
- [ ] `any` 使っていない
- [x] 責務分離を守っている
- [x] 600行ルール違反なし

## 影響範囲
- スケジュール登録周りの内部的な実行パイプラインが再構築されましたが、振る舞い自体の変更は含まれていません。
