# /today ページ 最終アーキテクチャ

> **最終更新**: 2026-03-11  
> **ステータス**: 実装済み・本番運用中

## 設計原則

`/today` は **行動ダッシュボード** である。情報ダッシュボードではない。

| 原則 | 説明 |
|------|------|
| **Single Action Focus** | 画面上のCTAは常に `NextActionCard` に集約する |
| **Execution Layer** | 集約・分析ロジックを持たない。`useTodaySummary` facade 経由でデータを受け取る |
| **Visual Hierarchy** | 意思決定 → 状況理解 → 詳細 の順で視線を誘導する |
| **Calm Status** | 進捗表示は informational に留め、urgency を過度に煽らない |

## レイヤ構造

```mermaid
graph TB
    subgraph "行動レイヤ【PRIMARY】"
        NAC["NextActionCard<br/>━━━━━━━━━━━━━━<br/>SceneGuidance CTA<br/>ScheduleContext<br/>EmptyState + Utility CTA"]
    end

    subgraph "状態レイヤ【SECONDARY】"
        PSB["ProgressStatusBar<br/>━━━━━━━━━━━━━━<br/>進捗バー（色3段階）<br/>未記録 / 出欠 / 申し送りチップ<br/>※ CTA なし"]
        ATT["AttendanceSummaryCard<br/>━━━━━━━━━━━━━━<br/>出欠サマリ"]
    end

    subgraph "詳細レイヤ【TERTIARY】"
        BRF["BriefingActionList<br/>対応が必要な申し送り"]
        SVC["TodayServiceStructureCard<br/>業務体制"]
        USR["UserCompactList<br/>利用者記録"]
        TRA["TransportStatusCard<br/>送迎状況"]
    end

    NAC --> PSB
    PSB --> ATT
    ATT --> BRF
    BRF --> SVC
    SVC --> USR
    USR --> TRA

    style NAC fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px,color:#1b5e20
    style PSB fill:#f3f3f3,stroke:#9e9e9e,stroke-width:1px,color:#424242
    style ATT fill:#f3f3f3,stroke:#9e9e9e,stroke-width:1px,color:#424242
    style BRF fill:#fafafa,stroke:#bdbdbd,stroke-width:1px,color:#616161
    style SVC fill:#fafafa,stroke:#bdbdbd,stroke-width:1px,color:#616161
    style USR fill:#fafafa,stroke:#bdbdbd,stroke-width:1px,color:#616161
    style TRA fill:#fafafa,stroke:#bdbdbd,stroke-width:1px,color:#616161
```

## データフロー

```mermaid
graph LR
    subgraph "Data Sources"
        SP["SharePoint<br/>ScheduleRepository"]
        FS["Firestore<br/>DailyRecords"]
    end

    subgraph "Domain Layer"
        UTS["useTodaySummary<br/>━━━━━━━━━━━<br/>Facade Hook"]
        USL["useTodayScheduleLanes<br/>━━━━━━━━━━━<br/>Real-time Lanes"]
    end

    subgraph "Derived Hooks"
        UNA["useNextAction<br/>━━━━━━━━━━━<br/>Time-based<br/>Next Action"]
        USNA["useSceneNextAction<br/>━━━━━━━━━━━<br/>Scene-based<br/>Next Action"]
    end

    subgraph "Execution Layer"
        TOP["TodayOpsPage<br/>━━━━━━━━━━━<br/>Props Assembly<br/>Navigation Handlers"]
    end

    subgraph "View Layer"
        TBL["TodayBentoLayout<br/>━━━━━━━━━━━<br/>Grid Orchestration"]
    end

    SP --> USL
    FS --> UTS
    USL --> UNA
    UTS --> USNA
    UNA --> TOP
    USNA --> TOP
    UTS --> TOP
    TOP --> TBL

    style TOP fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style TBL fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style UTS fill:#fff3e0,stroke:#e65100,stroke-width:1px
    style USL fill:#fff3e0,stroke:#e65100,stroke-width:1px
```

