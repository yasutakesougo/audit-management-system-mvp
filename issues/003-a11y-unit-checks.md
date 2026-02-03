# 📌 a11y 自動チェック（jest-axe 単体導入）

## 目的（なぜやるか／価値）

初期段階でアクセシビリティ違反を検知し、UI 品質を維持する。

アクセシビリティは、すべてのユーザーがアプリケーションを利用できるようにするための重要な品質指標です。特に福祉施設向けシステムでは、様々な利用者に配慮した設計が求められます。jest-axe を導入することで：

- **品質保証**: WCAG 2.1 準拠を自動的にチェック
- **早期発見**: コンポーネント開発時点でアクセシビリティ違反を検知
- **教育効果**: 開発者がアクセシビリティのベストプラクティスを学べる
- **CI 統合**: プルリクエスト段階で品質をガード

## 受け入れ基準（Definition of Done）

- [ ] jest-axe をプロジェクトに導入（package.json に追加）
- [ ] RecordList コンポーネントの axe テストを実装し、違反ゼロを確認
- [ ] UsersPanel コンポーネントの axe テストを実装し、違反ゼロを確認
- [ ] CI で axe テストが自動実行される
- [ ] 既存の違反があれば修正完了
- [ ] テストが 20 秒以内に完了する

## 目安工数

- [x] S（小）
- [ ] M（中）
- [ ] L（大）

## タスク例

- [ ] `npm install --save-dev jest-axe @types/jest-axe` を実行
- [ ] `vitest.setup.ts` に jest-axe のカスタムマッチャーを追加
- [ ] `tests/unit/a11y/RecordList.a11y.spec.tsx` を作成
  - RecordList をレンダリング
  - axe でスキャン
  - 違反ゼロをアサート
- [ ] `tests/unit/a11y/UsersPanel.a11y.spec.tsx` を作成
  - UsersPanel をレンダリング
  - axe でスキャン
  - 違反ゼロをアサート
- [ ] 違反が見つかった場合は修正（aria-label 追加、role 修正など）
- [ ] CI の test:ci スクリプトで a11y テストが実行されることを確認

## 備考

関連ファイル:
- `src/features/daily/RecordList.tsx` - 記録一覧コンポーネント
- `src/features/users/UsersPanel.tsx` - ユーザーパネルコンポーネント
- `vitest.setup.ts` - Vitest のセットアップファイル
- `docs/ACCESSIBILITY_GUIDE.md` - アクセシビリティガイド

参考:
- [jest-axe GitHub](https://github.com/nickcolley/jest-axe)
- [axe-core ルール一覧](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 クイックリファレンス](https://www.w3.org/WAI/WCAG21/quickref/)

注意事項:
- 既存のコンポーネントに違反がある場合、まずは axe でレポートを出し、優先度の高いものから修正する
- 複雑なインタラクションは E2E テストで補完する
