# Review Current Diff Template

目的: 現在の `git diff` をAIにレビューさせ、PR化前のリスクを洗い出す。

## 前提

- レビューでは実装変更を始めない。
- 指摘は重要度順に並べる。
- ファイル名と該当箇所を具体的に示す。
- 不明点は推測で断定せず、未確認として扱う。

## 確認コマンド

1. `git status --short`
2. `git diff --name-only`
3. `git diff --stat`
4. 必要に応じて `git diff -- <file>`

## レビュー観点

- 仕様変更が混入していないか。
- 既存差分を巻き込んでいないか。
- テスト不足がないか。
- 型安全性が下がっていないか。
- SharePoint / memory mode / mock mode への副作用がないか。
- UI文言、説明文、ラベルに誤認リスクがないか。
- セキュリティ・個人情報リスクがないか。
- PRスコープが小さく妥当か。
- docs-only / test-only と言いながら実行時挙動を変えていないか。

## 出力フォーマット

### Findings

- [P0/P1/P2/P3] `path/to/file`: 内容

### Open Questions

- 未確認事項があれば列挙する。

### Scope Check

- 差分ファイル:
- PRスコープ:
- 既存差分の巻き込み:

### Verification Gaps

- 追加で必要な検証:
- 実行不要と判断した検証:
