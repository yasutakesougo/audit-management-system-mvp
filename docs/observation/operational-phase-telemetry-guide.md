# OperationalPhase 観測ガイド

> **観測期間**: 2週間（2026-03-14 〜 2026-03-28）
> **対象**: Firestore `telemetry` コレクション / `type = "operational_phase_event"`

---

## 1. イベント一覧

| イベント名 | 発火元 | 意味 | 主な項目 |
|---|---|---|---|
| `phase-suggest-shown` | TodayPhaseIndicator / DailyPhaseHintBanner | フェーズ提案バナーが表示された | `phase`, `screen` |
| `phase-suggest-accepted` | TodayPhaseIndicator | 主役画面への遷移ボタンがクリックされた | `phase`, `screen` |
| `phase-suggest-dismissed` | TodayPhaseIndicator / DailyPhaseHintBanner | 提案バナーが閉じられた | `phase`, `screen` |
| `meeting-mode-suggested` | MeetingModeSuggestionBanner | 会議モード提案バナーが表示された | `suggestedMode`, `screen` |
| `meeting-mode-accepted` | MeetingModeSuggestionBanner | 会議モード提案が受け入れられた | `suggestedMode`, `screen` |
| `meeting-mode-dismissed` | MeetingModeSuggestionBanner | 会議モード提案が閉じられた | `suggestedMode`, `screen` |
| `config-load-fallback` | useOperationFlowConfig | 設定ロード失敗でデフォルト値にフォールバック | `reason` |

---

## 2. 各イベントの見方

### 2.1 shown（表示）

**何を見るか**: ユーザーが提案を目にした回数。

- **正常**: 業務時間帯に安定して発火している
- **異常**: 特定の時間帯で極端に少ない → その画面を開いていない or フェーズ判定がずれている
- **注意**: dedupe ガード付きなので、同一セッション内の再レンダリングではカウントされない

```
確認クエリ:
  event = "phase-suggest-shown"
  GROUP BY phase, screen
  ORDER BY clientTs DESC
```

### 2.2 accepted（受入）

**何を見るか**: 提案に従って画面遷移したか。

- **正常**: shown の 20〜40% で accepted が発生
- **低すぎ（< 10%）**: 提案の文言が不適切 or 遷移先が不要
- **高すぎ（> 60%）**: 提案が正しく機能 → デフォルト遷移に昇格を検討

```
確認クエリ:
  event IN ("phase-suggest-shown", "phase-suggest-accepted")
  GROUP BY phase
  PIVOT BY event
```

### 2.3 dismissed（閉じる）

**何を見るか**: 提案を意図的に閉じたか。

- **正常**: shown の 30〜60% で dismissed
- **高すぎ（> 70%）**: 提案が邪魔になっている → 表示頻度 or 条件を見直す
- **低すぎ（< 10%）**: 無視されている（見て閉じずにそのまま）→ 非表示条件を検討

### 2.4 fallback（フォールバック）

**何を見るか**: 設定ロードの信頼性。

- **正常**: 0件
- **要注意**: 日に 1〜3件 → ネットワーク瞬断の可能性
- **危険**: 日に 5件以上 → Repository の実装 or インフラに問題

```
確認クエリ:
  event = "config-load-fallback"
  GROUP BY reason
  ORDER BY clientTs DESC
```

---

## 3. 指標定義

### 3.1 Phase-Suggest CTR（クリックスルーレート）

```
CTR = phase-suggest-accepted / phase-suggest-shown × 100
```

| 判定 | CTR | アクション |
|---|---|---|
| 🟢 健全 | 20〜50% | 現状維持 |
| 🟡 要注意 | 10〜20% | 文言・タイミングの微調整を検討 |
| 🔴 危険 | < 10% | 提案の価値がない → 非表示 or リデザイン |

> **フェーズごとに分割して見ること。** 全体平均だけだと偏りが隠れる。

### 3.2 Dismiss 率

```
Dismiss率 = phase-suggest-dismissed / phase-suggest-shown × 100
```

| 判定 | Dismiss 率 | アクション |
|---|---|---|
| 🟢 健全 | 20〜50% | 正常な拒否率 |
| 🟡 要注意 | 50〜70% | 提案の出しすぎ or タイミング不適切 |
| 🔴 危険 | > 70% | ユーザーストレスが高い → 表示条件の変更 |

