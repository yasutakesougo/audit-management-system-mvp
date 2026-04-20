# Reason Classification for Health Check Create Probes

**Status:** Design (not yet implemented)
**Target PR:** follow-up to [#1532](https://github.com/yasutakesougo/audit-management-system-mvp/pull/1532)
**Scope:** `src/features/diagnostics/health/checks.ts` — Create probe in `runListChecks`

---

## 1. 背景 / 問題

`/admin/status` のヘルス診断で、リストの Create probe が失敗すると、**どんな理由でも一律に「作成（Create）権限がありません。【要管理者対応】」と表示**される。

該当コードは [checks.ts:532-549](../../src/features/diagnostics/health/checks.ts#L532-L549):

```ts
if (!created.ok) {
  results.push(
    fail({
      summary: "作成（Create）権限がありません。【要管理者対応】",
      detail: created.err,
      // ...
    })
  );
}
```

このため次のような false-fail が起きる:

- UserID などのユニーク制約違反 → 「権限なし」と表示
- スロットリング (HTTP 429) → 「権限なし」と表示
- フィールド名 drift → 「権限なし」と表示

診断結果の detail には生のエラー本文が残っているが、summary と nextActions が誤誘導するため、**管理者が真の問題に到達するまでに時間がかかる**。これは feedback memory `feedback_health_check_no_false_fail.md` で「運用OSとしての品格を損なう最大の要因」と位置付けられた課題の続きにあたる。

なお PR #1532 で module-scope の `uniqueId` を run-scope に修正し、**同一 run 内の重複再送による false duplicate は解消済み**。本 PR の目的は、それでも発生し得る **本物の duplicate / throttle / drift / auth** を正しくラベル付けすることにある。

---

## 2. 目的

Create probe の失敗理由を分類し、summary / detail / nextActions を分類に応じて適切化する。これにより:

- 管理者が FAIL の真因に 1 ステップで到達できる
- 「権限問題」を本当の `auth` ケースに限定し、診断の信頼度を回復する
- telemetry の reasonCode（将来拡張）との整合の土台を作る

---

## 3. 対象範囲

### 含む

- `runListChecks` 内の Create probe ([checks.ts:520-561](../../src/features/diagnostics/health/checks.ts#L520-L561))
- `classifyCreateError(err): ClassifiedCreateError` の新設
- 分類ごとの summary / nextActions テンプレ
- 分類用の unit test fixtures

### 含まない（将来拡張）

- Update / Delete probe への横展開
- `auth.currentUser` / `connectivity.web` など他 probe への適用
- telemetry への reasonCode 送信

---

## 4. 分類モデル

| code | 意味 | 代表シグナル |
|---|---|---|
| `auth` | 認証/認可の問題 | HTTP 401, 403; `AccessDenied`; `-2147024891` |
| `duplicate` | ユニーク制約違反 | HTTP 400 + SP message に `duplicate value` / `一意な値` / `[列名]`; `-2130575214` |
| `drift` | 列名 drift（internal-name 不一致） | HTTP 400 + `Column 'X' does not exist`; `FieldNotFound` |
| `throttle` | スロットリング | HTTP 429, 503; `Retry-After` ヘッダ |
| `unknown` | 上記いずれにも該当しない | — |

### 4.1 分類優先順位

複数シグナルが同時にヒットした場合、**上から順に評価**して最初にマッチしたものを採用する:

1. `throttle` — 最優先。インフラ異常として記録し、他分類を試す意味がない。
2. `auth` — 認証が切れている場合、他の分類の判定根拠（SP error code 等）が信頼できない。
3. `duplicate` — データ制約エラーは明確に識別可能。
4. `drift` — 列名の問題はスキーマレベル。
5. `unknown` — フォールバック。

> **Why this order:** 外側（インフラ・認証）ほど先に判定する。内側（データ・スキーマ）の判定は、外側が正常であることを前提にしないとノイズになる。

---

## 5. 判定ソース

### HTTP status
- `401, 403` → `auth`
- `429` → `throttle`
- `503` + `Retry-After` → `throttle`
- `400` → message/code による二次判定

### SharePoint error code (`odata.error.code`)
- `-2147024891` (Access denied) → `auth`
- `-2130575214` (duplicate unique value) → `duplicate`
- `Microsoft.SharePoint.SPException` で `FieldNotFound` → `drift`

### error message (substring 判定)
- 日本語: `一意な値`, `重複する値`, `この値を持つアイテムが存在`
- 英語: `duplicate value`, `unique value`, `already exists`
- drift: `does not exist on list`, `Column 'X'`, `Field not found`

### headers
- `Retry-After` が存在 → `throttle`（HTTP status が 200 系でない場合のみ）

---

## 6. API 案

```ts
// src/features/diagnostics/health/classifyCreateError.ts

export type CreateErrorReason =
  | 'auth'
  | 'duplicate'
  | 'drift'
  | 'throttle'
  | 'unknown';

export type ClassifiedCreateError = {
  reason: CreateErrorReason;
  /** summary 用の短い日本語フレーズ */
  summaryPhrase: string;
  /** 元のエラー本文（detail にそのまま埋める） */
  rawDetail: string;
  /** 判定に使ったシグナル（evidence に埋める） */
  matchedOn: ReadonlyArray<'status' | 'code' | 'message' | 'header'>;
  /** throttle のときのみ、推奨 retry 秒数 */
  retryAfterSeconds?: number;
};

export function classifyCreateError(err: unknown): ClassifiedCreateError;
```

### 入力の想定

`safe()` ヘルパーが拾う `err` の形は `Error | unknown`。`spClient` 由来のエラーは以下のいずれか:

- `Error` with `.message` = SP レスポンス本文（JSON 文字列を含むことが多い）
- `Error` with `.cause` = fetch Response 相当
- プリミティブ（文字列等） — fallback で `unknown` 扱い

実装では `err.message` の substring 判定と、可能なら `err.status` / `err.headers` の読み取りを行う。`spClient` のエラー形状は [src/lib/sp/](../../src/lib/sp/) 側の挙動に合わせて調整する。

---

## 7. UI 反映方針

### status

**分類によらず `fail` 固定**。理由:

- Create probe の失敗は、いずれの分類でも管理者の確認が必要。
- `throttle` を warn に降格する案もあるが、**連続 throttle は本番でのキャパ問題を示唆**するので fail のまま可視化する方が誤魔化しにならない。
- 例外: 将来 `isOptional` なリストの場合のみ、`duplicate` 以外を warn に落とす余地はある（本 PR では見送り）。

### summary テンプレ

| reason | summary |
|---|---|
| `auth` | `作成（Create）権限がありません。【要管理者対応】` |
| `duplicate` | `作成テストに失敗しました（原因: 既存データと重複）。` |
| `drift` | `作成テストに失敗しました（原因: 列名の不一致）。` |
| `throttle` | `作成テストに失敗しました（原因: スロットリング）。` |
| `unknown` | `作成テストに失敗しました（原因: 分類不能）。` |

### nextActions テンプレ

| reason | nextAction |
|---|---|
| `auth` | （現行維持）管理者に作成権限を付与するよう依頼する |
| `duplicate` | 管理者に確認: 前回の healthcheck アイテムが未クリーンアップの可能性 |
| `drift` | `provision-lists.mjs` の実行、または DRIFT_CANDIDATES_BY_KEY の更新を検討 |
| `throttle` | 数分待って再実行。連続する場合は SharePoint 管理者に API 使用量を確認 |
| `unknown` | `detail` の内容を確認し、必要なら issue を起票 |

### detail / evidence

- `detail`: 従来通り raw error 文字列
- `evidence.classification`: `{ reason, matchedOn, retryAfterSeconds? }` を追加

---

## 8. テスト戦略

### unit test (`classifyCreateError.spec.ts`)

分類ごとに代表 fixture を用意:

```ts
describe('classifyCreateError', () => {
  it.each([
    ['403 Access Denied', makeErr(403, 'Access denied'), 'auth'],
    ['-2147024891 code', makeErr(403, JSON.stringify({ 'odata.error': { code: '-2147024891' } })), 'auth'],
    ['JP duplicate', makeErr(400, 'リストの一意な値 [UserID] と重複'), 'duplicate'],
    ['EN duplicate', makeErr(400, 'duplicate value found'), 'duplicate'],
    ['field not found', makeErr(400, "Column 'FooBar' does not exist on list"), 'drift'],
    ['429 throttle', makeErr(429, 'Too many requests', { 'Retry-After': '30' }), 'throttle'],
    ['503 + Retry-After', makeErr(503, 'Service Unavailable', { 'Retry-After': '60' }), 'throttle'],
    ['random error', makeErr(500, 'Unexpected failure'), 'unknown'],
  ])('%s -> %s', (_, input, expected) => {
    expect(classifyCreateError(input).reason).toBe(expected);
  });
});
```

### 優先順位テスト

分類優先順位（4.1）の検証として、複数シグナルが同時にヒットする fixture を1〜2件用意:

- `429 + duplicate message` → `throttle` が勝つ
- `403 + duplicate message` → `auth` が勝つ

### 統合テスト

`runHealthChecks` に `sp.createItem` が特定エラーを返すモックを注入し、分類結果が summary / evidence に反映されることを確認（1 fixture のみで十分）。

---

## 9. 将来拡張

### 9.1 Update / Delete probe への横展開

`classifyCreateError` を `classifyCrudError` にリネーム、または共通化。Update/Delete 固有の理由（`notFound`, `conflict`）を追加する余地。

### 9.2 telemetry との整合

`evidence.classification.reason` を telemetry の reasonCode にそのまま流用する。既存の drift telemetry (`emitDriftRecord` at [checks.ts:11](../../src/features/diagnostics/health/checks.ts#L11)) と衝突しない分類名になっていることを担保する。

### 9.3 管理者向け集計ビュー

reason ごとの頻度を /admin/status サマリに表示し、「最近 `throttle` が増えている」「`drift` が恒常化している」などのトレンドを可視化する。

---

## 10. 実装タスク一覧

- [ ] `src/features/diagnostics/health/classifyCreateError.ts` 新規作成
- [ ] `classifyCreateError.spec.ts` 分類ごとの fixture + 優先順位テスト
- [ ] `checks.ts` の Create probe を分類結果で分岐（summary / nextActions / evidence）
- [ ] `summary` / `nextActions` テンプレを上記 7 に従って差し替え
- [ ] 統合テスト 1 件追加（governanceIntegration.spec もしくは新規 spec）

---

## 参考

- Memory: `feedback_health_check_no_false_fail.md` — false-fail 禁止の原則
- 前段 PR: [#1527](https://github.com/yasutakesougo/audit-management-system-mvp/pull/1527) — uniqueId のエントロピー強化
- 前段 PR: [#1532](https://github.com/yasutakesougo/audit-management-system-mvp/pull/1532) — uniqueId の run-scope 化
