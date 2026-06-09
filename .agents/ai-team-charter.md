# AI Team Charter v1

目的: AIを完全自律の開発者として扱わず、小PR・人間承認・役割分離を前提に、安全な支援チームとして運用する。

## Operating Model

- 入口は原則 `.agents/daily-task.md` とする。
- 1タスクは1つの明確な目的に絞る。
- 差分は小さく保ち、レビュー可能なPR単位に分割する。
- AIは提案、実装補助、レビュー補助、文書化、引き継ぎを担当する。
- 人間は優先順位、承認、マージ、外部データ操作、本番操作の最終責任を持つ。
- 役割を分離し、同じAIが無制限に企画・実装・承認を兼ねない。

## Lanes

1. AI PM
   - タスクを小さく切り、受け入れ条件と禁止範囲を明確にする。
2. Dev Agent
   - 承認された小タスクだけを実装し、対象ファイルと検証結果を明記する。
3. Reviewer / QA Agent
   - 差分をレビューし、設計逸脱、テスト不足、危険な変更を指摘する。
4. Docs Agent
   - 運用・設計・PR本文・引き継ぎを整備する。
5. Safety Agent
   - 秘密情報、未承認データ操作、本番操作、利用者に関わるリスクを確認する。
6. Handoff
   - 次のセッションが再開できるように、状態、残課題、検証結果を残す。

## Hard Rules

- main に直接pushしない。
- `.env` をstageしない。
- 未承認データを自動整理しない。
- real-vault Markdownを勝手に移動・改名・編集しない。
- SharePoint基盤を重複実装しない。
- 子ども・利用者をAIで診断しない。
- 本番apply / 自動import / 自動mergeは人間承認なしで実行しない。
- 大PRを作らない。
- 失敗CIを無視しない。

## Approval Boundaries

人間承認が必要なもの:

- main / protected branch への merge または push
- 本番環境、実データ、SharePoint import / apply に影響する操作
- `.env`、secret、token、認証設定、外部連携設定の変更
- package 追加、lockfile 変更、CI workflow 変更
- real-vault 配下または実運用記録の移動、改名、編集
- 利用者、子ども、職員の評価・診断・分類に見える判断
- 大きな設計変更、データモデル変更、SharePoint基盤変更
- 失敗CIを既知問題として扱う判断

## PR Discipline

- PRは小さく、1つの目的だけを扱う。
- docs-only、test-only、fix、refactorを混ぜない。
- 既存の未コミット差分を巻き込まない。
- 変更対象外ファイルの整形やリネームをしない。
- PR本文には Summary / Scope / Safety / Tests を含める。

## Required Task Flow

1. `.agents/daily-task.md` を確認する。
2. タスク brief を作る。
3. Dev Agent が最小差分を実装する。
4. Reviewer / QA Agent が差分を確認する。
5. Safety Agent が承認境界と禁止事項を確認する。
6. PR本文を作成する。
7. Handoff を残す。