### 3.3 Meeting-Mode 受入率

```
受入率 = meeting-mode-accepted / meeting-mode-suggested × 100
```

| 判定 | 受入率 | アクション |
|---|---|---|
| 🟢 健全 | 40〜70% | 提案が的確 |
| 🟡 要注意 | 20〜40% | 時間帯設定のずれ or 提案不要な人がいる |
| 🔴 危険 | < 20% | 会議モード提案を見直す |

> **morning / evening を分けて見ること。** 片方だけ極端に低い場合がある。

### 3.4 Fallback 発生率

```
Fallback率 = config-load-fallback / (全日のアクティブセッション数) × 100
```

| 判定 | Fallback 率 | アクション |
|---|---|---|
| 🟢 健全 | 0% | 設定ロードが安定 |
| 🟡 要注意 | 1〜5% | ネットワーク品質を確認 |
| 🔴 危険 | > 5% | Repository 実装 or 設定データを調査 |

### 3.5 残留率（参考指標）

```
残留率 = 1 - (accepted + dismissed) / shown
```

shown されたが accepted でも dismissed でもないケース = バナーを見て放置。
高すぎる場合はバナーが目に入っていない可能性がある。

---

## 4. 日次確認チェックリスト

毎朝（前日分）に以下を確認する。所要時間: 5〜10分。

### □ Step 1: Fallback 確認（最優先）

```
Firestore Console → telemetry
  where type == "operational_phase_event"
  where event == "config-load-fallback"
  where clientTs >= "昨日 00:00"
  orderBy clientTs desc
```

- [ ] 0件 → OK
- [ ] 1件以上 → `reason` を確認し Slack 共有

### □ Step 2: shown / accepted / dismissed のカウント

```
Firestore Console → telemetry
  where type == "operational_phase_event"
  where event IN ["phase-suggest-shown", "phase-suggest-accepted", "phase-suggest-dismissed"]
  where clientTs >= "昨日 00:00"
```

以下を記録:

| 指標 | /today | /daily | /handoff | 合計 |
|---|---|---|---|---|
| shown | | | | |
| accepted | | | | |
| dismissed | | | | |
| **CTR** | | | | |
| **Dismiss率** | | | | |

### □ Step 3: Meeting-Mode のカウント

```
Firestore Console → telemetry
  where type == "operational_phase_event"
  where event IN ["meeting-mode-suggested", "meeting-mode-accepted", "meeting-mode-dismissed"]
  where clientTs >= "昨日 00:00"
```

| 指標 | morning | evening | 合計 |
|---|---|---|---|
| suggested | | | |
| accepted | | | |
| dismissed | | | |
| **受入率** | | | |

### □ Step 4: フェーズ別分布の確認

- [ ] 特定フェーズに shown が集中していないか
- [ ] 深夜帯（after_hours_review）に shown が出ていないか
- [ ] 期待するフェーズで提案が出ているか

### □ Step 5: 日次所見メモ（1行）

```
例: 「夕会 dismiss 率が 80%。17:00 の設定が早すぎる可能性」
```

---

## 5. 2週間レビュー集計テンプレート

### 5.1 総合サマリー

| 指標 | Week 1 | Week 2 | 変化 | 判定 |
|---|---|---|---|---|
| Phase-Suggest CTR（全体） | __% | __% | | 🟢🟡🔴 |
| Phase-Suggest Dismiss率 | __% | __% | | 🟢🟡🔴 |
| Meeting-Mode 受入率（全体） | __% | __% | | 🟢🟡🔴 |
| Meeting-Mode 受入率（morning） | __% | __% | | 🟢🟡🔴 |
| Meeting-Mode 受入率（evening） | __% | __% | | 🟢🟡🔴 |
| Fallback 発生件数 | __件 | __件 | | 🟢🟡🔴 |
| 残留率 | __% | __% | | 参考 |

### 5.2 フェーズ別ヒートマップ

| フェーズ | shown | accepted | dismissed | CTR | Dismiss率 | 判定 |
|---|---|---|---|---|---|---|
| staff_prep (出勤・朝準備) | | | | | | |
| morning_briefing (朝会) | | | | | | |
| arrival_intake (通所受入) | | | | | | |
| am_activity (午前活動) | | | | | | |
| pm_activity (午後活動) | | | | | | |
| departure_support (退所対応) | | | | | | |
| record_wrapup (記録仕上げ) | | | | | | |
| evening_briefing (夕会) | | | | | | |
| after_hours_review (振り返り) | | | | | | |

