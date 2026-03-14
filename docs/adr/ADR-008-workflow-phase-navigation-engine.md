# ADR-008: Workflow Phase Navigation Engine — 全画面巡回型ナビゲーション

| 項目 | 内容 |
|:-----|:-----|
| **ステータス** | Accepted |
| **日付** | 2026-03-14 |
| **決定者** | @yasutakesougo |
| **関連ADR** | ADR-005 (ISP三層分離), ADR-006 (画面責務境界), ADR-007 (Monitoring-to-Reassessment Bridge) |

---

## コンテキスト

PDCA ループの各工程（Plan → Do → Check → Act）は機能としては実装済みだったが、
以下の課題が残っていた。

1. **「次に何をすればよいか」が分からない**: 機能は揃っていても、利用者ごとに今どの工程にいるかを判断する仕組みがなかった
2. **Today ページと個別画面が分断**: Today は全体状況を表示するが、各画面に入ると「ここで何をすべきか」が消える
3. **運用知識に依存**: システムの使い方を知っている管理者しか PDCA を回せない状態
4. **フェーズ判定のブレ**: 利用者ごとの優先度を人間の記憶で管理しており、見落としが発生しうる

## 決定

**3層ナビゲーションエンジン** を採用する。

```text
Phase 1: determineWorkflowPhase()
  ── 利用者単位でPDCAフェーズを判定する純関数
  
Phase 2: useWorkflowPhases() + PlanningWorkflowCard
  ── Today ページの全体ナビ（誰に何が必要か）

Phase 3: resolveNextStepBanner() + PhaseNextStepBanner
  ── 各画面の局所ナビ（この画面で次に何をするか）
```

全体の情報フローは以下の通り:

```text
Today ページ                          計画シート各タブ
┌────────────────────┐              ┌─────────────────────────────┐
│ 📋 支援計画管理        │   CTA →    │ 概要: ℹ 支援手順が未設計です →  │
│  🔴 超過: 田中太郎     │  ────────→ │ 監視: ⚠ 見直し候補が検出 →     │
│  🔵 未作成: 佐藤花子   │            │ 再評: ℹ モニタリング結果反映 →  │
│  🟢 安定: 山田一郎     │            └─────────────────────────────┘
└────────────────────┘
```

## 判断根拠

### なぜ 6 フェーズに分類したか

```text
needs_assessment   → 計画シートなし（PDCA未開始）
needs_plan         → 計画シートはあるが手順未設計（P未完了）
active_plan        → 計画運用中（D実施中、安定）
needs_monitoring   → モニタリング14日以内（C準備）
monitoring_overdue → モニタリング期限超過（C遅延）
needs_reassessment → 再評価が計画に未反映（A未完了）
```

**より少ないフェーズ** では、`needs_monitoring` と `monitoring_overdue` の緊急度差が消えてしまい、
**より多いフェーズ** では、判定条件が複雑になり保守コストが上がる。

6 フェーズはPDCA各工程の「待ち状態」を正確に捉えつつ、
判定ロジックを 1 関数に収められるバランス点。

### なぜ pure function 中心に設計したか

**3つの理由:**

1. **テスタビリティ**: React 非依存で単体テスト可能（59テスト、合計100ms以下）
2. **再利用性**: 同じ判定関数を Today カード、タブバナー、将来の通知・メール・PDF生成など複数箇所で使用可能
3. **保守性**: 判定ロジックの変更が UI に波及しない（mapper を挟む分離設計）

```text
判定（pure）         表示（mapper）       描画（UI）
determinePhase() → toCardItem()     → PlanningWorkflowCard
resolveNextStep() → ─────────────── → PhaseNextStepBanner
```

### なぜ CTA を 1 つに限定したか

**福祉現場の特性:**

- 複数選択肢を出すと「どちらが正しいか」で手が止まる
- 管理者は複数利用者を並行で見ており、認知負荷が高い
- 「上から順に押す」だけで業務が進む設計が最も導入障壁が低い

### なぜ admin ロール限定にしたか

- 支援計画管理は制度上サービス管理責任者の業務
- 直接支援員（staff）には表示しても混乱の元になる
- 将来 `serviceManager` ロールが追加された場合は条件を拡張可能

## フェーズ判定の優先順序

```text
1. needs_assessment   (計画シートなし)     priority: 3
2. needs_plan         (手順未設計)         priority: 4
3. monitoring_overdue (期限超過)           priority: 1  ← 最優先
4. needs_reassessment (再評価未反映)       priority: 2
5. needs_monitoring   (14日以内)           priority: 5
6. active_plan        (安定)              priority: 6
```

`monitoring_overdue` を最優先にしたのは、モニタリング超過が
監査指摘事項に直結するため。

## バナー設計ルール

| # | ルール | 理由 |
|:--|:-------|:-----|
| 1 | CTA は必ず1つ | 迷わせない |
| 2 | 説明は2行以内 | 画面上部の帯として邪魔にならない |
| 3 | 主語は「次に何をするか」 | 「表示しています」ではなく「してください」 |
| 4 | 不要時は非表示 | active_plan で安定時はバナー不要 |

## 関連ファイル

| ファイル | 責務 | Phase |
|:--------|:-----|:------|
| `domain/bridge/workflowPhase.ts` | フェーズ判定 + UI mapper（純関数） | 1 |
| `domain/bridge/nextStepBanner.ts` | 画面別バナー判定（純関数） | 3 |
| `features/today/hooks/useWorkflowPhases.ts` | Hook + パイプライン | 2 |
| `features/today/widgets/PlanningWorkflowCard.tsx` | Today カード UI | 2 |
| `features/planning-sheet/components/PhaseNextStepBanner.tsx` | タブバナー UI | 3 |
| `pages/TodayOpsPage.tsx` | Today 統合 | 2 |
| `pages/SupportPlanningSheetPage.tsx` | タブ統合 | 3 |

## 結果

- **59テスト全パス**（Phase 1: 34, Phase 2: 9, Phase 3: 16）
- 型チェッククリーン
- Today ページ、概要タブ、モニタリングタブ、再評価タブでブラウザ検証済み
- admin ロール限定で導入リスク最小化

## 将来の拡張ポイント

1. **利用者詳細ページへの展開** — 個別利用者画面でもフェーズ + 次アクションを表示
2. **履歴スナップショット保存** — フェーズ遷移を記録し、監査・引き継ぎに活用
3. **通知連携** — `monitoring_overdue` 検出時にメール/チャット通知
4. **フェーズ遷移ログ** — いつ誰がどのCTAを押したかのテレメトリ記録
5. **閾値カスタマイズ** — 施設ごとにモニタリング警告日数（現在14日固定）を設定可能に
