# Today Action Engine Telemetry & HUD 実装指示書 (Phase 4)

## 背景と目的
Today Action Engine（Phase 1〜3）により、業務アクションの優先度判定とUIの完全な分離が達成されました。
Phase 4では、この分離されたアーキテクチャの強みを活かし、**「Engineがどのような判断を下したか」を副作用なく観測・可視化**します。

* **Phase 4-A (Telemetry)**: Action Queueの健康状態（ヘルス）を要約して記録する
* **Phase 4-B (HUD)**: 開発・検証時に、現在のメトリクスを即座に確認する

これにより、「特定の優先度が偏っていないか」「キューが爆発していないか」といった運用上の異常をリアルタイムに検知できる「運用OS」への進化を目指します。

---

## 遵守すべき設計の3原則

1. **Engine は純粋関数のまま維持する**
   * `buildTodayActionQueue()` の内部でTelemetryを送信してはいけません。
   * 通信や観測は、必ずフック層 (`useTodayActionQueue`) で行います。
2. **Telemetry は「結果の要約」だけを送る**
   * カードの全文やPayloadを流さず、要素数や状態（P0の数など）の集計値のみを記録します。
3. **HUD は「診断専用（Dev Only）」に徹する**
   * 運用者向けの業務UIには混ぜず、既存の開発用HUD等の隅に独立して配置します。

---

## ステップ別 実装手順（推奨 4 PR構成）

実装は小さく安全に切り出します。以下の順序でPRを作成してください。

### PR 1: Telemetry 型定義と純粋集約関数 (UI非依存)
Engineが出力した `ActionCard[]` を要約するPure Functionを作成します。

**作成ファイル:**
* `src/features/today/telemetry/todayQueueTelemetry.types.ts`
* `src/features/today/telemetry/summarizeTodayQueue.ts`
* `src/features/today/telemetry/summarizeTodayQueue.spec.ts`

**実装仕様:**
```typescript
// todayQueueTelemetry.types.ts
export interface TodayQueueTelemetrySample {
  timestamp: number;
  queueSize: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  overdueCount: number;
  requiresAttentionCount: number;
}

// summarizeTodayQueue.ts
import type { ActionCard } from '../domain/models/queue.types';
import type { TodayQueueTelemetrySample } from './todayQueueTelemetry.types';

export function summarizeTodayQueue(
  items: ActionCard[],
  timestamp: number
): TodayQueueTelemetrySample {
  return {
    timestamp,
    queueSize: items.length,
    p0Count: items.filter((x) => x.priority === 'P0').length,
    p1Count: items.filter((x) => x.priority === 'P1').length,
    p2Count: items.filter((x) => x.priority === 'P2').length,
    p3Count: items.filter((x) => x.priority === 'P3').length,
    overdueCount: items.filter((x) => x.isOverdue).length,
    requiresAttentionCount: items.filter((x) => x.requiresAttention).length,
  };
}
```

---

### PR 2: Telemetry Store の新設
履歴を一定数（直近50件程度）保持するための、軽量なStoreを作成します。

**作成ファイル:**
* `src/features/today/telemetry/todayQueueTelemetryStore.ts`
* (Storeのテスト)

**実装仕様:**
* `samples` 配列の保持（上限を設ける）
* `pushSample(sample)` メソッド
* `clearSamples()` メソッド
* `getLatestSample()` (getter)

---

### PR 3: Hook への Telemetry 接続
Queueが再計算されたタイミングで、Summaryを作成してStoreにPushします。HUDはまだ作りません。

**更新ファイル:**
* `src/features/today/hooks/useTodayActionQueue.ts`

**実装仕様:**
* `useEffect`等を用いて、`actionQueue` の内容が確定したタイミングで1度だけ `summarizeTodayQueue` を実行。
* 結果を `todayQueueTelemetryStore` へ送る。

---

### PR 4: Diagnostics HUD の作成と注入
開発時にAction Queueの健康状態を確認するためのパネルを作成します。

**作成ファイル:**
* `src/features/today/widgets/TodayQueueHudPanel.tsx`

**実装仕様:**
* Storeから `latestSample` を購読し表示する。
* 表示はテキストベースで十分（グラフ化は不要）。
* 異常値のハイライトを入れる：
  * `p0Count > 0` → ⚠️ Warning (Red系)
  * `overdueCount > 0` → ⚠️ Caution (Orange系)
  * `queueSize` が一定以上 → High Load
* 既存の開発用HUD領域や、Devビルド時のみ表示されるエリアにこのコンポーネントを配置する。

---

## やらないこと（非推奨事項）

Phase 4-A/B の完了条件をシャープに保つため、**以下は現時点では実装しません**：
* Payloadなど詳細データの記録（トークン・通信量の無駄）
* Action個別のクリック・開封ログ（別機構で追及すべき）
* 最初からリッチな時系列グラフを描くこと（まずは最新1件の表示で十分）
* 本番データベースへの永続化（まずはクライアント上での観測から始める）

以上の制約を守り、「**Today Action Engine の純粋性は維持したまま、Hook層で出力結果を観測・集約し、HUDにLatest Healthとして表示する**」ことを目指します。
