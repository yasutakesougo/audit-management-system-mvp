# Support Operations OS — Full Architecture

> 福祉DXにおける支援改善循環エンジンの設計と実装
>
> Audit Management System MVP — 2026-03-16

---

## 1. 循環モデル概要

本システムの核心は、**記録が蓄積されるだけでなく、分析・提案・採用・履歴化を経て計画が自律的に改善される循環構造**にある。

```mermaid
graph TB
    subgraph CYCLE["Support Operations OS — Core Loop"]
        direction TB

        OBS["🔭 Observation<br/>観測データ収集"]
        INT["🧠 Interpretation<br/>パターン検出・リスク評価"]
        PRO["💡 Proposal<br/>改善提案生成"]
        PRV["🔍 Preview<br/>差分確認・選択"]
        ADO["✅ Adoption<br/>採用・計画反映"]
        REC["📜 Provenance<br/>採用履歴・出典記録"]
        PLN["📋 Planning<br/>支援計画更新"]
        EXE["⚡ Execution<br/>現場実行"]

        OBS ==>|"raw data"| INT
        INT ==>|"structured insight"| PRO
        PRO ==>|"PlanningProposalBundle"| PRV
        PRV ==>|"selected items"| ADO
        ADO ==>|"ProposalAdoptionRecord"| REC
        REC ==>|"provenance"| PLN
        PLN ==>|"支援手順"| EXE
        EXE ==>|"実行記録"| OBS
    end

    style OBS fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style INT fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    style PRO fill:#fff8e1,stroke:#f57f17,color:#e65100
    style PRV fill:#fce4ec,stroke:#c62828,color:#b71c1c
    style ADO fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style REC fill:#fff3e0,stroke:#e65100,color:#bf360c
    style PLN fill:#e0f7fa,stroke:#00695c,color:#004d40
    style EXE fill:#f1f8e9,stroke:#558b2f,color:#33691e
```

---

## 2. 提案統合パイプライン（Proposal Integration Layer）

3つの独立した分析パイプラインが、共通の統一レイヤーに合流する。

```mermaid
graph LR
    subgraph SOURCES["Observation Sources"]
        H["📝 申し送り<br/>Handoff"]
        A["🔬 ABC記録<br/>Behavioral Observation"]
        M["📊 モニタリング<br/>Progress Review"]
    end

    subgraph ANALYSIS["Analysis Engines (Pure Functions)"]
        R["computeRiskScores<br/>→ buildReviewRecommendations<br/>→ buildReviewProposal"]
        C["compareAbcPatternPeriods<br/>→ SceneChangeAlert"]
        E["evaluateGoalProgress<br/>→ buildRevisionDraft"]
    end

    subgraph ADAPT["Adapter Layer"]
        AR["adaptReviewProposal()"]
        AC["adaptAbcComparison()"]
        AM["adaptRevisionDraft()"]
    end

    subgraph UNIFIED["Unified Proposal Pipeline"]
        B["PlanningProposalBundle[]"]
        P["buildProposalPreview()"]
        D["ProposalApplyDialog"]
        AD["buildAdoptionRecords()"]
    end

    H --> R
    A --> C
    M --> E

    R --> AR
    C --> AC
    E --> AM

    AR --> B
    AC --> B
    AM --> B

    B --> P
    P --> D
    D --> AD

    style SOURCES fill:#e3f2fd,stroke:#1565c0
    style ANALYSIS fill:#f3e5f5,stroke:#7b1fa2
    style ADAPT fill:#fff8e1,stroke:#f57f17
    style UNIFIED fill:#e8f5e9,stroke:#2e7d32
```

---

## 3. 6層モデルと実装の対応

