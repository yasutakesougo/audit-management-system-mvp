# 📌 a11y CI 統合（複合ページ）

## 目的（なぜやるか／価値）

RecordList と UsersPanel を組み合わせた画面でもアクセシビリティ違反ゼロを維持する。

Issue #003 で単体コンポーネントの a11y チェックを導入した後、複数のコンポーネントが組み合わさったページレベルでもアクセシビリティを保証します。これにより：

- **実践的検証**: 実際の画面レイアウトでの a11y 違反を検知
- **統合品質**: コンポーネント間の相互作用による問題を発見
- **CI 統合**: アクセシビリティレポートを CI で自動生成・保存
- **継続的改善**: axe レポートの履歴から品質向上を追跡

## 受け入れ基準（Definition of Done）

- [ ] RecordList と UsersPanel を組み合わせた複合ページのテストを実装
- [ ] axe レポートを CI で保存（JSON 形式）
- [ ] 違反ゼロのときに CI ジョブが成功する
- [ ] 違反がある場合は詳細なレポートをアーティファクトとして保存
- [ ] Playwright E2E テストで複合ページをスキャン
- [ ] テストが 60 秒以内に完了する

## 目安工数

- [ ] S（小）
- [x] M（中）
- [ ] L（大）

## タスク例

- [ ] `tests/e2e/a11y-complex-page.spec.ts` を作成
- [ ] 複合ページのレンダリング
  - RecordList と UsersPanel を同時に表示する画面に遷移
  - データが正しく読み込まれるまで待機
- [ ] 既存の a11y ヘルパーを使ったスキャン
  - `tests/e2e/utils/a11y.ts` の `runA11ySmoke(page, 'complex-page')` を呼び出す
  - 違反があれば `runA11ySmoke` の結果を JSON レポートとして保存
- [ ] CI ワークフローの更新
  - `.github/workflows/ci.yml` に a11y テストジョブを追加
  - axe レポートをアーティファクトとして保存
  - GitHub Actions Summary にレポート概要を表示
- [ ] 既存の違反があれば修正
  - ページ構造の見直し
  - ARIA 属性の追加・修正
  - フォーカス管理の改善
- [ ] レポート比較スクリプトの作成（オプション）
  - 前回のレポートと比較して、改善/悪化を可視化

## 備考

関連ファイル:
- `src/features/records/RecordList.tsx` - 記録一覧コンポーネント
- `src/features/users/UsersPanel.tsx` - ユーザーパネルコンポーネント
- `tests/e2e/dashboard.tabs.smoke.spec.ts` - 複合ページの参考
- `.github/workflows/ci.yml` - CI ワークフロー
- `issues/003-a11y-unit-checks.md` - 前提となる単体 a11y チェック

前提条件:
- Issue #003（a11y 自動チェック）が完了していること
- axe-playwright または @axe-core/playwright がインストール済みであること

参考:
- [axe-playwright GitHub](https://github.com/abhinaba-ghosh/axe-playwright)
- [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [Playwright Accessibility Testing](https://playwright.dev/docs/accessibility-testing)

CI ワークフロー例:
```yaml
- name: Run a11y tests
  run: npm run test:e2e:a11y

- name: Upload axe report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: axe-report
    path: reports/axe-report.json
```
