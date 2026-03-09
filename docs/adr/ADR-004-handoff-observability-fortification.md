# ADR-004: Handoff Observability Fortification

## Status

Proposed — 2026-03-09

## Context

### Fortress Criteria ギャップ（ADR-003 照合）

Handoff モジュールの Fortress-ready 状態を ADR-003 の 5 条件で診断した結果：

| # | 条件 | 状態 | 詳細 |
|---|------|------|------|
| F1 | Unit coverage 80%+ | ✅ | 9 spec files、ドメインロジック・ViewModel・マッパー全域カバー |
| F2 | Smoke E2E | ❓ | 未確認 |
| F3 | エラー分類統一 | ⚠️ | `console.warn` のみ、構造化分類なし |
| F4 | ADR 紐付 | ❌ | 本 ADR で解消 |
| F5 | Observability | ❌ | 構造化イベントなし |

### 現状の課題

- `useHandoffTimeline.ts` がステータス変更・新規作成のログを `console.log`（DEV ガード済み）で出力するが、**構造化されていない**
- `useHandoffTimelineViewModel.ts` の防御ガード（7箇所の `console.warn`）は有用だが、**分類・集計不能**
- `HandoffAuditApi` が fire-and-forget で監査記録を行っているが、**その失敗自体が観測されていない**（`catch(e => console.warn(...))` のみ）
- `/today` の `alertActions.logger.ts` が構造化 observability の参考実装として存在するが、handoff にはこのパターンが未適用

### 参考実装: Today Execution Layer

`alertActions.logger.ts` は以下のパターンで成功している：

1. **型付きイベント**: `BriefingActionEvent` / `BriefingActionErrorEvent`
2. **エラー分類関数**: `classifyStorageError()` → `persist_failed_quota` | `persist_failed_parse` | `persist_failed_unknown`
3. **二重出力**: `auditLog`（console）+ `persistentLogger`（localStorage 永続化）
4. **PII 排除**: `userName` を除外し `userId` のみ

## Decision

### 1. Handoff に構造化 Observability Logger を導入する

`handoffActions.logger.ts` を新設し、以下のイベント分類体系を定義する：

#### Event Taxonomy

| Event Name | 発火タイミング | Payload |
|------------|---------------|---------|
| `handoff.status_changed` | ステータス遷移成功時 | `id`, `oldStatus`, `newStatus`, `meetingMode`, `source` |
| `handoff.created` | 新規作成成功時 | `id`, `category`, `severity`, `source` |
| `handoff.workflow_blocked` | 遷移ガードでブロックされた時 | `id`, `attemptedStatus`, `meetingMode`, `reason` |
| `handoff.audit_persist_failed` | 監査ログの fire-and-forget 失敗時 | `handoffId`, `action`, `errorClass`, `message` |

#### Error Classification

| Class | 条件 |
|-------|------|
| `audit_persist_network` | `fetch` 失敗（SP 接続エラー） |
| `audit_persist_storage` | localStorage 書き込み失敗 |
| `audit_persist_unknown` | 上記以外 |

### 2. UI をブロックしない

- Logger は **fire-and-forget**。イベント送出の失敗が UI 遷移を阻害してはならない
- `useHandoffTimelineViewModel.ts` の防御 `console.warn` は `handoff.workflow_blocked` イベントに置換する
- `useHandoffTimeline.ts` の `catch(e => console.warn(...))` は `handoff.audit_persist_failed` イベントに置換する

### 3. `alertActions.logger.ts` と同じ基盤を使う

- `auditLog`（`@/lib/debugLogger`）で DEV console 出力
- `persistentLogger`（`@/lib/persistentLogger`）でエラー永続化
- PII 排除: `changedByAccount` を含むが `changedBy`（表示名）は含まない

## Scope

### 対象

| 種別 | ファイル |
|------|---------|
| **[NEW]** | `src/features/handoff/actions/handoffActions.logger.ts` |
| **[NEW]** | `src/features/handoff/actions/handoffActions.logger.spec.ts` |
| **[MODIFY]** | `src/features/handoff/useHandoffTimeline.ts` — `console.warn` → structured event |
| **[MODIFY]** | `src/features/handoff/useHandoffTimelineViewModel.ts` — `console.warn` → structured event |

### 非対象（本 ADR のスコープ外）

- 状態マシン (`handoffStateMachine.ts`) の変更 → ガードレール §2.1 で保護
- Repository Port (`HandoffRepository` interface) の変更 → ガードレール §2.2 で保護
- 楽観的更新ロジックの変更 → ガードレール §2.3 で保護
- `HandoffAuditApi` の API 変更

## Consequences

### Positive

- **F4 解消**: 本 ADR が handoff モジュールの設計判断を記録
- **F5 解消**: 構造化イベントにより観測可能性が確保される
- **F3 前進**: エラー分類関数の導入で分類統一に近づく
- Fortress スコア: **2/5 → 4/5**（F2 Smoke E2E は別途対応）

### Negative / Trade-offs

- Logger ファイルの追加による軽微なファイル増（~80 行）
- `console.warn` から structured event への移行で、DevTools での直接読み取りがやや冗長になる（`auditLog` 経由のため）

### Risk & Mitigation

- **リスク**: Logger 導入時に既存テストを破壊する
- **対策**: `console.warn` を呼び出す既存テストは、Logger のモック化で対応（テスト側の `vi.spyOn(console, 'warn')` を `vi.mock('./actions/handoffActions.logger')` に置換）

## Implementation Notes

### 実装順序

1. `handoffActions.logger.ts` + spec を新設（PR 5A）
2. `useHandoffTimelineViewModel.ts` の `console.warn` 7箇所を `logWorkflowBlocked()` に置換
3. `useHandoffTimeline.ts` の `catch` 内 `console.warn` 2箇所を `logAuditPersistFailed()` に置換
4. `useHandoffTimeline.ts` の DEV ガード付き `console.log` 2箇所を `logHandoffCreated()` / `logStatusChanged()` に置換

### 関連ドキュメント

- [ADR-003: Fortress Criteria](file:///Users/yasutakesougo/audit-management-system-mvp/docs/adr/ADR-003-fortress-criteria.md) — F1-F5 条件定義
- [ADR-002: Today Execution Layer Guardrails](file:///Users/yasutakesougo/audit-management-system-mvp/docs/adr/ADR-002-today-execution-layer-guardrails.md) — Today の observability 先行事例
- [Handoff Timeline Guardrails](file:///Users/yasutakesougo/audit-management-system-mvp/docs/handoff-timeline-guardrails.md) — 不変条件・テスト安全ネット

## Reviewer Checklist

- [ ] Event taxonomy の 4 イベントが漏れなくカバーされている
- [ ] Logger は fire-and-forget（UI をブロックしない）
- [ ] PII が event payload に含まれていない（`changedBy` 表示名は除外、`account` のみ）
- [ ] 既存の 9 spec files が全 green のまま

---

## Changelog

- 2026-03-09: Initial draft — Fortress F4/F5 ギャップ解消
