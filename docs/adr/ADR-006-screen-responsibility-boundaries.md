# ADR-006: 画面責務・データ関係・Iceberg 位置の厳密定義

## Status

Accepted — 2026-03-13

## Context

ADR-005 で ISP 三層構造（ISP → 支援計画シート → 支援手順書兼記録）を
採用することが決定された。

しかし、ADR-005 は **データモデルの分離** を主題としており、
以下が未定義のままだった。

- 各画面の **責務境界**（何を扱い、何を扱わないか）
- 画面間の **遷移関係**
- Iceberg 分析の **正しい紐付け先**
- RegulatoryDashboard の各データソースとの関係
- AI エージェントが**してはならない設計判断**

これらが曖昧なまま開発を進めると、以下のリスクがある。

- AI エージェントが支援計画シートを ISP の一部として実装する
- Daily 画面に支援計画シートの編集機能が混入する
- Iceberg 分析が ISP に直接紐付けられ、制度上の根拠が不整合になる

本 ADR は ADR-005 を **運用レベルに拡張** し、
画面・データ・AI の設計判断を厳密に定義する。

## Decision

### 1. 用語定義

#### ISP（Individual Support Plan / 個別支援計画）

**定義**: 利用者に対する支援の **上位計画文書**。
支援の方向性・目標・期間を定義する。

**管理対象**:

| カテゴリ | 内容 |
|---------|------|
| 意向 | 本人意向、家族意向 |
| 方針 | 総合的支援方針 |
| 目標 | 長期目標、短期目標 |
| 期間 | 計画期間、達成時期 |
| 証跡 | 同意日、交付日 |
| 運用 | 見直し日、モニタリング結果 |

#### 支援計画シート（Planning Sheet）

**定義**: 強度行動障害支援対象者の支援設計を管理する **実務文書**。
ISP とは **別管理** であり、ISP の下位にある専門支援設計文書。

**管理対象**:

| セクション | 内容 |
|-----------|------|
| intake（情報収集） | 行動の背景、医療・健康要因、感覚特性、環境要因 |
| assessment（行動理解） | 対象行動、ABC 観察、行動機能仮説、リスク評価 |
| planning（支援設計） | 支援課題、先行事象戦略、教授戦略、後続事象戦略、危機対応、支援手順 |
| 制度項目 | 作成者資格、対象サービス、対象加算、交付日、見直し日 |

#### Daily 画面（支援実行）

**定義**: 支援計画シートで設計された支援手順を **実行・記録** する画面。

**入力**: `userId`, `planningSheetId`

**処理フロー**:
```
PlanningSheet → procedureSteps → Daily表示 → 実施 → SupportProcedureRecord
```

---

### 2. 画面責務の境界

#### ISP 画面 (`/support-plan-guide`)

**扱うもの**:
- ISP の作成・確認・見直し
- モニタリング結果の管理
- ISP に紐づく支援計画シート一覧の **表示**
- 制度サマリー帯（RegulatorySummaryBand）

**扱わないもの**:
- 強度行動障害支援の仮説
- 支援課題
- 行動分析（Iceberg）
- 支援手順
- 日々の実施記録

#### 支援計画シート画面 (`/support-planning-sheet/:planningSheetId`)

**扱うもの**:
- 支援計画シートの作成・確認・見直し
- Iceberg 分析との接続
- Monitoring との接続
- Daily 実行画面への導線

**扱わないもの**:
- ISP 本文の編集

#### Daily 画面 (`/daily/support`)

**扱うもの**:
- 支援手順の表示
- 支援の実施
- 実施状況の記録
- ABC 記録
- 申し送り
- 特記事項

**扱わないもの**:
- ISP 本文の編集
- 支援計画シート本体の編集

---

### 3. 画面遷移関係

```
ISP (/support-plan-guide)
        │
        │  支援計画シート一覧から遷移
        ▼
支援計画シート (/support-planning-sheet/:id)
        │
        │  支援手順の実行画面へ遷移
        ▼
Daily 実行 (/daily/support)
```

---

### 4. データ関係

```
ISP
 │
 │ 1:N 参照
 │
 ▼
PlanningSheet
 │
 │ 1:N 紐付け
 │
 ▼
SupportProcedureRecord
```

---

### 5. Iceberg 分析の位置付け

Iceberg は **PlanningSheet** に紐づく。

```
PlanningSheet ←── Iceberg PDCA 分析
```

**理由**: Iceberg 分析は行動分析・仮説・支援課題に関するものであり、
ISP（上位計画）ではなく支援計画シート（専門支援設計）の **根拠** だからである。

**コード上のデータフロー**:

```
IcebergPdcaItem.planningSheetId
        │
        ▼
aggregateIcebergEvidence()  →  IcebergEvidenceBySheet
        │                            │
        ▼                            ▼
useIcebergEvidence(userId)    resolveFindingEvidence()
        │                            │
   ┌────┴────┐                        ▼
   ▼         ▼               RegulatoryDashboardPage
SPG Page   Dashboard         (finding 行の inline evidence)
```

