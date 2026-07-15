# docs: lint:docs 実効化方針（最小実装プロポーザル）

## 1. 目的

`npm run lint:docs` は現在スタブ (`[lint:docs] Stubbed`) であり、実装が不在である。
本書は実効化する最小スコープを定義し、次PRで機械的に導入できる境界を固定する。

## 2. 現時点の固定事項

- baseline commit: `706fd19da`（stale known違反除去後）
- 本PRの目的: 文書品質の機械的チェックを導入すること（機能追加の品質担保ではない）
- 既存方針:
  - `support-record flow` 調査PRと `arch:check` 台帳更新PR から分離
  - `lint:docs` は段階的実装
  - 未実装機能（日本語表現の自然性等）は除外

## 3. 実装する最小チェック（第1段階）

対象: `docs/**/*.md` を再帰的に列挙（`node_modules` / `dist` / `tmp` / 生成物出力先は除外）

1. Markdownリンク/参照チェック
   - 相対リンクの存在検証（ローカルファイル解決）
   - `scripts/lint-links.cjs` 相当の検証を `lint:docs` に接続
2. 末尾空白チェック
   - 行末空白の有無を検知
3. 重複見出しチェック
   - 同一見出しの多重定義を警告扱いで列挙
4. 壊れた参照先（画像/アンカー含む）チェック
5. front matter 必須項目
   - 任意ルールで最低でも `title` があるべきファイルを検出する（対象拡張）
6. 禁止されたローカル絶対パス
   - `C:\...` / `/home/...` 型の絶対パスを警告
7. 日付付きレポートのBaseline 表記
   - `system-inventory-handoff` 系ドキュメントに必要な baseline 行の有無

## 4. 第1段階で除外するもの

- 文法的品質の厳密化（可読性、文章トーン）
- 自動整形（prettier/markdownfmt の強制）
- スクリーンショット差し替えや画像リンクの代替解釈

除外対象はあえて将来の拡張スコープとして維持し、当面は false-negative を避ける。

## 5. 受入条件（第1段階完了）

1. `npm run lint:docs` が 0 exit code を返すこと
2. 失敗した場合、問題ファイル/行/種別を明示して再現可能であること
3. 新規追加した `lint:docs` チェックが `support-record flow` や `known-violation` 調査文書のレビューを阻害しないこと

## 6. 移行ルール

- 本PRは「実装計画」であり、`lint:docs` 本実装PRとは別PRで行う
- 実装PRでは上記7項目を超えない
- 実装後、CI要件で `lint:docs` が必要チェックとして扱われることを明示する

## 7. 参照

- 現状スタブ実装: `scripts/lint-docs.cjs`（`[lint:docs] Stubbed`）
- リンク検証実装: `scripts/lint-links.cjs`
