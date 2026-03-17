# ADR-012: AI Dev OS の導入

## ステータス

**承認済** — 2026-03-17

## コンテキスト

プロジェクトは500超のコミットが週次で発生する活発な開発体制にある。
しかし以下の問題が顕在化していた。

### 問題

1. **AIへの指示が属人的**: 毎回の会話でゼロからコンテキストを構築しており、再現性がない
2. **技術負債の発見が遅い**: 巨大ファイルや型安全性の劣化を発見するのが事後的
3. **セッション間の断絶**: AI開発セッション間の引き継ぎが口頭レベルで、コンテキストが消失する
4. **品質ゲートの不統一**: PR前に何をチェックすべきかが暗黙知
5. **福祉制度固有の観点**: 監査対応・ISP・記録設計など、一般的なAI支援ではカバーされない観点がある

### 影響範囲

- 全開発ワークフロー
- CI/CD パイプライン（Nightly Patrol 追加）
- ドキュメント体系（handoff, patrol reports）
- 開発者の日常運用（朝のトリアージ）

## 決定

**AI Dev OS** を導入する。これは26のAIワークフローコマンド、深夜自動巡回、メトリクスダッシュボード、運用ルールから構成される開発運用フレームワークである。

### アーキテクチャ

```
深夜 03:15  Nightly Patrol
              ├─ コード品質スキャン（5観点）
              └─ Health Score ダッシュボード
               ↓
朝            /triage → 🔴 を1件選択 → /issue
               ↓
日中          /scan → /define → /design → /implement
               ↓
夕方          /review → /fortress → /pr
               ↓
終業          /handoff → docs/handoff/
               ↓
深夜          Nightly Patrol（翌日）
```

### 6 Phase × 26 Commands

| Phase | Purpose | Commands |
|:-----:|---------|----------|
| 0 | 調査・トリアージ | `/scan`, `/triage` |
| 1 | 要件定義 | `/define` |
| 2 | 設計 | `/architect`, `/design`, `/sp-schema`, `/plan-sheet`, `/record-design` |
| 3 | 実装 | `/implement`, `/powerapps`, `/flow`, `/react-feature`, `/cursor-task` |
| 4 | 検証 | `/review`, `/fortress`, `/compliance`, `/test`, `/test-design`, `/ux-review`, `/debug` |
| 5 | 資産化 | `/issue`, `/pr`, `/handoff`, `/docs`, `/refactor`, `/refactor-plan` |

### Health Score（0-100）

```
Score = 100
        − (巨大ファイル × 5)
        − (any使用 × 2)
        − (テスト未整備 × 3)
        − (TODO × 1, max 10)
        + (Handoff実施 × 5)
```

### 5つの運用ルール

| Rule | 内容 |
|------|------|
| 1 | `/scan` は3ファイル以上の変更時に必須 |
| 2 | `/refactor-plan` は1 feature を超える影響範囲で必須 |
| 3 | PR前に `/review` 必須、本番データ影響時は `/fortress` も |
| 4 | `/handoff` は毎日終業時に `docs/handoff/` に保存 |
| 5 | Nightly Patrol レポートは毎朝確認 |

### 段階的導入（Phase A → B → C）

| Phase | 内容 | 条件 |
|:-----:|------|------|
| **A** | レポート出力のみ（現在） | 即日導入 |
| B | Draft Issue 生成（人が承認して公開） | 2週間の安定運用後 |
| C | 条件付き自動 Issue 起票（1日最大3件） | Phase B 安定後 |

## 代替案

### 案1: チェックリストベースの手動運用
- ❌ 人が忘れると回らない。巡回できない

### 案2: 汎用 Linter / SonarQube 導入
- ❌ 福祉制度固有の観点（ISP・監査・記録設計）をカバーできない
- ❌ ワークフロー全体の統合（Define → Package）にはならない

### 案3: LLM を直接 CI に組み込む提案型
- ❌ コスト・暴走リスクが高い。Phase A → C の段階設計が安全

## 結果

- AIへの指示が `.agents/workflows/` で標準化され、再現可能
- 技術負債が毎晩自動検知され、翌朝のトリアージで対応可能
- セッション間の引き継ぎが `docs/handoff/` で構造化
- コード品質が Health Score として日次で可視化
- 福祉制度固有の設計観点が `/compliance`, `/plan-sheet`, `/record-design` でカバー

### 初回 Baseline（2026-03-17）

| 指標 | 値 |
|------|-----|
| Health Score | 0 / 100 (Grade F) |
| 巨大ファイル | 6件（`schema.ts` 1030行が最大） |
| any 使用 | 10件（SharePoint Repository に集中） |
| テスト未整備 | 16 feature |
| コミット活動 | 594 / 7日 |

## 設計思想

AI Dev OS はソフトウェア開発における **Toyota Production System（TPS）の適応** である。

| TPS 原則 | AI Dev OS の実装 | 共通する機能 |
|---------|----------------|------------|
| **自働化（Jidoka）** | Phase A → B → C | 機械が検知し、人が判断する |
| **カイゼン** | `/triage` → 1日1件 | 止めずに、毎日少しだけ良くする |
| **アンドン（異常表示灯）** | Health Score 🔴🟡🟢 | 問題を即座に全員に可視化する |
| **標準作業** | 26 Workflows | 作業を標準化し、属人性を排除する |
| **ポカヨケ（防止装置）** | `/fortress` + 運用ルール | 事故を仕組みで防ぐ |
| **かんばん** | Metrics Dashboard | 流れの状態を1枚で把握する |

核心原則: **止めずに、毎日少しだけ良くする（カイゼン）。ただし異常検知と停止の仕組みを必ず持つ（自働化）。**

## 関連ドキュメント

- [Architecture Overview](../ai-dev-os/ARCHITECTURE.md)
- [AI Dev OS README](../ai-dev-os/README.md)
- [運用ルール](../operations/ai-dev-os-rules.md)
- [PR #1018](https://github.com/yasutakesougo/audit-management-system-mvp/pull/1018)
