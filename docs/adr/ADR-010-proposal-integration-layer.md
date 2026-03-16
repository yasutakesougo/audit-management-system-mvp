# ADR-010: 提案統合レイヤー（Proposal Integration Layer）

> **Status**: Accepted
> **Date**: 2026-03-16
> **PR**: #989
> **Issues**: #986, #987, #988

---

## コンテキスト

支援計画シートの改善提案が3つの独立したパイプラインで生成されるようになった。

| # | ソース | 生成器 | 出力型 |
|---|---|---|---|
| #986 | 申し送り分析 | `buildReviewProposal()` | `ReviewProposal` |
| #987 | ABC記録分析 | `compareAbcPatternPeriods()` | `AbcPatternComparison` |
| #988 | モニタリング | `buildRevisionDraft()` | `RevisionDraft` |

課題:

1. 提案の型が3種類あり、UIが個別対応になる
2. 差分確認の体験がソースごとに異なる
3. 「なぜこの内容になったか」の追跡が統一されていない
4. 新しいソースを追加するたびに個別UIが必要

## 決定

**共通提案型 `PlanningProposalBundle` + アダプターパターン** を採用する。

### アーキテクチャ

```
個別パイプライン（pure function）
  │
  ├─ reviewRecommendation.ts  → ReviewProposal
  ├─ compareAbcPatternPeriods.ts → AbcPatternComparison
  └─ evaluateGoalProgress.ts  → RevisionDraft
        │
        ↓  adapter（型変換のみ）
        │
  PlanningProposalBundle[]
        │
        ↓  buildProposalPreview()
        │
  ProposalPreviewResult
        │
        ↓  ProposalApplyDialog（UI）
        │
  選択された ProposalPreviewItem[]
        │
        ↓  buildAdoptionRecords()
        │
  ProposalAdoptionRecord[]（provenance）
```

### 原則

1. **個別ロジックは変更しない** — アダプターで変換するだけ
2. **Pure function first** — UI依存なし、テスト可能
3. **keep はデフォルト非選択** — 変更が必要な項目だけ初期選択
4. **provenance 必須** — 全採用に理由・ソース・日時を記録

## 共通型の定義

```typescript
type ProposalSource = 'handoff' | 'abc' | 'monitoring';

interface PlanningFieldProposal {
  fieldKey: string;
  sectionKey: string;
  action: 'add' | 'append' | 'replace' | 'keep';
  label: string;
  currentValue?: string;
  proposedValue: string;
  reason: string;
}

interface PlanningProposalBundle {
  source: ProposalSource;
  sourceLabel: string;
  userCode: string;
  urgency?: 'urgent' | 'recommended' | 'suggested';
  summary: string;
  fieldProposals: PlanningFieldProposal[];
  provenance: {
    sourceType: ProposalSource;
    sourceIds: string[];
    generatedAt: string;
  };
}
```

## 利点

- **統一体験**: 3系統の提案を同じUIで確認・採用
- **拡張容易**: 新ソース追加 = adapter 1本
- **監査対応**: 全採用に provenance が残る
- **テスト可能**: 全レイヤーが pure function

## トレードオフ

- アダプター層が1段増える（複雑性 vs 統一性）
- 個別UIの柔軟性が若干低下（統一性を優先）
- `ProposalAdoptionRecord` の永続化はまだ未実装

## 今後の拡張

| 方向 | 内容 |
|---|---|
| 新ソース | ヒヤリハット / 会議記録 → adapter 追加のみ |
| 競合検知 | base revision vs current revision 比較 |
| 採用分析 | source別・rule別の採用率可視化 |
| AI再学習 | 採用/却下パターンから提案品質を改善 |

## 実装ファイル

| ファイル | 行 | テスト |
|---|---|---|
| `proposalBundle.ts` | 373 | 16 |
| `ProposalApplyDialog.tsx` | 210 | — |
| `reviewRecommendation.ts` | 284 | 16 |
| `buildReviewProposal.ts` | 195 | 15 |
| `ReviewRecommendationBanner.tsx` | 175 | — |
| `ReviewProposalCard.tsx` | 215 | — |
| `compareAbcPatternPeriods.ts` | 300 | 15 |
| `SceneChangeAlertCard.tsx` | 180 | — |
| `evaluateGoalProgress.ts` | 355 | 19 |
| **合計** | **~3,900** | **81** |
