---
description: Triage AI — Nightly Patrol レポートから改善Issueを起票する朝のルーティン
---

# Triage AI ワークフロー

あなたは朝のトリアージ担当です。
Nightly Patrol レポートの検知結果を読み、対応すべき項目を Issue に変換します。

## コンテキスト

毎晩 JST 03:15 に Nightly Patrol が `docs/nightly-patrol/YYYY-MM-DD.md` にレポートを生成します。
このワークフローは、そのレポートの 🔴/🟡 項目を1件ずつ Issue 化する「朝のルーティン」です。

## 手順

1. 最新の Nightly Patrol レポートを読む
   - `docs/nightly-patrol/` の最新ファイルを確認
   // turbo

2. トリアージ判定を行う

   ### トリアージ優先度（上から順に見る）

   | 優先度 | 観点 | 判断基準 | 次のアクション |
   |:------:|------|---------|-------------|
   | 1 | テスト未整備 | feature にテストが1つもない | `/test-design` → `/issue` |
   | 2 | 巨大ファイル (800行超) | 即分割が必要 | `/scan` → `/refactor` → `/issue` |
   | 3 | 巨大ファイル (600-800行) | 次の変更時に分割 | `/issue`（バックログ） |
   | 4 | any 集中 | 型安全性の劣化 | `/review` → `/issue` |
   | 5 | Handoff 未実施 | 引き継ぎ断絶 | `/handoff` で即対応 |
   | 6 | TODO/FIXME | 放置された技術負債 | 30日超なら `/issue` |

3. 対応する項目を1件選び、以下のテンプレで Issue 化する

   ### Patrol → Issue 変換テンプレート

   ```markdown
   ## Issue: [type]([scope]): [パトロールで検知した問題の1行サマリ]

   ### 検知元
   - Nightly Patrol: `docs/nightly-patrol/YYYY-MM-DD.md`
   - 観点: 巨大ファイル / any / テスト未整備 / ...
   - ステータス: 🔴 / 🟡

   ### 対象
   - ファイル: `src/features/xxx/...`
   - 現在値: 842行 / any 5件 / テスト 0件

   ### 方針
   （/scan や /refactor-plan の出力を貼る）

   ### 受入条件
   - [ ] ...
   - [ ] 次回の Nightly Patrol で 🟢 になること

   ### ラベル
   `patrol`, `[priority]`, `[scope]`
   ```

4. 1日1件を目安に消化する（全部一度にやらない）

## 朝のルーティンフロー

```
08:30  レポート確認（docs/nightly-patrol/最新.md）
         ↓
       🔴 があるか？
         ├─ Yes → 1件選んで /triage
         │         ↓
         │       対象を /scan で確認
         │         ↓
         │       /issue で起票
         │         ↓
         │       今日の作業に組み込むか判断
         │
         └─ No → 🟡 を確認
                   ├─ バックログに入れる
                   └─ 対応不要なら次へ
         ↓
       通常の開発作業を開始
```

## 観点別の変換パターン

### パターン A: 巨大ファイル → `/refactor` Issue

```
/triage
対象: src/domain/isp/schema.ts (1030行)

→ /scan L2 でファイルの責務を確認
→ /refactor で分割計画を出す
→ /issue で起票

Issue タイトル: refactor(isp): schema.ts の3層分割 (1030行 → 目標300行×3)
```

### パターン B: テスト未整備 → `/test-design` Issue

```
/triage
対象: src/features/safety/ (テストなし, コード14ファイル)

→ /scan L1 で構成を把握
→ /test-design で観点整理
→ /issue で起票

Issue タイトル: test(safety): 安全管理モジュールのテスト設計と実装
```

### パターン C: any 集中 → `/review` Issue

```
/triage
対象: src/data/isp/sharepoint/ (any 3件)

→ /scan L2 で型定義の現状を確認
→ /review で修正方針を出す
→ /issue で起票

Issue タイトル: fix(isp): SharePoint Repository の型安全化 (any → 型定義)
```

### パターン D: TODO 放置 → バックログ Issue

```
/triage
対象: src/features/monitoring/domain/ispPlanDraftUtils.ts (TODO 3件)

→ TODO の内容を確認
→ 対応必要なら /issue
→ 不要なら TODO を削除する /issue

Issue タイトル: chore(monitoring): ispPlanDraftUtils の放置TODO整理
```

## 週次サマリー（金曜日）

金曜日の終わりに、1週間のトリアージ結果をまとめる:

```markdown
## 週次トリアージサマリー — YYYY-Www

| 日付 | 検知 | 対応 | Issue | 備考 |
|------|:----:|:----:|:-----:|------|
| 月 | 🔴 2, 🟡 3 | 1件 | #XXX | schema分割 |
| 火 | 🔴 2, 🟡 3 | 0件 | — | 開発優先 |
| ... | ... | ... | ... | ... |

消化率: X / Y 件
```

## 禁止事項
- 全件を一度に Issue 化しない（1日1件が目安）
- ノイズを無理に Issue 化しない（対応不要なら Skip）
- レポートを読まずに開発を始めない
- 🔴 を3日以上放置しない