### 5.3 画面別パフォーマンス

| 画面 | shown | accepted | dismissed | CTR | Dismiss率 |
|---|---|---|---|---|---|
| /today | | | | | |
| /daily | | | | | |
| /handoff | | | | | |

### 5.4 時間帯別ヒット率（config 妥当性の検証）

```
目的: 設定した時間帯と実際の利用パターンがずれていないかを確認する
```

| 時間帯 | 設定上のフェーズ | 主役画面 | shown | accepted | 所見 |
|---|---|---|---|---|---|
| 08:30–08:59 | staff_prep | /today | | | |
| 09:00–09:14 | morning_briefing | /handoff-timeline | | | |
| 09:15–10:29 | arrival_intake | /daily/attendance | | | |
| 10:30–11:59 | am_activity | /today | | | |
| 12:00–15:29 | pm_activity | /daily | | | |
| 15:30–15:59 | departure_support | /daily/attendance | | | |
| 16:00–16:59 | record_wrapup | /daily | | | |
| 17:00–17:59 | evening_briefing | /handoff-timeline | | | |
| 18:00–08:29 | after_hours_review | /dashboard | | | |

### 5.5 Fallback 詳細

| 日付 | 件数 | reason 内訳 | 対応 |
|---|---|---|---|
| | | | |
| | | | |
| **合計** | | | |

### 5.6 レビュー判定と次のアクション

#### Phase-Suggest 判定

- [ ] CTR が 20% 以上 → 提案は現状維持
- [ ] CTR が 10〜20% → 文言・タイミング調整 PR を作成
- [ ] CTR が 10% 未満 → 非表示 or リデザインを検討
- [ ] Dismiss 率が 70% 超 → 表示条件を厳格化

#### Meeting-Mode 判定

- [ ] 受入率が 40% 以上 → 現状維持
- [ ] morning / evening で 20% 以上の差 → 片方の時間帯を調整
- [ ] 受入率が 20% 未満 → 提案ロジックを見直す

#### Fallback 判定

- [ ] 0件 → 安定稼働
- [ ] 1〜10件 → 原因特定し改善タスクを起票
- [ ] 10件超 → 緊急対応が必要

#### 時間帯設定の判定

- [ ] 各時間帯で期待通りの shown が出ている → 設定値は妥当
- [ ] 特定時間帯で accepted が 0 → その時間帯の提案を停止検討
- [ ] 空白の時間帯がある → フェーズのカバレッジを見直す

---

## 6. 判定基準サマリー

| 指標 | 🟢 健全 | 🟡 要注意 | 🔴 危険 |
|---|---|---|---|
| Phase-Suggest CTR | 20〜50% | 10〜20% | < 10% |
| Dismiss 率 | 20〜50% | 50〜70% | > 70% |
| Meeting-Mode 受入率 | 40〜70% | 20〜40% | < 20% |
| Fallback 発生率 | 0% | 1〜5% | > 5% |
| 残留率 | < 30% | 30〜50% | > 50% |

---

## 7. 運用メモ

### Firestore クエリのコツ

- `type == "operational_phase_event"` でフィルタすると OperationalPhase 系だけに絞れる
- `clientTs` は ISO 文字列。日付範囲は文字列比較で可能
- `ts` は Firestore の `serverTimestamp` — 書き込み順のソートに使う

### dedupe ガードの影響

- `phase-suggest-shown` と `meeting-mode-suggested` は同一セッション内で重複送信されない
- ブラウザリロードでガードはリセットされる
- したがって **shown 数 ≒ セッション数** と読める（厳密には 1 セッション 1 フェーズにつき 1 回）

### 観測期間終了後

2週間レビューの結果に基づいて以下のいずれかを実施:

1. **設定値の調整** → `/settings/operation-flow` で時間帯を変更
2. **提案 UI の改善** → 文言・色・アイコンの変更 PR
3. **提案の廃止** → 特定フェーズでバナーを非表示にする
4. **自動遷移への昇格** → CTR が非常に高いフェーズで自動遷移を検討
