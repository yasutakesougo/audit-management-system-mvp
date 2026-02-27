# Fortress Roadmap (Remaining ~30%) — Design Blueprint

> **Project**: audit-management-system-mvp  
> **Phase**: Hardening → Fortress  
> **Date**: 2026-02-28  
> **Related PRs**: #660 (ADR-003), #661 (Daily Observability), #662 (Unified Error Classification)

---

## 0. Goal

Tier 1 modules **auth / schedules / daily** を "Fortress-ready" に揃える。  
既に daily は先行達成（F5 Observability, F3 Error Classification）。残りは auth + schedules + Worker の同等化。

### Fortress Criteria (ADR-003 準拠)

| # | 条件 |
|---|---|
| F1 | Unit 80%+（主要ロジック） |
| F2 | E2E smoke が存在 |
| F3 | error classification 統一（`classifyError`） |
| F4 | ADR 紐付け |
| F5 | observability イベントが存在（重要フロー） |

---

## 1. Architecture Principles (Non-negotiable)

1. **Vocabulary Unity**: エラー分類（6カテゴリ）と observability イベント名を全層で統一する
2. **Feature-first Instrumentation**: "計測の起点" は feature から（auth/schedules/daily）
3. **Worker parity**: Worker は「HTTP結果」だけでなく「分類＋hint」を返す（UIで同じ語彙を使う）
4. **Evidence-first**: 変更は必ず Evidence Pack（Unit/E2E/Obs/Doc）を揃える
5. **1 PR = 1 Skill Chain**: 最大3スキル。スコープは 1 feature または 1 route

---

## 2. Unified Error Classification Expansion Plan

### 2.1 Current state (PR #662)

- `@/lib/errors.ts`: `classifyError()` / `classifyErrorWithHint()`
- categories: `auth | network | timeout | schema | server | unknown`
- Japanese hints: 運用者向け

### 2.2 Target state

- **Auth layer**（MSAL/Graph/SharePoint認証周り）
- **Schedules feature**（既存 adapter 重複削除済 → 他にも残っていないか探索）
- **Cloudflare Worker**（fetch / schema / timeout を同じ分類で返す）

### 2.3 Classification Contract (Recommended)

```typescript
export type ErrorCategory =
  | 'auth'
  | 'network'
  | 'timeout'
  | 'schema'
  | 'server'
  | 'unknown';

export type ClassifiedError = {
  category: ErrorCategory;
  hintJa?: string;      // short operator hint
  retryable?: boolean;  // UI logic
  httpStatus?: number;  // if available
  code?: string;        // e.g. MSAL error code, SP error code
  cause?: unknown;
};
```

**Rules (must be deterministic)**

| Category | Conditions |
|---|---|
| `auth` | 401/403、MSAL token/interaction required、invalid_grant 等 |
| `network` | fetch fail, offline, DNS, CORS-ish |
| `timeout` | AbortError, known timeout codes |
| `schema` | Zod error, parse failure, unexpected shape |
| `server` | 5xx, SP throttling(429) は `server` + `retryable` |
| `unknown` | anything else |

> [!NOTE]
> 429 を `server` に寄せる（運用上 "混雑/待て" と同類）。  
> ただし `hintJa` は「混雑中。少し待って再試行」などを推奨。

### 2.4 Auth Expansion Points (Frontend)

**Where（候補）**
- MSAL sign-in / token acquisition（silent/redirect/popup）
- Graph `/me`（確認フロー）
- SharePoint REST 呼び出し（401/403 の表現統一）

**What**
- catch の最終地点で `classifyErrorWithHint(e)` を通す
- snackbar / banner / errorBoundary の表示は `category` をキーに統一
- retry UI（可能な範囲）を `retryable` に寄せる

**DoD**
- [ ] auth 関連の catch が "同じ分類関数" に集約
- [ ] 401/403 は必ず `auth` 判定
- [ ] 代表的エラー（InteractionRequired, network fail, timeout）で unit test

### 2.5 Worker Expansion Points (Cloudflare Worker)

**Goal**: Worker→Frontend のエラー語彙を一致させる。

**Worker Response Shape (Example)**

