# Audit Management System MVP Documentation Map

対象コミット: `94ae88219ace41d9331e6f18fc66f4613884e9c9`
最終更新: 2026年6月19日

---

## 1. 概要
本ドキュメントは、Audit Management System MVP のアーキテクチャ調査・運用手順書シリーズ（全12本）の索引です。
各ドキュメントの目的、主な読者、および推奨される参照順序を一覧化し、必要な情報へ素早くたどり着けるようにします。

---

## 2. ドキュメント一覧

### Architecture（設計・分析）

| # | ドキュメント | ファイルパス | 目的 | 主な読者 | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | Frontend Structure | [frontend-structure.md](./frontend-structure.md) | フロントエンド全体のディレクトリ構造と責務分離の可視化 | 開発者 | #2313 |
| 2 | Feature Inventory | [feature-inventory.md](./feature-inventory.md) | 全機能の棚卸しと実装状況の整理 | 開発者 / 管理者 | #2314 |
| 3 | Data Flow Readiness | [data-flow-readiness.md](./data-flow-readiness.md) | SharePoint との読み書きデータフローの実運用可否判定 | 開発者 / 運用者 | #2315 |
| 4 | SharePoint Schema Repository Map | [sharepoint-schema-repository-map.md](./sharepoint-schema-repository-map.md) | SharePoint リスト定義とリポジトリ層の対応関係 | 開発者 | #2316 |
| 5 | Test Coverage Quality Matrix | [test-coverage-quality-matrix.md](./test-coverage-quality-matrix.md) | テストカバレッジと品質の評価マトリクス | 開発者 | #2317 |
| 6 | Permission Navigation Matrix | [permission-navigation-matrix.md](./permission-navigation-matrix.md) | 権限ロールとナビゲーション導線の整理 | 開発者 / 管理者 | #2319 |
| 7 | Observability Runbook Map | [observability-runbook-map.md](./observability-runbook-map.md) | テレメトリ・ログ・監視ポイントの配置と運用導線 | 開発者 / 運用者 | #2320 |
| 8 | Action Engine Rule Catalog | [action-engine-rule-catalog.md](./action-engine-rule-catalog.md) | 提案エンジンのルール一覧と安全境界の整理 | 開発者 | #2321 |
| 9 | CI Failure Taxonomy | [ci-failure-taxonomy.md](./ci-failure-taxonomy.md) | CI 失敗パターンの分類とトリアージ判断基準 | 開発者 / 運用者 | #2322 |
| 10 | Record Quality Human Review Lifecycle | [record-quality-human-review-lifecycle.md](./record-quality-human-review-lifecycle.md) | AI 生成レビューの人間確認・承認・破棄の安全フロー | 開発者 / 管理者 | #2323 |

### Operations（現場運用・保守）

| # | ドキュメント | ファイルパス | 目的 | 主な読者 | PR |
| --- | --- | --- | --- | --- | --- |
| 11 | Kiosk Operational Manual | [kiosk-operational-manual.md](../operations/kiosk-operational-manual.md) | 共有タブレットでのキオスクモード操作手順 | 現場職員 / 管理者 | #2324 |
| 12 | SharePoint Provisioning Runbook | [sharepoint-provisioning-runbook.md](../operations/sharepoint-provisioning-runbook.md) | SharePoint 不整合・接続劣化の復旧手順 | 管理者 / 運用者 | #2325 |

---

## 3. 読者別ガイド

### 開発者（Developer）

新規参画や機能開発の開始時は、以下の順番で読み進めることを推奨します。

```
1. Frontend Structure        … 全体構造の把握
2. Feature Inventory          … 機能の全体像を掴む
3. Data Flow Readiness        … データがどう流れるかを理解
4. SharePoint Schema Map      … SP リスト⇔コードの対応
5. Test Coverage Matrix       … テスト状況の把握
6. Action Engine Rule Catalog … 提案ロジックの理解
7. CI Failure Taxonomy        … PR 運用の判断基準
```

### 管理者・運用担当（Admin / Operator）

運用開始や障害対応の際は、以下を参照してください。

```
1. Observability Runbook Map          … 監視とアラートの全体像
2. CI Failure Taxonomy                … CI の失敗分類と対応判断
3. SharePoint Provisioning Runbook    … SP 障害時の復旧手順
4. Permission Navigation Matrix       … 権限設定の確認
5. Record Quality Human Review        … レビュー承認の安全フロー
```

### 現場職員（Field Staff）

日常の支援記録業務で参照するドキュメントです。

```
1. Kiosk Operational Manual … タブレット操作の全手順
```

---

## 4. ドキュメント間の関連

```
Frontend Structure ──→ Feature Inventory ──→ Data Flow Readiness
                                                    │
                                                    ▼
                                    SharePoint Schema Repository Map
                                                    │
                                   ┌────────────────┼────────────────┐
                                   ▼                ▼                ▼
                          Test Coverage      Observability     Permission
                          Quality Matrix     Runbook Map       Navigation Matrix
                                   │                │
                                   ▼                ▼
                          CI Failure          SharePoint Provisioning
                          Taxonomy            Runbook (Operations)
                                   │
                                   ▼
                          Action Engine ──→ Record Quality
                          Rule Catalog      Human Review Lifecycle
                                                    │
                                                    ▼
                                            Kiosk Operational
                                            Manual (Operations)
```

---

## 5. 既存運用ドキュメントとの関係
本シリーズは、従来から存在する以下のドキュメントを補完する位置づけです。

| 既存ドキュメント | 本シリーズでの対応 |
| --- | --- |
| `docs/operations/sp-health-admin-runbook.md` | SharePoint Provisioning Runbook（#2325）が管理者向け復旧手順を拡充 |
| `docs/operations/operations-runbook.md` | Observability Runbook Map（#2320）が監視ポイントを体系化 |
| `docs/architecture/system-architecture-complete.md` | Frontend Structure（#2313）が実コード構造に基づく補足を追加 |

---

## 6. 次のアクション候補
本ドキュメントシリーズの調査結果から派生する、推奨される次の実装・テスト補強候補です。

| 優先度 | 作業候補 | 根拠ドキュメント | 目的 |
| --- | --- | --- | --- |
| 高 | Navigation / Permission の E2E テスト追加 | Permission Navigation Matrix | 直アクセス境界の事故防止 |
| 高 | Kiosk 運用のテスト補強 | Kiosk Operational Manual | 現場投入前の品質確保 |
| 中 | SharePoint Provisioning Runbook と UI 文言の整合 | SharePoint Provisioning Runbook | 管理者対応の迷い防止 |
| 中 | Record Quality lifecycle の UI / テスト補強 | Record Quality Human Review | 安全境界の強化 |
| 中 | Action Engine 未テストルールの補強 | Action Engine Rule Catalog | 提案ロジックの回帰防止 |
| 低 | CI Failure Taxonomy に沿った PR テンプレ改善 | CI Failure Taxonomy | 運用負荷の低減 |