## NextActionCard 行動判定フロー

```mermaid
flowchart TD
    START["画面表示"] --> CHECK_SCENE{"SceneGuidance<br/>あり？"}

    CHECK_SCENE -->|Yes| SCENE_PRI{"P1 安全？"}
    SCENE_PRI -->|Yes| SHOW_P1["🔴 安全系CTA<br/>（最優先表示）"]
    SCENE_PRI -->|No| CHECK_P2{"P2 申し送り？"}
    CHECK_P2 -->|Yes| SHOW_P2["🟡 申し送り確認CTA"]
    CHECK_P2 -->|No| CHECK_P3{"P3 記録？"}
    CHECK_P3 -->|Yes| SHOW_P3["🟢 記録CTA"]
    CHECK_P3 -->|No| CHECK_SCHED

    CHECK_SCENE -->|No| CHECK_SCHED{"Schedule<br/>NextAction あり？"}
    CHECK_SCHED -->|Yes| SHOW_SCHED["📅 スケジュールCTA<br/>+ 時間・担当表示"]
    CHECK_SCHED -->|No| SHOW_EMPTY["空状態"]

    SHOW_EMPTY --> EMPTY_PRIMARY["「スケジュールを見る」<br/>primary outlined"]
    SHOW_EMPTY --> EMPTY_UTIL["「その他の記録へ」<br/>secondary text"]

    style SHOW_P1 fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style SHOW_P2 fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    style SHOW_P3 fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style SHOW_SCHED fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style SHOW_EMPTY fill:#f5f5f5,stroke:#9e9e9e,stroke-width:1px
```

## ProgressStatusBar 色設計

```
完了率    色        意味
━━━━━━━━━━━━━━━━━━━━━━━━━━
≥ 70%    success   順調（緑系）
≥ 30%    info      対応中（青系）
< 30%    warning   対応が必要（黄系）
```

> **設計意図**: 朝一は完了率 0% が正常。`warning` が出すぎないよう閾値を 30% に設定。

## Bento Grid レイアウト

### Desktop (md: 4-column)

```
┌──────────────────────────────────────┐
│  NextActionCard (4col, accent)       │  ← ROW 0: PRIMARY
├──────────────────┬───────────────────┤
│  Progress (3col)  │ Attendance (1col) │  ← ROW 1: STATUS
├──────────────────┴───────────────────┤
│  Briefing (4col, subtle)             │  ← ROW 2
├──────────────────────────────────────┤
│  ServiceStructure (4col)             │  ← ROW 3
├──────────────────────────────────────┤
│  Users (4col)                        │  ← ROW 4
├──────────────────────────────────────┤
│  Transport (4col)                    │  ← ROW 5
└──────────────────────────────────────┘
```

### Mobile (xs: 1-column)

```
NextActionCard
ProgressStatusBar
AttendanceSummaryCard
BriefingActionList
ServiceStructure
UserCompactList
TransportStatusCard
```

## コンポーネント責務マトリクス

| コンポーネント | CTA | 色制御 | データ集約 | 行動起点 |
|---------------|-----|--------|-----------|---------|
| **NextActionCard** | ✅ Primary | accent | ❌ 受領のみ | ✅ |
| **ProgressStatusBar** | ❌ なし | neutral | ❌ 受領のみ | ❌ |
| **AttendanceSummaryCard** | chip link | neutral | ❌ 受領のみ | ❌ |
| **BriefingActionList** | item link | neutral | ❌ 受領のみ | ❌ |

## 関連ADR

- [ADR-002: Today Execution Layer Guardrails](../adr/ADR-002-today-execution-layer-guardrails.md)
- [Hero-NextAction Responsibility Design](./hero-nextaction-responsibility.md)

## 変更履歴

| 日付 | 変更 |
|------|------|
| 2026-03-11 | Hero 廃止 → ProgressStatusBar 導入、CTA 一元化、色設計正常化 |