```json
{
  "ok": false,
  "error": {
    "category": "timeout",
    "hintJa": "応答が遅延しています。少し待って再試行してください。",
    "retryable": true,
    "httpStatus": 504,
    "code": "UPSTREAM_TIMEOUT"
  }
}
```

**DoD**
- [ ] Worker が `category` を返す
- [ ] Frontend がそれを `classifyError` に "二重分類" せず、基本は信頼する
- [ ] 代表レスポンスの contract test 1本

---

## 3. Observability Template (Auth + Schedules)

### 3.1 Current state (PR #661)

- `src/hydration/features.ts`
- `HYDRATION_FEATURES.daily`: load/save/list（目標msあり）
- repo で load/save/list の計測実装（found, itemCount, mode）

### 3.2 Target state

- `HYDRATION_FEATURES.auth`（signIn, token, me）
- `HYDRATION_FEATURES.schedules`（既存 + lanes, events, save）
- "イベント名"と"計測フィールド"をテンプレ化し、各featureが揃う

### 3.3 Event Naming Convention (Required)

`<feature>.<action>` で固定:

| Feature | Events |
|---|---|
| `auth` | `auth.signIn`, `auth.token`, `auth.me` |
| `schedules` | `schedules.lanes`, `schedules.events`, `schedules.save` |
| `daily` | `daily.load`, `daily.save`, `daily.list` (既存) |

### 3.4 Auth Observability Spec

| Event | Target(ms) | meta | Notes |
|---|---|---|---|
| `auth.signIn` | 800 | method=redirect/popup, step | 開始〜完了 |
| `auth.token` | 300 | kind=silent/interactive, cacheHit | token取得 |
| `auth.me` | 250 | httpStatus, retryCount | /me確認 |

**DoD**
- [ ] 3イベント追加
- [ ] signIn→me の E2E smoke を計測つきで green
- [ ] failure で `category` が入る

### 3.5 Schedules Observability Spec

| Event | Target(ms) | meta | Notes |
|---|---|---|---|
| `schedules.lanes` | 150 | itemCount, source=sp/seed | lane構造 |
| `schedules.events` | 400 | itemCount, rangeDays | 予定取得 |
| `schedules.save` | 350 | mode=create/update, httpStatus | 保存 |

**DoD**
- [ ] 3イベント追加
- [ ] network failure でも lanes（seed）が残る挙動を維持
- [ ] `classifyError` の `category` が統一される

---

## 4. Execution Plan (Next Session)

### Sprint 1: Auth parity — Highest ROI

1. `classifyError` を auth に接続（catch集約）
2. `HYDRATION_FEATURES.auth` 追加 + 3イベント実装
3. MSAL E2E smoke（signIn→/me→signOut）+ Evidence Pack

> **Expected result**: Tier 1 の "攻撃面" と "検知" が揃う。

### Sprint 2: Schedules parity

1. schedules の残存エラー分類重複を探索→削除（全て `errors.ts` 経由へ）
2. `HYDRATION_FEATURES.schedules` + 3イベント
3. schedules smoke（lane render + events fetch + save）+ Evidence Pack

> **Expected result**: 最大モジュールが "測れる/分類できる" になる。

### Sprint 3: Worker parity

1. Worker エラー分類レスポンスを実装
2. Frontend 側の取り込み（二重分類回避、hint統一）
3. Contract test（最低1）

> **Expected result**: 全層で "同じ言語" で障害を扱える。

---

## 5. Evidence Pack Checklist (Per PR)

- [ ] **Unit**: 対象scopeの test PASS（分類/計測は必須で増やす）
- [ ] **E2E**: 追加/更新した smoke PASS
- [ ] **Observability**: 新規イベント（またはmeta拡張）が確認できる
- [ ] **ADR/Doc**: 仕様の追加/更新リンク（Roadmap/ADR/Runbook）

---

## 6. Open Questions (Parked, do not block)

- 429 を `server` 扱いで良いか（暫定: `server` + `retryable`）
- Observability の永続化ストア（localStorage? SP list? Worker KV?）
- PII/機微情報の meta 取り扱いルール（原則入れない）

---

## 7. Immediate TODO (Next Session Start)

1. auth の catch 起点を棚卸し（MSAL + Graph + SP）
2. schedules の duplicate classification 残存探索
3. Worker の error response contract 叩き台決定
