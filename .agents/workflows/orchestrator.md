---
description: Orchestrator AI — 既存の Orchestrator / PageState / Queue / Action Engine パターンに従って実装する
---

# Orchestrator AI ワークフロー

あなたは既存の Orchestrator パターンを使って新規ページ・機能を実装するシニアエンジニアです。
**新しい仕組みを作るのではなく、確立されたパターンに従って組み立てます。**

## コンテキスト

このプロジェクトには以下の確立されたパターンがあり、すべて運用実績があります:

### 3層アーキテクチャ（必須）

```
┌─────────────────────┐
│  Thin Orchestrator   │ ← Page or Feature のトップレベル
│  (≤200行・合成のみ)   │
├─────────────────────┤
│  PageState / Hook    │ ← 状態管理・ビジネスロジック
│  (use○○PageState)    │
├─────────────────────┤
│  UI Component        │ ← Presentational（状態を受け取るだけ）
└─────────────────────┘
```

### 既存 Orchestrator 参照先（SSOT）

| パターン | 模範実装 | 行数 |
|---------|---------|:----:|
| **ページ Orchestrator** | `src/features/schedules/hooks/useWeekPageOrchestrator.ts` | ~300 |
| **Ops ページ** | `src/features/schedules/hooks/useScheduleOps.ts` | ~100 |
| **PageState 分離** | `src/features/schedules/hooks/useSchedulesPageState.ts` | ~250 |
| **Briefing 合成** | `src/features/dashboard/briefing/useBriefingPageState.ts` | ~170 |
| **Domain Orchestrator** | `src/domain/bridge/pdcaCycleOrchestrator.ts` | ~120 |
| **フォーム Orchestrator** | `src/features/support-plan-guide/hooks/useSupportPlanForm.ts` | ~200 |

### 既存 Queue 参照先

| Queue | ファイル | 用途 |
|-------|---------|------|
| **WriteQueue** | `src/lib/writeQueue/` | localStorage 退避 + 再送 |
| **TodayActionQueue** | `src/features/today/hooks/useTodayActionQueue.ts` | 優先度付きアクション |
| **RecordActionQueue** | `src/features/daily/components/RecordActionQueue.tsx` | 未完了記録キュー |

### Today Action Engine 参照先

| レイヤー | ファイル |
|---------|---------|
| Scene 推論 | `src/features/today/domain/deriveCurrentScene.ts` |
| Next Action | `src/features/today/domain/buildSceneNextAction.ts` |
| Priority Score | `src/features/today/domain/actionQueuePriority.ts` |
| Engine Core | `src/features/today/domain/engine/` |
| Telemetry | `src/features/today/telemetry/` |

## 手順

1. まず **既存の類似実装** を確認する（`/scan` で調査してもよい）
   // turbo

2. 実装パターンを選択する

   ### パターン選択ガイド

   | ユースケース | 選ぶパターン | 参照する模範 |
   |------------|------------|------------|
   | 新規ページを作る | Thin Orchestrator + PageState | `useWeekPageOrchestrator.ts` |
   | データ表示ページ | PageState → Filter → Fetch → Summary | `useScheduleOps.ts` |
   | フォームページ | Form Orchestrator | `useSupportPlanForm.ts` |
   | ダッシュボード合成 | 複数 hook を合成 | `useBriefingPageState.ts` |
   | 純ドメインロジック | Pure function orchestrator | `pdcaCycleOrchestrator.ts` |
   | 優先度付きキュー | Action Queue + Score | `useTodayActionQueue.ts` |

3. 実装する

   ### 実装ルール

   - **Thin Orchestrator は ≤200行**（超えたら hook を抽出）
   - **Orchestrator には UI ロジックを書かない**（合成のみ）
   - **PageState は URL パラメータと同期**（`useSchedulesPageState` 参照）
   - **テレメトリは Orchestrator 層で埋め込む**（`recordCtaClick` 参照）
   - **Queue を使う場合は WriteQueue の退避パターンを維持**

4. 以下を出力する:

   ```markdown
   ## Orchestrator 実装: [機能名]

   ### 使用パターン
   - パターン: [選択したパターン名]
   - 模範: [参照した既存ファイル]

   ### 構成
   | ファイル | レイヤー | 責務 |
   |---------|---------|------|

   ### 状態フロー
   [ユーザー操作] → [PageState] → [Orchestrator] → [UI]

   ### 確認
   - [ ] Orchestrator ≤200行
   - [ ] PageState と UI が分離されている
   - [ ] 既存 Queue / Engine パターンと整合
   - [ ] テレメトリ埋め込み済み
   ```

5. ビルドとテストを実行して確認する
   // turbo

## 禁止事項

- **新しい Orchestrator パターンを発明しない**（既存パターンから選ぶ）
- **Orchestrator に直接 UI レンダリングを書かない**
- **PageState を Orchestrator の中に埋め込まない**（別 hook に分離）
- **Queue を独自実装しない**（WriteQueue or ActionQueue を使う）
- **グローバル状態を Orchestrator 内で直接操作しない**（hook 経由）

## ADR / Runbook 参照

- ADR-002: Today is an Execution Layer → `docs/adr/ADR-002-today-execution-layer-guardrails.md`
- Today Runbook → `docs/TODAY_EXECUTION_LAYER_RUNBOOK.md`
- ADR-003: Local-day keying → `docs/adr/ADR-003-local-day-keying-action-telemetry.md`
