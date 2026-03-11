## Dependencies
- none (first in sequence)

---

## 背景
MVPは限定運用に入れる段階にあるため、機能追加よりも先に
repo 全体の保守性・一貫性・不安定要素を棚卸ししたい。

この Issue ではコード変更を主目的にせず、まず監査レポートを整備する。
次の hardening / refactor / type safety 作業の入力資料を作ることが目的。

---

## 目的
以下の観点で repo 全体を監査し、レポート化する。

- 巨大ファイル
- TODO / FIXME / HACK / XXX
- 型安全の弱い箇所
- import/export の揺れ
- helper の重複候補
- dead/orphan candidate files
- Loading / Error UI の散在
- 今後の安全分割候補

---

## スコープ
### 含める
- リポジトリ全体スキャン
- docs/reports への監査結果出力
- 推奨アクション整理
- 修正候補の優先順位付け

### 含めない
- 本格的なコード修正
- 新機能追加
- 仕様変更
- SharePoint schema / env / API 契約変更

---

## 完了条件
- [ ] 監査レポートが追加されている
- [ ] 400行超ファイル一覧がある
- [ ] `any` / `as any` / `unknown as` の出現箇所が整理されている
- [ ] import/export の揺れが整理されている
- [ ] Loading/Error UI の共通化候補が整理されている
- [ ] 分割候補ファイルが優先順で整理されている
- [ ] 「今回の夜間作業で触るべき候補 Top 5」が書かれている

---

## 実施タスク
### 1. Large file audit
以下を洗い出す：
- 400行超ファイル
- 600行超ファイル
- 役割混在（UI + state + helper + type）のあるファイル

### 2. Type risk audit
以下を洗い出す：
- `any`
- `as any`
- `unknown as`
- 危険な non-null assertion
- 型隠しの疑いがある cast

### 3. Import/export audit
以下を洗い出す：
- import順序のばらつき
- `import type` 化できる箇所
- 未使用 import
- barrel export の過不足

### 4. UI consistency audit
以下を洗い出す：
- Loading UI の散在
- Error UI の散在
- 同じような empty state / fallback state の重複

### 5. Refactor candidate list
最低以下を整理する：
- file path
- 問題種別
- 推奨アクション
- リスク（low / medium / high）
- 今回触るべきか
- 見送り理由

---

## 成果物
- `docs/reports/pre-operation-repository-audit.md`

---

## レポートに必ず含めること
1. 概要
2. 監査方法
3. 対象カテゴリ別の結果
4. 優先度付き対応候補
5. 今夜の推奨対象 Top 5
6. 見送り対象
7. 次のIssueへの引き継ぎメモ

---

## 注意事項
- コード修正は最小限にとどめる
- 監査結果の見える化を優先する
- 推測ではなく実際の repo 状況をもとに書く

---

## Review guidance
Prefer smaller, reviewable commits over one oversized change.
Be conservative. Structural cleanup is preferred over logic rewrites.
