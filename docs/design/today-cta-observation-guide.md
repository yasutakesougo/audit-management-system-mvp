# /today CTA 観測ログ — レビュー運用メモ

> **開始日**: 2026-03-11  
> **観測期間**: 最低5営業日（初回レビューは3日後）  
> **データソース**: Firestore `telemetry` コレクション (`type: 'todayops_cta_click'`)

## 観測対象イベント

| # | イベント名 | 意味 | stateType |
|---|-----------|------|-----------|
| 1 | `today_next_action_primary_clicked` | Scene guidance CTA（確認する 等） | `scene-action` |
| 2 | `today_next_action_empty_clicked` | 空状態 → スケジュールを見る | `empty-state` |
| 3 | `today_next_action_utility_clicked` | 空状態 → その他の記録へ | `empty-state` |

---

## 見るべき指標 5項目

### ① primary CTA 占有率

**問い**: NextActionCard の主導線は本当に主導線か？

```
primary_rate = primary_clicked / (primary + empty + utility)
```

| 判定 | 基準 | 対応 |
|------|------|------|
| ✅ 健全 | ≥ 70% | 主導線が機能している |
| ⚠️ 要注意 | 50〜70% | scene 推定の精度を確認 |
| 🔴 問題 | < 50% | 導線設計の見直しが必要 |

### ② empty-state 発生率

**問い**: 「今すぐやることがない」状態がどの程度あるか？

```
empty_rate = (empty + utility) / total_clicks
```

| 判定 | 基準 | 意味 |
|------|------|------|
| 正常 | < 30% | ほとんどの時間帯で scene guidance が出ている |
| 高め | 30〜50% | 午前早い時間帯に偏っていないか確認 |
| 高すぎ | > 50% | scene 推定が不足、または判定閾値の見直し |

### ③ utility CTA の対 primary 比率

**問い**: 「その他の記録へ」が primary を食っていないか？

```
utility_vs_primary = utility_clicked / primary_clicked
```

| 判定 | 基準 | 意味 |
|------|------|------|
| ✅ 理想 | < 0.1 | 補助導線として正しく機能 |
| 注意 | 0.1〜0.3 | 記録メニューへの需要が想定以上 |
| 🔴 逆転 | > 0.3 | utility が主導線化している → 配置再考 |

### ④ scene 別の押下分布

**問い**: どの場面で CTA が押されているか？

```sql
-- Firestore query イメージ
SELECT scene, COUNT(*) as clicks
FROM telemetry
WHERE type = 'todayops_cta_click'
  AND ctaId = 'today_next_action_primary_clicked'
GROUP BY scene
ORDER BY clicks DESC
```

注目ポイント:
- **朝礼**: 朝の scene guidance が効いていれば最多になるはず
- **終礼**: 午後で落ちていたら scene 遷移タイミングを調整
- **null / undefined**: scene なしで primary が押されている → schedule-context のみで行動している

### ⑤ targetUrl の偏り

**問い**: 遷移先に偏りがあるか？

```sql
SELECT targetUrl, COUNT(*) as clicks
FROM telemetry
WHERE type = 'todayops_cta_click'
GROUP BY targetUrl
ORDER BY clicks DESC
```

注目ポイント:
- `briefing` が最多 → 申し送り確認が主要業務フロー
- `/schedules` が多い → empty-state 経由が多い（上記②と相関あり）
- `quick-record` が少ない → 記録導線は別経路で到達している可能性

---

## レビュー手順

### 初回レビュー（3営業日後）

1. Firestore Console で `telemetry` コレクションを開く
2. `type == 'todayops_cta_click'` でフィルタ
3. 上記5指標をざっと確認
4. 明らかな異常があれば即対応、なければ5日目まで観察

### 定常レビュー（週次）

1. 5指標のスナップショットを取る
2. 前週と比較して傾向変化を確認
3. 必要に応じて下段ウィジェット計装を追加

---

## 判断フローチャート

```
primary_rate ≥ 70%
├── Yes → ✅ 主導線は機能している
│         └── utility 比率 < 0.1?
│              ├── Yes → ✅ 補助導線も適切
│              └── No  → ⚠️ 記録メニュー需要を確認
└── No  → ⚠️ scene 推定を確認
          └── empty_rate > 50%?
               ├── Yes → 🔴 scene 判定が不足
               └── No  → scene の CTA ラベル/配置を見直し
```

---

## 次のアクション候補（データを見てから判定）

| 条件 | アクション |
|------|----------|
| primary_rate が安定して高い | 下段ウィジェット計装を追加 |
| empty-state が多すぎる | scene 判定の閾値を緩和 |
| utility が想定以上に多い | 記録メニューの昇格を検討 |
| 特定 scene が極端に多い/少ない | 時間帯別の scene マッピングを調整 |
| データが十分貯まった | モバイル視線の実機確認へ進む |
