# ADR-003: Fortress Criteria — モジュール品質基準の定義

## Status

Accepted

## Context

audit-management-system は MVP → 運用 → Hardening フェーズを経て、Fortress 化フェーズに入ろうとしている。しかし「Fortress」の定義が曖昧なままでは、品質目標が不明確になり運用安定性を担保できない。

### 現在の課題

- エラー分類が `classifyError`（schedules adapter）と `classifySpSyncError`（dashboard）で二重定義
- Observability イベントが nurse モジュールにのみ存在し、他のモジュールにはない
- ADR が ADR-001（アーカイブ戦略）のみで、設計判断の記録が不足
- モジュール間の品質基準が不均一

### 背景

- 38 feature modules、879 src files、443 test files を持つ中規模プロジェクト
- MSAL + SharePoint + Cloudflare Worker を統合した攻撃面を持つシステム
- 28 CI workflows による自動品質ゲート
- AI Usage Protocol（`docs/ai-usage-protocol.md`）によるスキル活用体制

## Decision

### 1. Fortress-ready の定義

以下の **5 条件** を **すべて** 満たしたモジュールを Fortress-ready と定義する：

| # | 条件 | 検証方法 |
|---|---|---|
| F1 | Unit coverage: 主要ロジック 80%以上 | `vitest --coverage` で計測 |
| F2 | Smoke E2E が存在 | `tests/e2e/{module}.smoke.spec.ts` が存在 |
| F3 | エラー分類が統一されている | `@/lib/errors` の共通分類関数を使用 |
| F4 | ADR が 1 つ以上紐付いている | `docs/adr/` に該当 ADR が存在 |
| F5 | Observability イベントが 1 つ以上存在 | `startFeatureSpan` または `emitTelemetry` の呼び出しが存在 |

### 2. フェーズ移行条件

| From → To | 移行条件 |
|---|---|
| MVP → 運用 | CRUD + 認証 + 基本 E2E green / 主要フロー smoke test PASS |
| 運用 → Hardening | エラーハンドリング統一 / unit + E2E 追加 / MSAL・SP 認証監査完了 |
| Hardening → Fortress | Tier 1 モジュール（auth, daily, schedules）が全て Fortress-ready |

### 3. Tier 1 モジュール（優先 Fortress 化対象）

| モジュール | ファイル数 | 理由 |
|---|---|---|
| `auth` | 14 | 攻撃面、認証基盤 |
| `daily` | 56 | ユーザー影響最大 |
| `schedules` | 72 | 最大モジュール、SharePoint 依存 |

### 4. スキル適用ルール

**1 PR = 1 Skill Chain（最大 3 スキル）** を遵守する。
PR テンプレートの `🧠 AI Skill Chain` セクションに使用スキルを記録する。

## Consequences

### Positive

- 「Fortress」の定義が明確になり、品質目標が測定可能になる
- モジュール間の品質基準が統一される
- フェーズ移行判断が客観的になる
- 段階的 Fortress 化により、リスクを分散できる

### Negative

- Fortress 基準の達成に追加工数が必要
- 全モジュール Fortress 化には中長期的な投資が必要

### Risk & Mitigation

- **リスク**: 基準が厳しすぎて達成不可能になる
- **対策**: Tier 1（3 モジュール）から段階的に適用し、必要に応じて基準を調整する

## Implementation Notes

### 対象ファイル

- `docs/ai-usage-protocol.md` — Fortress Criteria + Module Tracker
- `.github/pull_request_template.md` — Skill Chain セクション
- `src/lib/errors.ts` — 統一エラー分類関数の追加（Task 3 で実施）

### 関連 ADR

- ADR-001: アーカイブ戦略
- ADR-002: Guardrails（ARCHITECTURE_GUARDS.md として実装済み）

---

## Changelog

- 2026-02-28: Initial draft — Fortress Criteria 策定