両画面（RegulatoryDashboard / SupportPlanGuidePage）は
**同じ `useIcebergEvidence` hook** から evidence を取得し、
同一 user / planningSheet に対して同じ件数・直近日付が表示される。

---

### 6. RegulatoryDashboard の位置付け

```
RegulatoryDashboard
 │
 ├── ISP（見直し期限、ステータス）
 ├── PlanningSheet（作成者資格、加算対象、交付状況）
 ├── Iceberg（分析件数、直近分析日 → evidence summary）
 └── ProcedureRecord（実施記録件数）
```

**役割**:
- 制度遵守チェック（AuditFinding 生成）
- 根拠の提示（FindingEvidenceSummary）
- 修正画面への導線（FindingAction）

---

### 7. コード構造との対応

| ドメイン概念 | コードの場所 | 責務 |
|------------|------------|------|
| ISP スキーマ | `src/domain/isp/schema.ts` | 型定義・バリデーション |
| ISP Repository Port | `src/domain/isp/port.ts` | Repository インターフェース |
| ISP ガイド画面 | `src/pages/SupportPlanGuidePage.tsx` | ISP 作成・見直し UI |
| ISP フォーム Hook | `src/features/support-plan-guide/` | ISP フォーム管理 |
| PlanningSheet 型 | `src/domain/isp/schema.ts` — `SupportPlanningSheet` | 第 2 層型定義 |
| ProcedureRecord 型 | `src/domain/isp/schema.ts` — `SupportProcedureRecord` | 第 3 層型定義 |
| Iceberg PDCA | `src/features/ibd/analysis/pdca/` | PDCA 分析 UI・データ |
| Iceberg Evidence 集計 | `src/domain/regulatory/aggregateIcebergEvidence.ts` | 純粋集計関数 |
| Evidence Hook | `src/features/ibd/analysis/pdca/queries/useIcebergEvidence.ts` | React Query ラッパー |
| 制度チェックエンジン | `src/domain/regulatory/auditChecks.ts` | AuditFinding 生成 |
| Evidence Summary | `src/domain/regulatory/findingEvidenceSummary.ts` | Finding → 根拠解決 |
| Regulatory Dashboard | `src/pages/RegulatoryDashboardPage.tsx` | 制度遵守ダッシュボード |

---

## AI エージェント向け禁止事項

以下の設計判断を行ってはならない。

### 禁止 1: 支援計画シートを ISP の一部として実装する

支援計画シートは ISP の **下位文書** であり、
ISP のフォーム内に埋め込んではならない。
両者は **別画面・別 Repository・別ライフサイクル** で管理する。

### 禁止 2: Daily 画面に支援計画シートの編集機能を追加する

Daily 画面は **支援の実行と記録** のみを扱う。
支援計画シートの構造変更は支援計画シート画面の責務である。

### 禁止 3: Iceberg 分析を ISP に直接紐付ける

Iceberg 分析は **PlanningSheet** に紐づく。
`IcebergPdcaItem.planningSheetId` が正しい参照先であり、
`IcebergPdcaItem.ispId` のようなフィールドを追加してはならない。

### 禁止 4: evidence source を画面ごとに分岐させる

RegulatoryDashboard と SupportPlanGuidePage は
**同一の `useIcebergEvidence` hook** を使用する。
画面固有のローカル集計を新設してはならない。

---

## Consequences

### Positive

- AI エージェントの設計判断が厳密にガードされる
- 画面責務が明確になり、機能混入を防止できる
- Iceberg の紐付け先が一貫する
- Dashboard と Guide で evidence の不整合が発生しない
- コードレビューでの判断基準が明文化される

### Negative / Trade-offs

- 支援計画シート専用画面（`/support-planning-sheet/:id`）の新設が必要
- 画面間遷移の UX 設計にコストがかかる
- ADR-005 との重複記載がある（意図的: 本 ADR は運用レベルの拡張）

---

## References

- [ADR-005: ISP 三層分離](./ADR-005-isp-three-layer-separation.md)
- [AI ISP 三層プロトコル](../ai-isp-three-layer-protocol.md)
- [RegulatoryDashboardPage](../../src/pages/RegulatoryDashboardPage.tsx)
- [SupportPlanGuidePage](../../src/pages/SupportPlanGuidePage.tsx)
- [useIcebergEvidence](../../src/features/ibd/analysis/pdca/queries/useIcebergEvidence.ts)
- [aggregateIcebergEvidence](../../src/domain/regulatory/aggregateIcebergEvidence.ts)

---

## Changelog

- 2026-03-13: Phase C/D（Iceberg 実データ接続）完了を受けて、画面責務・evidence source の統一を厳密化
