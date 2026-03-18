# Today Action Queue Engine Architecture

福祉OSにおける「Today（本日業務の実行レイヤー）」の中核となる、Action Queue Engineのアーキテクチャ図です。
この設計の最大の特徴は、一般的な「UI側でソートや重要度判定を行う」アプローチを捨て、**「Domain Engineで完全な順序と状態を決定し、UI側は描画と橋渡しに徹する（アンプとして機能する）」**小さなOS設計となっている点です。

## Architecture Diagram

```mermaid
graph TD
    %% Styling
    classDef domain fill:#f9f0ff,stroke:#d0b3e6,stroke-width:2px;
    classDef hook fill:#e6f3ff,stroke:#99c2ff,stroke-width:2px;
    classDef page fill:#fff0eb,stroke:#ffb399,stroke-width:2px;
    classDef widget fill:#f0f9f0,stroke:#99e699,stroke-width:2px;
    classDef env fill:#f0f0f0,stroke:#cccccc,stroke-width:2px;
    
    %% Inputs
    subgraph DataSources [1. Data Sources]
        DB_Schedule[Schedules]
        DB_Handoff[Handoff / Logs]
        DB_Vital[Vital Alerts]
        DB_Incident[Incidents]
    end

    %% Domain Engine (Functional Pipeline)
    subgraph DomainEngine [2. Domain Engine (Pure Functional Pipeline)]
        direction TB
        Raw[Raw Action Sources]
        Score[Priority Scoring]
        Urgency[Urgency Calculator]
        Overdue[Overdue Evaluator]
        Sort[Queue Sorter]
        Map[ActionCard Mapper]
        
        Raw --> Score --> Urgency --> Overdue --> Sort --> Map
    end
    class DomainEngine domain

    %% App Layer (Hook)
    subgraph AppLayer [3. Application Layer (Hooks)]
        Hook[useTodayActionQueue\n- Fetches data & invokes Engine -]
    end
    class AppLayer hook

    %% Execution Layer (Page)
    subgraph ExecutionLayer [4. Execution Layer (Page)]
        Page[TodayOpsPage\n- Orchestrator -]
        Bridge[ActionType Bridge\n- Interprets intent -]
        
        Page --> Bridge
    end
    class ExecutionLayer page

    %% Presentation Layer (Widget)
    subgraph PresentationLayer [5. Presentation Layer (UI Component)]
        Widget[ActionQueueTimelineWidget\n- Amplifier -]
        Cards[ActionCard Components\n- Strict visual contract -]
        
        Widget --> Cards
    end
    class PresentationLayer widget

    %% Environment Operations
    subgraph Environment [6. Target Environment]
        ExecDrawer[QuickRecord Drawer]
        ExecNav[React Router \n(Navigation)]
        ExecAck[Acknowledge API \n(No-op / Logging)]
    end
    class Environment env

    %% Data Flow
    DataSources -.-> AppLayer
    AppLayer -->|1. Feed Raw Data| DomainEngine
    DomainEngine -->|2. IActionCard[] \nStrictly Ordered| AppLayer
    
    AppLayer -->|3. Pass Queue| Page
    Page -->|4. Pass Queue & Handlers| Widget
    
    Cards -->|5. onClick| Bridge
    Bridge -->|Action: OPEN_DRAWER| ExecDrawer
    Bridge -->|Action: NAVIGATE| ExecNav
    Bridge -->|Action: ACKNOWLEDGE| ExecAck

```

## Key Characteristics

1. **Domain Engine (Decision Authority)**: 
   Engineが「優先度（Priority）」「緊急度（Urgency）」「期限切れ（Overdue）」「順序（Sort）」のすべての決定権を持ちます。施設ごとのルール変更やアルゴリズムの調整はすべてこの層に閉じます。
2. **ActionType Bridge (Structural Contract)**:
   UIコンポーネントは具体的な業務ロジックを知りません。持っている情報は `OPEN_DRAWER`, `NAVIGATE`, `ACKNOWLEDGE` などの抽象化された `actionType` のみであり、Pageがそれを解釈してOS（ブラウザやルーター）の実際の挙動へ橋渡しします。
3. **UI as an Amplifier (描画と橋渡し)**:
   Widgetやカードは「受け取った配列を勝手に並び替えない」「重要フラグがあれば強調表示するだけ」という『アンプ（増幅器）』として振る舞います。これにより、Engineの進化によってUIが壊れることを防ぎます。

## Telemetry Flow (Phase 4)

Today Action Engine は単なる判断エンジンにとどまらず、**観測可能な運用OSコンポーネント**として機能します。
意思決定系（Engine）と観測系（Telemetry）が交差せず並走するアーキテクチャを採用しています。

```text
useTodayActionQueue
  builds queue (Pure Engine)
  → summarizes latest queue (summarizeTodayQueue)
  → pushes sample into ring buffer (diagnostic store)
  → HydrationHud reads latest sample via TodayQueueHudPanel
```

### Telemetry Design Guidelines

1. **HUD Display Conditions**
   - HUD (Today Queue Telemetry) は、開発時または Diagnostics が有効（`isHudExplicitlyEnabled` 等）な環境でのみ表示される dev-only パネルです。
   - Production の user-facing UI には情報が漏れないように分離されています。
2. **Duplicate Push Guard (署名仕様)**
   - Telemetry 更新のスパムを防ぐため、`id / priority / isOverdue` を連結したシグネチャを使用しています。
   - 文言の変化やペイロードの差分では送信せず、「キューの並び順」と「重要な状態変化（優先度、期限切れ）」があった時のみ差異として監視バッファに送られます。
3. **Thin Presentation Layer**
   - `TodayQueueHudPanel` は store の latest sample を読むだけで、UI側での再集計は一切行いません（極薄プレゼンテーション層）。

## Next Steps

* **Phase 4-C**: Priority Rule Table (ハードコードされている優先順位を外部ルールテーブル化。施設差分や運用差分に強くする)
* **Ops Dashboard Integration**: 取れた Telemetry を HUD だけでなく、将来的に本番運用のダッシュボード側に渡し、業務分析OSへの入力源とする
