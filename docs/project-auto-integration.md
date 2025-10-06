# プロジェクトボード自動連携

## 概要

このリポジトリでは、GitHub Issues とプロジェクトボードの自動連携機能を提供しています。
「Backlog」または「📌 Backlog Task」ラベルが付いた Issue は、自動的にプロジェクトボードに追加されます。

## 仕組み

### ワークフロー

`.github/workflows/project-auto.yml` が以下のタイミングで実行されます：
- Issue が開かれた時 (`opened`)
- Issue が再開された時 (`reopened`)
- Issue が編集された時 (`edited`)
- Issue にラベルが付けられた時 (`labeled`)

### 自動実行される処理

1. **ラベル確認**: Issue に「Backlog」または「📌 Backlog Task」ラベルが付いているか確認
2. **ラベル作成**: 必要なラベル（`Backlog`、`S工数`）が存在しない場合は作成
3. **ラベル追加**: Issue に `Backlog` と `S工数` ラベルを追加
4. **プロジェクトボード追加**: Issue をプロジェクトボード（https://github.com/users/yasutakesougo/projects/1）に追加
   - Status: `Inbox`
   - Priority: `P3`
5. **失敗時のフォールバック**: 追加に失敗した場合は Issue にコメントを投稿

## Issue テンプレート

`📌 Backlog Task` テンプレート (`.github/ISSUE_TEMPLATE/backlog-task.yml`) を使用すると、
自動的に以下のラベルが付与されます：
- `Backlog`
- `S工数`

これにより、Issue 作成と同時にプロジェクトボードへの自動連携が開始されます。

## テスト方法

### 手動テスト

1. GitHub Issues で「📌 Backlog Task」テンプレートを使用して新しい Issue を作成
2. Actions タブで `Auto add issues to project` ワークフローの実行を確認
3. プロジェクトボード（https://github.com/users/yasutakesougo/projects/1）で Issue が追加されたことを確認

### CI での確認

ワークフローの実行ログは Actions タブから確認できます：
- 成功時: ワークフローが緑色で表示され、Issue がプロジェクトボードに追加されます
- 失敗時: Issue に警告コメントが投稿され、手動での追加が必要です

### ワークフロー設定の検証

ローカルで以下のコマンドを実行して、ワークフローが正しく設定されているか確認できます：

```bash
npm run validate:project-auto
```

または直接スクリプトを実行：

```bash
./scripts/validate-project-auto.sh
```

このスクリプトは以下をチェックします：
- ワークフローファイルの存在
- 必要なトリガー（opened, reopened, edited, labeled）
- Backlog ラベルのチェック
- プロジェクト URL の設定
- 必要な権限（issues: write, repository-projects: write）

### 自動連携の検証手順

このリポジトリの Issue "[Backlog] テスト自動連携" が、自動連携機能のテストケースとして機能します：

1. Issue に `Backlog` ラベルが付いていることを確認
2. GitHub Actions タブで該当する `Auto add issues to project` ワークフローを確認：
   - URL: `https://github.com/yasutakesougo/audit-management-system-mvp/actions/workflows/project-auto.yml`
3. ワークフローが成功（緑色）していることを確認
4. プロジェクトボードで Issue が追加されていることを確認：
   - URL: `https://github.com/users/yasutakesougo/projects/1`
   - Status: `Inbox`
   - Priority: `P3`

この検証により、CI で自動的にプロジェクトボードに追加される機能が正しく動作していることを確認できます。

## トラブルシューティング

### Issue がプロジェクトボードに追加されない

1. Actions タブでワークフローの実行ログを確認
2. Issue に `Backlog` または `📌 Backlog Task` ラベルが付いているか確認
3. ワークフローに失敗がある場合、Issue のコメントを確認
4. 必要に応じて手動でプロジェクトボードに追加: https://github.com/users/yasutakesougo/projects/1

### 権限エラー

ワークフローには以下の権限が必要です：
- `issues: write`
- `contents: read`
- `repository-projects: write`

これらの権限はリポジトリの Settings > Actions > General で設定できます。

## 参考

- ワークフロー定義: `.github/workflows/project-auto.yml`
- Issue テンプレート: `.github/ISSUE_TEMPLATE/backlog-task.yml`
- プロジェクトボード: https://github.com/users/yasutakesougo/projects/1
