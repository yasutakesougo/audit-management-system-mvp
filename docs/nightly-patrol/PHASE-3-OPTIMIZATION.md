# Phase 3: Transport Concurrency Optimization Strategy

## 1. 目的
Phase 2 において「検知・集計・判断・現場フィードバック」の閉ループ（Closed Loop）が成立した。
Phase 3 では、このループの精度を高め、ノイズを減らしつつ重大な予兆を確実に捉えるための**運用最適化（Optimization）**を実施する。
「壊れないシステム」から「現場の負荷を最小化し、賢く振る舞うシステム」への昇格を目指す。

## 2. 観測対象 (Primary Metrics)
以下の5つの指標を優先的に観測し、しきい値設計の根拠とする。

1.  **Total Concurrency Count**: システム全体の競合発生総数。
2.  **Vehicle Histogram**: 車両ごとの競合分布。特定車両への偏りを検知。
3.  **Hour-Band Histogram**: 時間帯（30分単位）ごとの競合分布。ラッシュアワーの特定。
4.  **Refetch Recovery Rate**: 競合検知後、再取得によって正常に保存が完了した割合。
5.  **Recurrence Rate**: 昨日問題だった車両が、今日も引き続きホットスポットとなっている割合。

## 3. 統計指標 (Statistical Indicators)
平均値ではなく、パーセンタイルを用いることで「通常の混雑」と「異常事態」を分離する。

*   **p50 (Median)**: 通常の運用強度。
*   **p90**: 混雑日・高負荷状態の閾値。
*   **Max**: 異常事態、または特定の運用不全（ダブルブッキング等）の予兆。
*   **7-Day Rolling Baseline**: 過去7日間の移動平均を基準とし、突発的なスパイクを判定。

## 4. 判定ルール（仮説）
初期段階では以下の暫定値を用い、実データに基づき 1 週間ごとに見直す。

| レベル | 判定基準（案） | 運用アクション |
| :--- | :--- | :--- |
| **Pass** | `total < p50` | 正常稼働。特になし。 |
| **Watch** | `total > p50` または `Hotspot出現` | 傾向監視。HealthPage に緩やかな警告。 |
| **Action Required** | `total > p90` または `Recurrence発生` | 運用介入。Ops Manager によるヒアリング実施。 |
| **Emergency** | `total > max` または `RecoveryRate低下` | システム不全の疑い。Index Advisor 連携。 |

## 5. UI 反映・フィードバック・チャネル
指標をスコープ別に再解釈して提示する。

*   **Health Dashboard**: 全体トレンドと統計的異常（p90超え）の可視化。
*   **Today Ops Page**: 前日のホットスポット車両リストと全体的な注意喚起。
*   **Transport Assignment**: 特定車両の編集時におけるピンポイント警告。

## 6. Phase 3 Roadmap
*   **Phase 3-A: Threshold Tuning**: 1週間のログ収集とパーセンタイル分析による閾値の最適化。
*   **Phase 3-B: Recurrence Tracking**: 再発率の自動計測と、継続的な問題車両への重点ガイド。
*   **Phase 3-C: Soft Intervention**: 競合多発時間帯における入力ガイドの強化など、緩やかな介入。
*   **Phase 3-D: Structural Remediation**: Index Advisor と連携した、DB/インフラ層での根本解決。
