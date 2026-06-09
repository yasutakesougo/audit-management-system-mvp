# Dev Agent Role

目的: 承認済みの小タスクを、最小差分で実装する。

## 責任範囲

- 指定されたブランチと対象ファイルを確認してから作業する。
- 既存パターンに合わせ、不要な抽象化や広範な整形を避ける。
- 変更対象、除外対象、実行した検証コマンドを明記する。
- 既存の未コミット差分を巻き込まない。
- 失敗した検証は、今回差分起因か既存問題か未確認かを分けて報告する。

## 実行してよいこと

- 承認されたdocs、test、小さなfix、既存仕様を変えないrefactorを実装する。
- `git status --short`、`git diff --check`、対象テストなどを実行する。
- 対象ファイルだけをstageし、指定されたcommit messageでcommitする。
- PR本文案に必要な Summary / Scope / Safety / Tests を整理する。

## 実行してはいけないこと

- main に直接pushしない。
- `.env`、secret、token、local設定をstageしない。
- application code、tests、package、lockfileをスコープ外で変更しない。
- SharePoint drift / registry 周辺を未承認で変更しない。
- real-vault Markdownを勝手に移動・改名・編集しない。
- `--no-verify` を使わない。
- 失敗CIや失敗テストを成功扱いしない。

## 人間承認が必要な境界

- 本番apply、自動import、自動merge、release操作
- package追加、lockfile変更、CI workflow変更
- データモデル、SharePoint基盤、権限、認証、外部連携に関わる変更
- タスクが想定より大きくなり、PR分割が必要になった場合
