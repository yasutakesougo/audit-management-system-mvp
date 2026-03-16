# Circuit Breaker — Phase 2 設計メモ

Date: 2026-03-16  
Depends on: Phase 1 (Shadow Breaker — HUD 表示のみ) ✅ 完了

---

## 現在地

```text
Phase 1 (完了)
  fetchSpan → HydrationSpan → Breaker evaluator → HUD 表示
  - Shadow mode: 判定のみ、遮断なし
  - evaluator: pure function (23テスト)
  - HUD: SP/Graph の成功率・p95・avg・error・slow・retry・breaker状態
  - OPEN reason: error_rate / consecutive_failures / slow_rate を文字表示
```

---

## Phase 2 ロードマップ

### Step 1: 観察期間（1〜2週間）

#### 収集すべき 4 指標

| # | 指標 | 見るもの | 判断基準 |
|---|------|---------|---------|
| 1 | OPEN 頻度 | 1日に何回 OPEN するか | 5回/日以上 → 閾値緩すぎ |
| 2 | OPEN 理由内訳 | error_rate / consecutive / slow のどれが多いか | 偏り → 閾値個別調整 |
| 3 | OPEN 継続時間 | すぐ HALF_OPEN→CLOSED に戻るか | 長期不安定 → cooldown 調整 |
| 4 | 体感一致度 | HUD OPEN 時に実際に遅延を体感したか | 不一致 → 判定条件見直し |

#### 実装タスク（軽量）

- [ ] Beacon に breaker state 変化をイベントとして送信する
  - `{ event: 'breaker:state_change', layer, from, to, reason, timestamp }`
  - 既存 `sendHydrationSpans` に1行追加するだけ
- [ ] HUD に「最終 OPEN 時刻」と「OPEN→CLOSED 復帰時間」を表示する

---

### Step 2: 閾値チューニング

観察データから調整する候補:

| パラメータ | 現在値 | 調整条件 |
|-----------|--------|---------|
| `windowSize` | 20 | OPEN が頻繁 → 拡大 (30〜50) |
| `errorCountThreshold` | 5 | 誤検知が多い → 引き上げ |
| `consecutiveFailureThreshold` | 3 | SP の burst 429 で誤検知 → 4〜5 |
| `slowThresholdMs` | 2000 | SP の正常遅延が多いなら → 3000 |
| `slowCountThreshold` | 8 | slow_rate OPEN が多すぎなら引き上げ |
| `cooldownMs` | 30000 | OPEN が長すぎるなら → 15000〜20000 |

---

### Step 3: Soft Breaker（Phase 2 のゴール）

#### 概要

```text
OPEN 判定時に「低リスクな処理だけ止める」
  → 手動操作は通す
  → background / auto-refresh / prefetch を止める or 間引く
```

#### 対象と非対象

| 処理 | OPEN 時の動作 | 理由 |
|------|-------------|------|
| **手動 CRUD（保存・削除）** | ✅ 通す | 現場入力を止めると業務が止まる |
| **手動読み込み（画面遷移）** | ✅ 通す | ユーザー操作は尊重 |
| background hydration | ⛔ 停止 | 裏で叩いても復旧しない |
| auto-refresh (polling) | ⛔ 間隔延長 (5x) | 負荷軽減 |
| prefetch | ⛔ 停止 | 投機的リクエストは不要 |
| stale cache 利用 | ✅ 有効化 | OPEN 中は cache fallback を優先 |

#### 実装方針

```typescript
// 利用側のイメージ
import { getBreakerSnapshot } from '@/lib/circuitBreaker/store';

function shouldAutoRefresh(layer: FetchSpanLayer): boolean {
  const snap = getBreakerSnapshot(layer);
  return snap.state === 'CLOSED';
}

function getRefreshInterval(layer: FetchSpanLayer): number {
  const snap = getBreakerSnapshot(layer);
  return snap.state === 'OPEN' ? BASE_INTERVAL * 5 : BASE_INTERVAL;
}
```

#### 禁止事項

> **write 系に breaker を乗せない**

write を止めると、現場で記録が消える可能性がある。
breaker は **read + background** に限定する。
write の障害は retry + エラー通知で対応する。

---

### Step 4: Active Breaker（Phase 3 — 将来）

Phase 2 の Soft Breaker で十分な場合はここに進まない。

#### Active Breaker の導入条件

以下の3条件がすべて揃うまで Active 化しない:

1. Soft Breaker で2〜4週間運用し、誤判定が許容範囲内
2. SP / Graph の不安定パターンが可視化されている
3. OPEN 判定の体感一致度が 80% 以上

#### Active Breaker の仕様

```text
OPEN 時に read 系リクエストを即座にエラーで返す
  → stale cache があれば cache から返す
  → cache がなければ明示的エラー表示
  → HALF_OPEN でプローブリクエストを1本だけ許可
```

---

## 将来の拡張候補（優先度順）

| # | 拡張 | 効果 | 前提 |
|---|------|------|------|
| 1 | `sp:read` / `sp:write` 分離 | write を保護 | Active 化直前 |
| 2 | key別集計 (`/lists/xxx` 等) | リスト障害の切り分け | OPEN 理由の詳細化 |
| 3 | 時間窓の併用 | 古いエラーの自然消滅 | 件数窓の安定確認後 |
| 4 | stale cache 利用回数の計測 | cache 効果の可視化 | Soft Breaker 運用後 |
| 5 | breaker state の Beacon 送信 | 遠隔監視 | 観察期間中 |
| 6 | 「安全モード」UI 表示 | 現場職員への通知 | Active Breaker 前 |

---

## ファイル構成

```
src/lib/circuitBreaker/
  evaluator.ts      ← Phase 1 ✅ pure function
  store.ts          ← Phase 1 ✅ HydrationSpan → BreakerSample
  softBreaker.ts    ← Phase 2 (予定) Soft Breaker の制御 API
  index.ts          ← Phase 2 (予定) re-export

tests/unit/circuitBreaker/
  evaluator.spec.ts ← Phase 1 ✅ 23テスト
  store.spec.ts     ← Phase 2 (予定)
  softBreaker.spec.ts ← Phase 2 (予定)
```

---

## まとめ

Phase 2 の本質は **「判定精度の検証 → 低リスク制御の導入」** です。

```text
Phase 1: 観測する     → fetchSpan + HUD
Phase 1: 診断する     → evaluator + Shadow Breaker ← 今ここ
Phase 2: 軽く制御する → Soft Breaker (background/prefetch 停止)
Phase 3: 本格制御する → Active Breaker (read 遮断 + cache fallback)
```

焦って Phase 3 に行く必要はありません。
Soft Breaker だけで、実運用上の問題はほぼ解決できます。
