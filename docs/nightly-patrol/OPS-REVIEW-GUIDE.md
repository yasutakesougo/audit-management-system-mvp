# Transport Concurrency: Daily Review Guide (Ops Manager)

Phase 3-A の観測期間（1週間）において、毎朝の Nightly Patrol レポートから確認すべき 6 つの重要指標と判断基準を定義します。

## 1. 重要 6 指標 (Key Metrics)

| 指標 | 確認のポイント | 正常の目安 (仮説) |
| :--- | :--- | :--- |
| **totalConflicts** | 1日の総競合件数 | 5件未満 |
| **p90 (Vehicle)** | 9割の車両が収まっている競合数 | 2件以下 |
| **max (Vehicle)** | 最も競合した車両の件数 | 4件以下 |
| **上位車両 (Top Vehicles)** | どの車両に集中しているか | 毎回同じ車両なら要注意 |
| **上位時間帯 (Top Hours)** | どの時間に集中しているか | 送迎開始・終了前後に集中 |
| **recoveryRate** | 競合後の保存成功率 | 90% 以上 (低い場合はインフラ疑い) |

## 2. 差分観測：昨日との関係性を見る (Temporal Comparison)

単日の数値だけでなく、「昨日より良いか、悪いか」の変化に注目します。

*   **p90 の変化**:
    *   上昇している → 全体的な入力密度の高まり、またはシステム遅延の予兆。
    *   安定している → 運用ルールが浸透している「通常の状態」。
*   **車両 (Vehicle) の重複**:
    *   別の車両に変わった → 構造的なボトルネック。
    *   同じ車両で継続している → 運用上の再発、または特定の担当者間の連携不全。
*   **max の意味**:
    *   新しい車両で max が跳ねた → 単発のイレギュラー事故。
    *   p90 と共に max も高い → サイト全体のキャパシティ・オーバー。

## 3. 判定レベルと対応方針

*   **🟢 正常 (p90 ≤ 2 かつ total < 5)**
    *   特になし。日常的な混雑の範囲内です。
*   **🟡 監視 (p90 > 2 または total ≥ 5)**
    *   車両ホットスポットを確認し、特定の担当者間に作業が集中していないか把握します。
*   **🔴 要介入 (max ≥ 5 または recoveryRate < 90%)**
    *   **ヒアリング**: 該当車両の担当者に、保存時の挙動（フリーズや長時間待機）を確認。
    *   **運用調整**: 入力タイミングの分散、またはダブルチェックフローの再考を検討。

## 3. 観測期間のルール

1.  **閾値の固定**: 観測期間中は `nightly-classify.mjs` の Severity 判定ロジックを極力変更しない。
2.  **実データの蓄積**: 特異日（極端に競合が多い日）があれば、その日のイベント（欠勤による急な配車変更など）をメモしておく。
3.  **1週間後の再調整**: 蓄積された p50/p90 の分布に基づき、判定閾値を「現場の黄金律」にアップデートする。

## 4. データ構造 (JSON Schema Quasi-SSOT)
`classification-*.json` 内の以下の構造を、UI および Decision Engine の準 SSOT とします。

```json
"concurrency": {
  "totalConflicts": number,
  "vehicleHistogram": { [vehicleName: string]: number },
  "hourBandHistogram": { [timeBand: string]: number },
  "recoveryRate": number,
  "stats": {
    "p50": number,
    "p90": number,
    "max": number
  }
}
```