```mermaid
graph TB
    subgraph L1["第1層: 観測 (Observation)"]
        L1a["申し送り<br/><i>features/handoff/</i>"]
        L1b["ABC記録<br/><i>domain/abc/</i>"]
        L1c["特性アンケート<br/><i>features/assessment/</i>"]
        L1d["日中活動<br/><i>features/daily/</i>"]
    end

    subgraph L2["第2層: 解釈 (Interpretation)"]
        L2a["キーワード抽出<br/>傾向分析<br/>リスク評価"]
        L2b["パターン検出<br/>場面変化<br/>強度分析"]
        L2c["Bridge変換<br/>AI言語化"]
    end

    subgraph L3["第3層: 根拠 (Evidence)"]
        L3a["Evidence Link"]
        L3b["Provenance"]
        L3c["Reverse Trace"]
    end

    subgraph L4["第4層: 計画 (Planning)"]
        L4a["支援計画シート<br/>10セクション PBS準拠"]
        L4b["ISP"]
        L4c["支援手順"]
    end

    subgraph L5["第5層: 実行 (Execution)"]
        L5a["Today画面"]
        L5b["日中記録"]
        L5c["申し送りTL"]
    end

    subgraph L6["第6層: 検証 (Verification)"]
        L6a["ダッシュボード"]
        L6b["モニタリング"]
        L6c["PDCA"]
    end

    subgraph PIL["提案統合層 (Proposal Integration)"]
        PIL1["PlanningProposalBundle"]
        PIL2["ProposalApplyDialog"]
        PIL3["ProposalAdoptionRecord"]
    end

    L1 ==> L2
    L2 ==> L3
    L3 ==> L4
    L4 ==> L5
    L5 ==>|"実行記録→観測"| L1
    L5 ==> L6

    L2 -.->|"#986"| PIL
    L1 -.->|"#987"| PIL
    L6 -.->|"#988"| PIL
    PIL ==>|"採用→計画更新"| L4

    style L1 fill:#e3f2fd,stroke:#1565c0
    style L2 fill:#f3e5f5,stroke:#7b1fa2
    style L3 fill:#fff3e0,stroke:#e65100
    style L4 fill:#e8f5e9,stroke:#2e7d32
    style L5 fill:#fce4ec,stroke:#c62828
    style L6 fill:#f1f8e9,stroke:#558b2f
    style PIL fill:#fff8e1,stroke:#f57f17
```

---

## 4. 提案フィールドフローマップ

各提案パイプラインが支援計画シートのどのセクションに作用するかを示す。

```mermaid
graph LR
    subgraph INPUT["提案ソース"]
        S986["#986<br/>申し送り"]
        S987["#987<br/>ABC"]
        S988["#988<br/>モニタリング"]
    end

    subgraph SECTIONS["支援計画シート"]
        S2["§2 対象行動"]
        S3["§3 氷山分析"]
        S5["§5 予防的支援"]
        S7["§7 問題行動時"]
        S8["§8 危機対応"]
        S9["§9 モニタリング"]
    end

    S986 -->|"targetBehavior<br/>behaviorFrequency"| S2
    S986 -->|"triggers<br/>environmentFactors"| S3
    S986 -->|"environmentalAdjustment<br/>preSupport"| S5
    S986 -->|"initialResponse"| S7
    S986 -->|"emergencyResponse"| S8
    S986 -->|"evaluationIndicator"| S9

    S987 -->|"環境調整<br/>事前支援"| S5
    S987 -->|"危機対応"| S8
    S987 -->|"成功事例"| S9

    S988 -->|"困難場面"| S2
    S988 -->|"新規トリガー"| S3
    S988 -->|"支援方法<br/>環境調整"| S5
    S988 -->|"医療連携"| S8
    S988 -->|"指標見直し"| S9

    style INPUT fill:#f3e5f5,stroke:#7b1fa2
    style SECTIONS fill:#e8f5e9,stroke:#2e7d32
```

---

## 5. データフロー — 1回の循環

```mermaid
sequenceDiagram
    participant Staff as 支援職員
    participant Obs as 観測層
    participant Eng as 分析エンジン
    participant Adp as Adapter
    participant Prv as Preview
    participant Plan as 支援計画

    Staff->>Obs: 申し送り / ABC / モニタリング 記録
    Obs->>Eng: raw data
    Eng->>Eng: pure function 実行
    Note over Eng: reviewRecommendation<br/>compareAbcPatternPeriods<br/>evaluateGoalProgress
    Eng->>Adp: 個別出力型
    Adp->>Adp: PlanningProposalBundle に正規化
    Adp->>Prv: ProposalPreviewResult
    Prv->>Staff: ProposalApplyDialog 表示
    Staff->>Prv: 提案を選択・採用
    Prv->>Plan: 選択項目を計画に反映
    Prv->>Prv: ProposalAdoptionRecord 保存
    Plan->>Staff: 更新された支援手順で実行
    Staff->>Obs: 実行結果を記録（次の循環）
```

