# ISP 三層アーキテクチャ

## 三層モデル

| 層 | 名称 | 問い | 周期 | 画面 |
|---|---|---|---|---|
| **L1** | 個別支援計画（ISP） | **WHY** — なぜ支援するか | 6ヶ月 | `/support-plan-guide` |
| **L2** | 支援計画シート | **HOW** — どう支援するか | 3ヶ月 | `/support-planning-sheet/:id` |
| **L3** | 手順書兼記録 | **DO** — 実施する | 毎日 | `/daily/support` |

## ブリッジ

| # | ブリッジ | 方向 | 状態 |
|---|---|---|---|
| 1 | `assessmentBridge` | アセスメント → L2 | ✅ 完成 |
| 2 | `tokuseiToPlanningBridge` | 特性アンケート → L2 | ✅ 完成 |
| 3 | `planningToRecordBridge` | L2 → L3 | ✅ 完成 |
| 4 | `monitoringToPlanningBridge` | 行動モニタリング → L2 | ✅ Phase 1-4 完了 |

全ブリッジは純関数変換器（no I/O, マージ方式, 冪等, Provenance 付き）。
詳細: [docs/architecture.md §4](../architecture.md#4-the-bridges-transform-not-sync)

## 2種類のモニタリング

| | ISPモニタリング | 行動モニタリング |
|---|---|---|
| **層** | L1 | L2 |
| **対象** | 生活全体・目標・QOL | 行動・環境・支援方法 |
| **周期** | 6ヶ月 | 3ヶ月 or イベント |
| **結果** | ISP更新 | 支援計画シート更新 |
| **画面** | MonitoringTab | SupportPlanningSheetPage |

## PDCAループ

```
ループA（6ヶ月）               ループB（3ヶ月）
ISP目標 → 実施 →              計画シート → 手順書 →
ISPモニタリング → ISP更新      行動モニタリング → 計画更新
```

> 詳細: [ISP三層アーキテクチャ図（完全版）](../adr/ADR-005-isp-three-layer-separation.md)
> レビュー周期とPDCA: [支援PDCAエンジン](support-pdca-engine.md)
