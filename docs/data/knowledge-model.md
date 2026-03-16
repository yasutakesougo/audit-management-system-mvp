# Knowledge Layer — データモデル定義

> **ドキュメント種別:** データモデル仕様  
> **ステータス:** Draft  
> **初版:** 2026-03-16  
> **最終更新:** 2026-03-16  
> **準拠:** [設計原則 10 箇条](../product/principles.md) / [OS Architecture § Knowledge Layer](../product/support-operations-os-architecture.md#10-knowledge-layer)

---

## 概要

Knowledge Layer は、すべての判断・反映・却下を  
**組織の判断資産** として蓄積するためのデータモデルである。

> **原則 8:** 履歴は単なるログではなく、組織の判断資産として扱う。

このデータモデルが支える 4 つの用途:

| 用途 | 説明 |
|------|------|
| **新人教育** | 過去の判断事例を学習材料にできる |
| **引き継ぎ** | 担当交代時の情報ロスを最小化 |
| **監査説明** | 根拠付きの判断履歴を即時提示可能 |
| **AI 改善** | 採用/却下パターンから提案品質を改善 |

---

## エンティティ関連図

```
┌──────────────────────────────────────────────────────────────────┐
│                     Knowledge Layer                              │
│                                                                  │
│  ┌────────────────────────┐                                      │
│  │ PlanningProposalBundle │──── 1つの提案パッケージ              │
│  │                        │                                      │
│  │  source                │                                      │
│  │  urgency               │                                      │
│  │  summary               │                                      │
│  │  fieldProposals[]      │                                      │
│  │  provenance            │                                      │
│  └───────────┬────────────┘                                      │
│              │ 1:1                                                │
│              ▼                                                    │
│  ┌────────────────────────┐                                      │
│  │ ProposalAdoptionRecord │──── 人の判断結果                     │
│  │                        │                                      │
│  │  action (accept/dismiss)│                                     │
│  │  dismissReason          │                                     │
│  │  selectedFields[]       │                                     │
│  │  decidedBy              │                                     │
│  │  decidedAt              │                                     │
│  │  provenance             │                                     │
│  └───────────┬────────────┘                                      │
│              │ 1:N                                                │
│              ▼                                                    │
│  ┌────────────────────────┐                                      │
│  │ ProvenanceEntry        │──── フィールド単位の出典             │
│  │                        │                                      │
│  │  field                  │                                     │
│  │  source                 │                                     │
│  │  reason                 │                                     │
│  │  value                  │                                     │
│  │  timestamp              │                                     │
│  └────────────────────────┘                                      │
│                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────┐        │
│  │ ImportAuditRecord      │    │ PlanningSheetVersion   │        │
│  │                        │    │                        │        │
│  │  mode                  │    │  versionId             │        │
│  │  affectedFields[]      │    │  snapshot              │        │
│  │  planningSheetId       │    │  createdAt             │        │
│  │  timestamp             │    │  reason                │        │
│  └────────────────────────┘    └────────────────────────┘        │
│                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────┐        │
│  │ IspDecisionRecord      │    │ EvidenceLink           │        │
│  │                        │    │                        │        │
│  │  recommendationId      │    │  planningSheetId       │        │
│  │  action                │    │  targetType (abc/pdca) │        │
│  │  reason                │    │  targetId              │        │
│  │  decidedBy             │    │  strategyKey           │        │
│  │  decidedAt             │    │  createdAt             │        │
│  └────────────────────────┘    └────────────────────────┘        │
│                                                                  │
│  ┌────────────────────────┐                                      │
│  │ MonitoringMeeting      │                                      │
│  │                        │                                      │
│  │  meetingDate            │                                     │
│  │  participants[]         │                                     │
│  │  decisions[]            │                                     │
│  │  nextActions[]          │                                     │
│  └────────────────────────┘                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## エンティティ定義

### PlanningProposalBundle

> 3 ソース（申し送り・ABC・モニタリング）からの統合提案。

```typescript
interface PlanningProposalBundle {
  id: string;
  source: ProposalSource;           // 'handoff' | 'abc' | 'monitoring'
  sourceLabel: string;              // 人間向けラベル
  userCode: string;                 // 対象利用者
  urgency?: ProposalUrgency;        // 'urgent' | 'recommended' | 'suggested'
  summary: string;                  // 提案の要約
  fieldProposals: PlanningFieldProposal[];
  provenance: {
    sourceType: ProposalSource;
    sourceIds: string[];            // 参照元レコード ID
    generatedAt: string;            // ISO 8601
  };
}
```

**実装:** [proposalBundle.ts](../../src/features/handoff/analysis/proposalBundle.ts)

---

### PlanningFieldProposal

> 提案内のフィールドレベルの変更候補。

```typescript
interface PlanningFieldProposal {
  fieldKey: string;                 // 対象フィールドのキー
  sectionKey: string;               // 対象セクション
  action: 'add' | 'append' | 'replace' | 'keep';
  label: string;                    // 人間向けラベル
  currentValue?: string;            // 現在値
  proposedValue: string;            // 提案値
  reason: string;                   // なぜこの変更か
}
```

---

### ProposalAdoptionRecord

> 人が提案に対して行った判断の記録。Knowledge Layer の中核。

```typescript
interface ProposalAdoptionRecord {
  id: string;
  proposalBundleId: string;         // 対象の提案
  source: ProposalSource;
  action: 'accepted' | 'dismissed' | 'deferred';
  dismissReason?: DismissReason;     // 却下理由
  selectedFields: string[];          // 採用時: 反映したフィールド
  decidedBy: string;                 // 操作者
  decidedAt: string;                 // ISO 8601
  planningSheetId: string;
  provenance: {
    sourceType: ProposalSource;
    sourceIds: string[];
    generatedAt: string;
  };
}

type DismissReason =
  | 'not_applicable'     // この利用者には該当しない
  | 'already_addressed'  // すでに対応済み
  | 'insufficient_data'  // データ不足で判断できない
  | 'disagree'           // 判断が異なる
  | 'other';             // その他
```

**実装:** [proposalBundle.ts](../../src/features/handoff/analysis/proposalBundle.ts)

---

### ProvenanceEntry

> フィールドの出典を 1 件単位で記録。

```typescript
interface ProvenanceEntry {
  field: string;                    // observationFacts, supportPolicy, etc.
  source: ProvenanceSource;         // assessment_icf, tokusei, monitoring, etc.
  reason: string;                   // 変換理由
  value: string;                    // 入力値
  timestamp: string;                // ISO 8601
}

type ProvenanceSource =
  | 'assessment_icf'    // 🔵
  | 'tokusei'           // 🟢
  | 'monitoring'        // 🟠
  | 'handoff'           // 🟣
  | 'abc'               // 🔴
  | 'manual';           // ⚪
```

---

### ImportAuditRecord

> ブリッジ取込操作の監査記録。

```typescript
interface ImportAuditRecord {
  id: string;
  mode: ImportMode;
  affectedFields: string[];
  planningSheetId: string;
  timestamp: string;                // ISO 8601
  operatorId?: string;
}

type ImportMode =
  | 'assessment-only'
  | 'with-tokusei'
  | 'behavior-monitoring'
  | 'planning-to-record'
  | 'template-import';
```

**実装:** [importAuditStore.ts](../../src/features/planning-sheet/stores/importAuditStore.ts)

---

### PlanningSheetVersion

> 支援計画シートのスナップショット（版管理）。

```typescript
interface PlanningSheetVersion {
  versionId: string;
  planningSheetId: string;
  snapshot: PlanningSheetData;       // 当時の全データ
  createdAt: string;                 // ISO 8601
  reason: string;                    // 版作成理由
  createdBy?: string;
}
```

**実装:** [planningSheetVersion.ts](../../src/domain/isp/planningSheetVersion.ts)  
**永続化:** [localPlanningSheetVersionRepository.ts](../../src/infra/localStorage/localPlanningSheetVersionRepository.ts)

---

### IspDecisionRecord

> ISP 推奨に対する判断記録。

```typescript
interface IspDecisionRecord {
  id: string;
  recommendationId: string;
  userCode: string;
  action: 'accepted' | 'dismissed' | 'modified';
  reason?: string;
  decidedBy: string;
  decidedAt: string;                // ISO 8601
  appliedChanges?: Record<string, unknown>;
}
```

**実装:** [IspDecisionRepository.ts](../../src/features/monitoring/data/IspDecisionRepository.ts)  
**アダプター:** [InMemoryIspDecisionRepository.ts](../../src/features/monitoring/data/InMemoryIspDecisionRepository.ts)、[SharePointIspDecisionRepository.ts](../../src/features/monitoring/data/SharePointIspDecisionRepository.ts)

---

### EvidenceLink

> 支援計画シートと ABC / PDCA レコードの参照リンク。

```typescript
interface EvidenceLink {
  id: string;
  planningSheetId: string;
  targetType: 'abc' | 'pdca';
  targetId: string;
  strategyKey: string;               // リンク先の支援戦略キー
  createdAt: string;                 // ISO 8601
}
```

**実装:** [evidenceLink.ts](../../src/domain/isp/evidenceLink.ts)  
**永続化:** [localEvidenceLinkRepository.ts](../../src/infra/localStorage/localEvidenceLinkRepository.ts)

---

### MonitoringMeeting

> モニタリング会議の記録。

```typescript
interface MonitoringMeeting {
  id: string;
  meetingDate: string;               // ISO 8601
  participants: string[];
  userCodes: string[];               // 議題の利用者
  decisions: MeetingDecision[];
  nextActions: NextAction[];
  notes?: string;
}
```

**実装:** [monitoringMeeting.ts](../../src/domain/isp/monitoringMeeting.ts)  
**永続化:** [localMonitoringMeetingRepository.ts](../../src/infra/localStorage/localMonitoringMeetingRepository.ts)

---

## データフロー

```
Observation Layer
  │
  │  Daily / ABC / Handoff / Monitor
  │
  ├─────────────────────────┐
  │                         │
  ▼                         ▼
Insight Engine           Bridge 操作
  │                         │
  │ 分析結果                │ ImportAuditRecord
  │                         │ ProvenanceEntry[]
  ▼                         │
Proposal Engine             │
  │                         │
  │ PlanningProposalBundle  │
  │                         │
  ▼                         │
Human Decision              │
  │                         │
  │ ProposalAdoptionRecord  │
  │ IspDecisionRecord       │
  │                         │
  ▼                         ▼
Knowledge Repository
  │
  ├── ProposalAdoptionRecord[]   ← 提案採用/却下の履歴
  ├── IspDecisionRecord[]        ← ISP 推奨の判断履歴
  ├── ProvenanceEntry[]          ← フィールド出典
  ├── ImportAuditRecord[]        ← 取込監査ログ
  ├── PlanningSheetVersion[]     ← 版管理スナップショット
  ├── EvidenceLink[]             ← エビデンス参照リンク
  └── MonitoringMeeting[]        ← 会議記録
```

---

## 分析クエリ（将来の AI 基盤）

Knowledge Repository に蓄積されたデータから、以下の分析が可能になる。

### 提案品質分析

| クエリ | 内容 | SQL イメージ |
|--------|------|-------------|
| **ソース別採用率** | どのソースの提案が最も採用されるか | `GROUP BY source → AVG(accepted)` |
| **却下理由分布** | どの理由で却下されることが多いか | `GROUP BY dismissReason → COUNT` |
| **フィールド別採用率** | どのフィールドの提案が採用されやすいか | `GROUP BY fieldKey → AVG(selected)` |
| **緊急度別採用率** | urgent は本当に採用されるか | `GROUP BY urgency → AVG(accepted)` |

### パターン発見

| クエリ | 内容 |
|--------|------|
| **採用→改善追跡** | 採用した提案のあと、モニタリング評価が改善したか |
| **却下→再提案** | 却下された提案が再度類似内容で提案されていないか |
| **ベテラン vs 新人** | 操作者による採用パターンの違い |
| **時間帯パターン** | 特定の時間帯に関する提案の採用率の差 |

### ナレッジベース構築

| クエリ | 内容 |
|--------|------|
| **成功パターン** | 採用後に改善が確認された提案のパターン抽出 |
| **ベストプラクティス** | 採用率 80%+ の提案ルールの特定 |
| **教育材料** | 判断理由が明記された採用/却下事例の抽出 |

---

## 永続化戦略

| エンティティ | 現在 | 将来 |
|-------------|------|------|
| ProposalAdoptionRecord | LocalStorage | Firestore / SharePoint |
| IspDecisionRecord | InMemory / SharePoint | SharePoint |
| ProvenanceEntry | PlanningSheet 内埋込 | 独立コレクション |
| ImportAuditRecord | Zustand Store | Firestore |
| PlanningSheetVersion | LocalStorage | SharePoint |
| EvidenceLink | LocalStorage | Firestore |
| MonitoringMeeting | LocalStorage | Firestore |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-16 | 1.0 | 初版作成 | プロダクトチーム |
