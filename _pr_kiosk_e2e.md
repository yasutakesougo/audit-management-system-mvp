### 📝 変更概要

* **新規ワークフロー追加**: `.github/workflows/kiosk-e2e.yml`

  * `pull_request` と `workflow_dispatch` をトリガーとしたキオスク用E2Eテスト専用ジョブです。
  * ジョブ名は `kiosk-e2e` で、`ubuntu-latest` にNode 24環境を構築。
  * PlaywrightはChromiumプロジェクトのみを実行し、ワーカー数は1に固定。
  * 実行対象テストは次の4 spec計8件に限定：

    * `kiosk-home-smoke.spec.ts`
    * `kiosk-user-selection.spec.ts`
    * `kiosk-procedure-list.spec.ts`
    * `kiosk-procedure-detail.spec.ts`
* **アーティファクトの保存**: 成否に関わらずテスト結果ディレクトリ（`test-results`と`playwright-report`）を `kiosk-e2e-artifacts-*` 名でアップロードするようにしました。

### ⚙️ 実行コマンド

ワークフロー内では以下のコマンドでテストを実行しています。

```bash
npm run -s test:e2e -- tests/e2e/kiosk-home-smoke.spec.ts \
                        tests/e2e/kiosk-user-selection.spec.ts \
                        tests/e2e/kiosk-procedure-list.spec.ts \
                        tests/e2e/kiosk-procedure-detail.spec.ts \
                        --project=chromium --workers=1 --reporter=list
```

### ✅ 期待結果 / 確認ポイント

1. **ジョブ名確認**: Actionsタブで `kiosk-e2e` が表示されていること。
2. **テスト実行数**: 上記4 spec、計8件のキオスクE2Eテストが実行されること。
3. **アーティファクト保存**: 成功・失敗に関わらず、`kiosk-e2e-artifacts-*` という名前でテスト結果やレポートが保存されていること。
4. **ブランチ保護設定**: リポジトリ設定で `kiosk-e2e` ジョブを「Required checks」として追加する予定です。