---

## 6. テスト構成

```mermaid
pie title テスト分布 (200 tests in analysis/)
    "Phase 1 キーワード・傾向" : 65
    "Phase 2 アラート・パターン" : 54
    "Phase 3 AI Service" : 14
    "#986 見直し提案" : 31
    "#987 ABC変化検出" : 15
    "#988 モニタリング" : 19
    "統一提案バンドル" : 16
```

---

## 7. 設計原則

| 原則 | 説明 | 実装例 |
|---|---|---|
| **Pure Function First** | 分析ロジックはUI・DB依存ゼロ | `compareAbcPatternPeriods()` |
| **Adapter Isolation** | 型変換は adapter 層に集約 | `adaptRevisionDraft()` |
| **Provenance Mandatory** | 全採用に出典・理由・日時を記録 | `ProposalAdoptionRecord` |
| **Evidence Link** | 計画の各要素に観測データへの参照 | `EvidenceLink` |
| **Bridge Pattern** | 外部データ→計画への安全な橋渡し | `tokuseiToPlanningBridge()` |
| **Progressive Disclosure** | 差分プレビュー→確認→採用の段階 | `ProposalApplyDialog` |

---

## 8. 従来型との比較

| 観点 | 従来の福祉システム | Support Operations OS |
|---|---|---|
| 記録 | 保存して終わり | 循環の起点 |
| 分析 | 別システム or 手動 | システム内で構造化 |
| 計画更新 | コピー＆ペースト | 提案→差分確認→反映 |
| 出典追跡 | なし | Evidence Link + Provenance |
| 改善サイクル | 会議で口頭共有 | データ駆動の PDCA |
| 提案 | なし | 3系統の自動提案 |
| 採用履歴 | なし | ProposalAdoptionRecord |
| 監査 | 紙ベース | 構造化された変更履歴 |

---

## 9. 今後の発展方向

```mermaid
graph TB
    subgraph CURRENT["実装済み (PR #989)"]
        C1["3系統の分析エンジン"]
        C2["提案統合レイヤー"]
        C3["統一反映UI"]
        C4["Provenance 記録"]
    end

    subgraph NEXT["次フェーズ"]
        N1["Proposal Analytics<br/>採用率・却下分析"]
        N2["Proposal Safety<br/>競合検知・誤適用防止"]
        N3["Proposal Timeline<br/>計画変更の可視化"]
    end

    subgraph FUTURE["将来構想"]
        F1["AI再学習<br/>採用パターンから品質改善"]
        F2["Multi-Facility<br/>施設間ベンチマーク"]
        F3["Research Export<br/>論文・研究データ出力"]
    end

    CURRENT --> NEXT
    NEXT --> FUTURE

    style CURRENT fill:#e8f5e9,stroke:#2e7d32
    style NEXT fill:#fff8e1,stroke:#f57f17
    style FUTURE fill:#f3e5f5,stroke:#7b1fa2
```

---

## 10. 論文化のための位置づけ

### タイトル案

> **Support Operations OS: 観測駆動型支援改善循環エンジンの設計と実装**
> — 強度行動障害支援における Evidence-Based Plan Revision の自動化 —

### Abstract 構造

1. **背景**: 福祉現場の支援計画は観測データと断絶しがち
2. **課題**: 記録→分析→計画更新の循環が自動化されていない
3. **提案**: 3系統の分析エンジン + 統一提案レイヤー + Provenance
4. **実装**: Pure function first / Adapter pattern / Progressive disclosure
5. **評価**: 81テストによる検証、200+テストの分析基盤
6. **貢献**: 福祉DXにおける循環型支援改善モデルの提示

### キーワード

`Support Operations OS` / `Evidence-Based Practice` / `Proposal Integration` / `Provenance` / `PBS (Positive Behavior Support)` / `Welfare DX` / `循環型支援改善`
