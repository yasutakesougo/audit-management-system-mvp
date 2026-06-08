# Prepare PR Template

目的: 作業済み差分をPR化する前のチェックとPR本文作成を標準化する。

## 禁止事項

- 既存差分を巻き込まない。
- `.env`、secret、token、local設定ファイルを編集しない。
- `package.json` / lockfile / workflow yml を不要に変更しない。
- SharePoint list / field candidates を変更しない。
- `--no-verify` を使わない。
- main へ直接 push しない。

## PR前チェック

1. `git status --short`
2. `git diff --name-only`
3. `git diff --check`
4. 対象テスト
5. 可能なら `npm run typecheck`
6. 可能なら `npm run lint`
7. docs-only の場合は `npm run lint:docs` または既存のdocs lint相当

## CI不安定がある場合の書き分け

- 今回差分に関係するFAILは、原因を確認して修正する。
- 今回差分と無関係な既知不安定は、対象ファイル、失敗内容、無関係と判断した理由をNotesに明記する。
- 未確認のFAILを成功扱いにしない。

## PRタイトル

形式は以下のいずれかを使う。

- `test(scope): add coverage for ...`
- `docs(scope): document ...`
- `fix(scope): ...`
- `refactor(scope): ...`

## PR本文フォーマット

```md
## Summary
- ...

## Verification
- ...

## Risk
- ...

## Notes
- ...
```

## 最終報告フォーマット

- PRタイトル案:
- PR本文案:
- 変更ファイル:
- 除外した既存差分:
- 実行した検証コマンド:
- PASS / FAIL:
- FAILがある場合の原因: 今回差分起因 / 既存問題 / 未確認
