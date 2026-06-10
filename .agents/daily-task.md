# Daily Small Task Template

目的: 日常的な小タスクを1つだけ安全に実行し、小PRにできる差分を作る。

## 基本方針

- 差分は原則3ファイル以内に収める。
- 仕様変更、UI/UX変更、SharePoint list / field candidates 変更は行わない。
- 依存追加、環境変数変更、workflow yml変更、snapshot更新は行わない。
- 既存の未コミット差分を巻き込まない。
- `--no-verify` は使わない。
- main へ直接 push しない。

## 選べる作業

優先順位は以下の順にする。

1. docs追記
2. 小さなテスト追加
3. lint警告や未使用importの解消
4. 型安全性を上げる小修正
5. 既存仕様を変えない小リファクタ
6. PR本文作成

## 作業手順

1. `git status --short` を確認する。
2. 既存差分がある場合は、今回対象かどうかを明確に分ける。
3. 関連ファイルを読む。
4. 変更案を1つに絞る。
5. 最小差分で編集する。
6. 対象テストまたはdocs lintを実行する。
7. 可能なら `npm run typecheck`、`npm run lint`、`git diff --check` を実行する。
8. 最終報告で結果と残リスクをまとめる。

## 最終報告フォーマット

- 選んだタスク:
- 変更ファイル:
- 変更理由:
- 変更しなかったもの:
- 実行した検証コマンド:
- PASS / FAIL:
- FAILがある場合の原因: 今回差分起因 / 既存問題 / 未確認
- リスク:
- PRタイトル案:
- PR本文案:

## 安全運用ルール（小規模PR）
- 作業開始時は必ず main に戻してから開始する。
- git status --short で作業ツリーを確認し、クリーン状態を起点とする。
- 作業入口は .agents/daily-task.md のテンプレートに従う。
- 1 PRあたりの影響は原則3ファイル以内に抑える。
- 過去に merged されたPRや古い Deploy Preview failure は、現行 main で再現しない限り修正対象にしない。
- .env や SharePoint 周辺の既存差分は、daily-task 対象外の場合は触らない。

