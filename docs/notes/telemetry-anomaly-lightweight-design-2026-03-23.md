# Telemetry 異常検知 軽量設計メモ（2026-03-23）

- Status: Fixed (火曜末設計メモ)
- Scope: #1088 phase2 / phase3 の薄い実装ガイド
- Goal: 低ノイズで再現性のある異常検知を先に入れ、PR-3 / PR-4 のスコープ膨張を防ぐ

## 1. イベント契約

異常は「UIで表示するシグナル」として統一する。通知連携はしない。

```ts
type TelemetryAnomalySignal = {
  id: 'today-zero-events' | 'today-drop-vs-last7d' | `missing-event:${string}`;
  level: 'warning' | 'info';
  title: string;
  detail: string;
  order: 1 | 2 | 3;
  observedDate: string; // local day key (YYYY-MM-DD)
  stats: {
    todayCount: number;
    last7dAvg: number;
    referenceWindowDays: 7;
  };
};
```

契約ルール:
- `id` は安定キー。UI test と将来の追跡で利用。
- 同時表示は最大 3 件（ゼロ件 / 急減 / 消失）。
- 表示順は `order` 固定（1→2→3）。

## 2. 閾値（初期固定値）

- `today-zero-events`:
  - 条件: `todayCount === 0`
  - level: `warning`
- `today-drop-vs-last7d`:
  - 条件: `last7dAvg > 0 && todayCount < last7dAvg * 0.5`
  - level: `info`
- `missing-event:*`:
  - 条件: 「8〜30日前に出現」かつ「直近7日で0件」
  - level: `warning`

運用ルール:
- 閾値は今回ハードコード（設定UIは作らない）。
- ノイズ防止のため、missing-event は最大 1 件（最も件数差が大きいもの）まで表示。

## 3. フォールバック

- データ0件:
  - クラッシュしない。
  - 異常セクションは非表示（`today-zero-events` のみ表示可）。
- 分母0 (`last7dAvg === 0`):
  - 急減判定をスキップ。
- 欠損データ:
  - `todayCount=0` と `missing` を混同しない。
  - 欠損時は detail に「データ不足」の文言を出し、warning を増やさない。
- タイムゾーン:
  - 日付キーは local day key で統一し、日跨ぎ誤判定を防ぐ。

## 4. DoD

- Hook 層で異常シグナルを導出できる（pure で判定可能）。
- UI で `warning/info` の2段表示ができる。
- 0件・分母0・複数条件の順序がテストで固定されている。
- 全正常時は Alert セクション非表示。
- typecheck / lint / required test green。
- 既存の CI / Nightly / act warning 0 件運用を壊さない。

## 5. 今回はやらないこと

- 閾値設定 UI（運用実績が溜まるまで不要）。
- Slack / Email 通知連携。
- 日次推移グラフの新規実装。
- Telemetry 永続化スキーマ拡張。
- 複数画面に跨る大規模 UI リファクタ。

## 6. PR 境界（今週運用）

- PR-3 (水): anomaly UI の最小導入
  - hook の導出値 + Alert セクション追加
  - route/表示契約テストを追加
- PR-4 (木): alert tuning の最小導入
  - 閾値微調整と文言改善
  - ノイズ抑止の上限調整

このメモの目的は「実装量を増やすこと」ではなく「薄いPRで安全に流し切る境界固定」。
