# Architecture Decision Records (ADR) Index

> 本プロジェクトでは、重要な設計判断を **ADR (Architecture Decision Record)** として記録しています。  
> 各 ADR は「なぜその設計にしたか」の根拠を残し、将来の開発者が判断の経緯を追えるようにします。

---

## ADR 一覧

| ADR | タイトル | ステータス | 日付 |
|-----|---------|-----------|------|
| [ADR-001](ADR-001-archive-strategy.md) | アーカイブ戦略の設計 | Accepted | — |
| [ADR-002](ADR-002-today-execution-layer-guardrails.md) | Today (/today) is an Execution Layer and must remain thin | Accepted | — |
| [ADR-003](ADR-003-fortress-criteria.md) | Fortress Criteria — モジュール品質基準の定義 | Accepted | — |
| [ADR-003b](ADR-003-local-day-keying-action-telemetry.md) | Local-day keying & action telemetry for Today Execution Layer | Accepted | — |
| [ADR-004](ADR-004-handoff-observability-fortification.md) | Handoff Observability Fortification | Accepted | — |
| [ADR-005](ADR-005-isp-three-layer-separation.md) | ISP 三層分離 — 個別支援計画と支援計画シート等を分離 | Accepted | — |
| [ADR-006](ADR-006-screen-responsibility-boundaries.md) | 画面責務・データ関係・Iceberg 位置の厳密定義 | Accepted | — |
| [ADR-007](ADR-007-assessment-planning-record-bridge.md) | Assessment → Planning → Record Bridge | Accepted | — |
| [ADR-008](ADR-008-workflow-phase-navigation-engine.md) | Workflow Phase Navigation Engine — 全画面巡回型ナビゲーション | Accepted | — |
| [ADR-009](ADR-009-support-operations-os-principles.md) | Support Operations OS 設計原則の採用 | Accepted | 2026-03-16 |
| [ADR-010](ADR-010-proposal-integration-layer.md) | 提案統合レイヤー（Proposal Integration Layer） | Accepted | 2026-03-16 |

---

## ADR のカテゴリ分類

### 🏛️ プロダクト思想

| ADR | 内容 |
|-----|------|
| ADR-009 | Support Operations OS 設計原則 10 箇条 |

### 🔵 ISP 三層モデル

| ADR | 内容 |
|-----|------|
| ADR-005 | L1 / L2 / L3 の分離設計 |
| ADR-006 | 画面責務の境界定義 |
| ADR-007 | Assessment → Planning → Record ブリッジ |

### 🟢 提案エンジン

| ADR | 内容 |
|-----|------|
| ADR-010 | 3 ソース統合の提案レイヤー |

### 🟠 Today / Handoff 運用

| ADR | 内容 |
|-----|------|
| ADR-002 | Today 画面の Execution Layer 制約 |
| ADR-003 | Fortress Criteria（品質基準） |
| ADR-003b | Local-day keying & テレメトリ |
| ADR-004 | Handoff の可観測性強化 |
| ADR-008 | ワークフローフェーズナビゲーション |

### 🔧 インフラ

| ADR | 内容 |
|-----|------|
| ADR-001 | アーカイブ戦略 |

---

## 新しい ADR を追加するには

1. `ADR-NNN-<slug>.md` を `docs/adr/` に作成する
2. 以下のフォーマットに従う

```markdown
# ADR-NNN: タイトル

> **Status**: Proposed | Accepted | Deprecated | Superseded
> **Date**: YYYY-MM-DD
> **PR**: #NNN (optional)

---

## コンテキスト
（なぜこの判断が必要になったか）

## 決定
（何を決めたか）

## 理由
（なぜそう決めたか）

## 利点
（この判断のメリット）

## トレードオフ
（この判断のデメリットや注意点）
```

3. 本ファイル（`README.md`）の一覧表に追加する

---

## 関連文書

| ドキュメント | パス |
|-------------|------|
| 設計原則 10 箇条 | [docs/product/principles.md](../product/principles.md) |
| UI 設計規約 | [docs/product/ui-conventions.md](../product/ui-conventions.md) |
| OS Architecture | [docs/product/support-operations-os-architecture.md](../product/support-operations-os-architecture.md) |
| ロードマップ | [docs/product/roadmap.md](../product/roadmap.md) |
