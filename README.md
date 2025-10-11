# 運営指導・記録管理システム MVP (React + SharePoint SPA)

> 📌 クイックリンク: [プロビジョニング手順 / WhatIf レビュー](docs/provisioning.md#whatif-ドライラン-と-job-summary) ｜ [SharePoint スキーマ定義](provision/schema.xml) ｜ [プロジェクトボード自動連携](docs/project-auto-integration.md)

<!-- Badges -->
![Quality Gates](https://github.com/yasutakesougo/audit-management-system-mvp/actions/workflows/test.yml/badge.svg)
![Provision WhatIf](https://github.com/yasutakesougo/audit-management-system-mvp/actions/workflows/provision-sharepoint.yml/badge.svg)
![Lint](https://img.shields.io/badge/lint-pass-brightgreen)
![TypeCheck](https://img.shields.io/badge/types-pass-informational)
![Coverage Lines](https://img.shields.io/badge/coverage-70%25%2B-green)

> Quality Gate (Phase 3 Baseline): Lines >= 70% / Functions >= 70% / Statements >= 70% / Branches >= 65%  
> Current (local latest): Lines ~78% / Functions ~73% / Statements ~78% / Branches ~76% (headroom maintained before next phase)

本プロジェクトは、React, TypeScript, Vite, MUIを使用し、SharePoint OnlineをバックエンドとするSPAアプリケーションのMVP実装です。

## 開発時のよくある落とし穴
- `import.meta.env` を直接参照すると lint / pre-push の制御に阻まれるので、必ず `src/lib/env.ts` のヘルパー経由で値を取得する
- VS Code の Problems が急増したときは `src/lib/env.ts` や `.env` 差分をまず確認すると、型/エラーの原因を素早く特定できる

## Tech Stack
- React 18 + TypeScript + Vite
- MSAL (@azure/msal-browser, @azure/msal-react)
- SharePoint Online REST API
- LocalStorage (temporary audit log persistence)

## Key Features
- Azure AD (Entra ID) login and token acquisition
- SharePoint list access via a custom hook (`useSP`)
- Record listing & creation against a SharePoint list
- Local audit trail with CSV export
- Environment validation & helpful error messages for misconfiguration
- Schema-driven provisioning supports Text/Choice/DateTime/Number/Note/User/Lookup (additive choice policy, safe type migration)
- Manual MSAL sign-in/out control surfaced in the app header
- Users master smoke UI for create / rename / delete sanity checks

## Users Master Smoke Test
> 目的: SharePoint `Users_Master` リストとの CRUD 経路（hook → API → Audit ログ書き込み）を手動で検証するミニフローです。

1. `npm run dev` でアプリを起動し、MSAL サインインを完了させます。
2. 上部ナビの「利用者」タブ (`/users`) を開くと、`useUsers` が即時フェッチを行い `status` が `success` になるまで待機します。
3. フォームに `UserID` と `FullName` を入力し **Create** を押すとリストへ登録され、テーブルに即時反映されます。
4. 任意の行で **Rename\*** を押すと `FullName` の末尾に `*` を追加する更新が行われます（更新 API 経路の動作確認）。
5. **Delete** を押し確認ダイアログで `OK` すると SharePoint 側から削除され、テーブルとローカル状態から消えます。
6. ハッピーケース後は監査ログ (`/audit`) で該当アクションが記録されているかを確認し、必要なら CSV をエクスポートします。

補足:
- 上部の `status:` 表示は `useUsers` の内部状態のまま (`loading`/`success`/`error`) です。
- `Refresh` ボタンは競合試験や多端末検証の際に手動で再フェッチできます。
- 失敗時は `ErrorState` コンポーネントが SharePoint エラー本文をメッセージ化して表示します。

## Project Structure (excerpt)
```
src/
  auth/              MSAL config & hook
  lib/               Core helpers (SharePoint client, audit log)
  features/
    records/         Record list UI & migration from legacy API
    compliance-checklist/
    audit/           Audit panel with CSV export
  app/               Shell, routing, theming
  ui/components/     Reusable UI pieces
```

## Environment Variables (.env)
### Quick Setup
1. Copy example: `cp .env.example .env`
2. Choose either of the following configuration styles:
  - **Simple**: set both `VITE_SP_RESOURCE` and `VITE_SP_SITE_RELATIVE`
  - **Full URL**: set `VITE_SP_SITE_URL` (auto-derives the values above)
3. Edit the placeholders:
  - `<yourtenant>` → SharePoint tenant host (no protocol changes)
  - `<SiteName>`  → Target site path segment(s)
4. Provision MSAL SPA credentials: `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID`, optionally `VITE_MSAL_REDIRECT_URI` / `VITE_MSAL_AUTHORITY` / `VITE_MSAL_SCOPES`
5. Restart dev server (`npm run dev`).

> Override precedence: values passed directly to `ensureConfig` (e.g. in tests) always win. `VITE_SP_RESOURCE` / `VITE_SP_SITE_RELATIVE` from the env override `VITE_SP_SITE_URL`, and the full URL fallback is only used when both override values are omitted.

### Runtime overrides (production)
- `src/main.tsx` now hydrates `window.__ENV__` **before** the app mounts, merging runtime data with `import.meta.env` fallbacks.
- Provide runtime values via either of the following (executed before `main.tsx` runs):
  - Inline script: `<script>window.__ENV__ = { VITE_MSAL_CLIENT_ID: '...' };</script>`
  - JSON file: host `/env.runtime.json` (or set `window.__ENV__.RUNTIME_ENV_PATH` / `VITE_RUNTIME_ENV_PATH` to point elsewhere). Example:

```json
{
  "VITE_MSAL_CLIENT_ID": "00000000-0000-0000-0000-000000000000",
  "VITE_MSAL_TENANT_ID": "11111111-2222-3333-4444-555555555555",
  "VITE_SP_RESOURCE": "https://tenant.sharepoint.com"
}
```

- Keys supplied at runtime override build-time placeholders; missing keys fall back to the compiled `.env` values. Fetch failures are non-fatal (logged only in dev).

#### Testing with overrides
- Call config helpers with an override object instead of mutating `import.meta.env`.
- Example: `resolveSpCacheSettings({ VITE_SP_GET_SWR: '1', VITE_SP_GET_SWR_TTL_MS: '120000' })`.

```
VITE_MSAL_CLIENT_ID=<YOUR_APP_CLIENT_ID>
VITE_MSAL_TENANT_ID=<YOUR_TENANT_ID>
VITE_SP_RESOURCE=https://<yourtenant>.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<SiteName>
```

### Reading environment config

- **App/runtime code:** read configuration via `getAppConfig()` (exported from `src/lib/env.ts`).
  - 新しい環境変数を追加するときは、以下の順序で反映します。
    1. `src/lib/env.ts` の `AppConfig` 型と `getAppConfig()` のデフォルト値を更新する
    2. 補助リーダーが必要なら同ファイルに `read*` 系ヘルパーを追加する
    3. `.env.example` と README の表にプレースホルダー/説明を追記する
- **Config layer / adapters only:** low-level reads belong in `src/config/**` and should use the helpers exported from `env.ts`.
- **Never** call `import.meta.env` directly in feature or lib code—the linter and pre-push/CI guard will fail the build.

> **MSAL defaults:** The example `.env` ships wired to the “Audit SPA” registration
> (`clientId=619be9a1-ccc4-46b5-878b-ea921b4ce0ae`, tenant `650ea331-3451-4bd8-8b5d-b88cc49e6144`).
> Override these values if you point the app at a different Azure AD tenant or application.

### Rules / Validation Logic
| Key | Requirement | Auto-Normalization | Error If |
|-----|-------------|--------------------|----------|
| VITE_SP_RESOURCE | `https://*.sharepoint.com` / no trailing slash | Trailing slash trimmed | Not matching regex / placeholder present |
| VITE_SP_SITE_RELATIVE | Starts with `/`, no trailing slash | Adds leading `/`, trims trailing slashes | Placeholder present / empty |
| VITE_SP_SITE_URL *(optional)* | Full site URL | Splits into RESOURCE + SITE_RELATIVE | Missing scheme/host/path |
| VITE_SP_SITE *(optional)* | Full site URL alias | Splits into RESOURCE + SITE_RELATIVE | Missing scheme/host/path |
| VITE_SP_LIST_USERS_MASTER *(optional)* | List title override | Whitespace trimmed | Placeholder present / empty |
| VITE_MSAL_CLIENT_ID | Azure AD app (SPA) client ID | — | Placeholder / empty |
| VITE_MSAL_TENANT_ID | Azure AD tenant ID (GUID) | — | Placeholder / empty |
| VITE_MSAL_REDIRECT_URI *(optional)* | Redirect URI for SPA | Defaults to `window.location.origin` | Invalid URI |
| VITE_MSAL_AUTHORITY *(optional)* | Authority URL | Defaults to `https://login.microsoftonline.com/<tenant>` | Non-HTTPS / mismatched tenant |
| VITE_MSAL_SCOPES *(optional)* | Token scopes list (space/comma separated) | Defaults to `${VITE_SP_RESOURCE}/.default` | Empty / unsupported scope |
| VITE_GRAPH_SCOPES *(optional)* | Graph delegated scopes | — | useSP must support Graph path |

Placeholders recognized as invalid: `<yourtenant>`, `<SiteName>`, `__FILL_ME__`.

## スケジュール機能のフラグ

| 変数 | 例 | 意味 |
|---|---|---|
| `VITE_FEATURE_SCHEDULES` | `1` | `/schedule` ルートとナビゲーションを有効化 |
| `VITE_FEATURE_SCHEDULES_GRAPH` | `1` | スケジュールのデータ取得を **Demo** → **Microsoft Graph** に切替 |
| `VITE_SCHEDULES_TZ` | `Asia/Tokyo` | Graphから取得したイベントの表示タイムゾーン（任意） |
| `VITE_SCHEDULES_WEEK_START` | `1` | 週の起点（0=Sun ... 6=Sat、規定は月曜=1） |

> 実行時は `src/config/featureFlags.ts` と `env.ts` の `getAppConfig()` 経由で評価されます。

### ローカルでの有効化例

```bash
VITE_FEATURE_SCHEDULES=1 \
VITE_FEATURE_SCHEDULES_GRAPH=1 \
npm run dev
```

### Playwright での強制有効化（CI/E2E）

E2E は `localStorage["feature:schedules"]="1"` を事前注入してルートを開通します（環境変数未設定でもOK）。

### Debugging Misconfiguration
If misconfigured, `ensureConfig` (in `src/lib/spClient.ts`) throws with a multi-line guidance message and the error boundary (`ConfigErrorBoundary`) renders a remediation panel.

To confirm loaded values during development:
```ts
if (import.meta.env.DEV) {
  console.log('[ENV]', import.meta.env.VITE_SP_RESOURCE, import.meta.env.VITE_SP_SITE_RELATIVE);
}
```

### Common Pitfalls & Fixes
| Symptom | Cause | Fix |
|---------|-------|-----|
| "SharePoint 接続設定が未完了です" | Placeholders still present | Replace `<yourtenant>` / `<SiteName>` with real values |
| 401 after sign-in | Permissions not admin-consented | Grant admin consent to SharePoint delegated permissions |
| 404 `_api/web` | Wrong site relative path | Double-check `/sites/<SiteName>` casing & existence |
| `VITE_SP_RESOURCE の形式が不正` | Added trailing slash or missing host | Remove trailing `/`, ensure `https://tenant.sharepoint.com` |
| `VITE_SP_SITE_URL の形式が不正` | Missing path or non-SharePoint host | Use full URL like `https://tenant.sharepoint.com/sites/Example` |
| `AcquireTokenSilent` scope warnings | Graph scopes configured but useSP still targets REST | Remove `VITE_GRAPH_SCOPES` or update implementation |

### Cache & Concurrency Knobs
- `VITE_SP_GET_SWR` — Enable stale-while-revalidate + ETag reuse (`0` = off, `1` = opt-in).
- `VITE_SP_GET_SWR_TTL_MS` — Hard TTL for cached GET responses (ms). Overrides legacy `VITE_SP_GET_TTL_MS` / `VITE_SP_GET_CACHE_TTL` when present.
- `VITE_SP_GET_SWR_WINDOW_MS` — Additional SWR window (ms) after TTL expires before treating entries as cold misses.
- `VITE_SP_GET_TTL_MS` — Legacy TTL alias (still read for backward compatibility when SWR-specific envs are omitted).
- `VITE_SP_GET_CACHE_MAX_ENTRIES` — Max cached GET entries before LRU eviction (default 200).
- `VITE_SP_MAX_CONCURRENCY` — Max simultaneous SharePoint requests (default 6).
- `VITE_SP_NETWORK_RETRIES` — Network-layer retry attempts for transport failures (default 3).
- `VITE_SP_RETRY_MAX`, `VITE_SP_RETRY_BASE_MS`, `VITE_SP_RETRY_MAX_DELAY_MS` — 429/503/504 backoff tuning knobs shared by GET and $batch flows.

## タイムゾーン方針（Schedules）

**原則:** `YYYY-MM-DD` の文字列を基軸に「壁時計（ローカル 00:00 / 23:59:59.999）」を IANA タイムゾーンで UTC Instant へ確定させます。フローは **日付文字列 → 壁時計 in TZ → UTC** の順に統一しています。

**禁止事項:** `Date#setHours` など、ローカルタイムゾーンに依存する丸めは使用しません。DST・地域差で破綻するため、常に文字列 → `zonedTimeToUtc`（`date-fns-tz` では `fromZonedTime`）の経路を用いて確定します。

**設定:**
- `VITE_SCHEDULES_TZ` — 表示タイムゾーン。未設定または不正な場合は `Intl.DateTimeFormat().resolvedOptions().timeZone`、それも不可なら `Asia/Tokyo` へフォールバックします（警告ログ付き）。
- `VITE_SCHEDULES_WEEK_START` — 週の開始曜日（0=日曜〜6=土曜）。デフォルトは 1（=月曜）。

**テスト:** `tests/unit/schedule` 配下で JST / DST 地域の月末・年末・閏日・夏時間切替をカバーし、CI preflight で常時実行されます。

テストでタイムゾーンを固定する場合は `tests/unit/schedule/helpers/loadDateutils.ts` の `loadDateutilsWithTz()` を利用し、返される `restore()` を各テスト後に呼び出して `Intl.DateTimeFormat` / `import.meta.env` の差し替え状態を元に戻してください。

### Timezone Guard Rails
- `npm run guard:tz` で `setHours` / `setUTCHours` / `toLocaleString` を全検索し、`/utils/` および既存の `src/features/schedule/**` / `src/features/schedules/**` を除くモジュールでの利用を禁止しています（段階的移行のため暫定許可）。CI では `RG_REQUIRED=1 npm run guard:tz` が必須で、ripgrep 未インストール時は失敗します。
- pre-commit フックが同じチェックを実行するため、コミット前に必ずガードが走ります。
- UI 層などで例外的に許可する場合は直前 3 行以内に `// SCHEDULES-TZ-ALLOW: reason=...` を残し、レビュアが理由を確認できるようにしてください。
- 例外タグの使用例:

```ts
// SCHEDULES-TZ-ALLOW: reason=justified_display (human-readable, non-calculation)
const displayLabel = formatInTimeZone(event.start, displayTz, 'yyyy-MM-dd HH:mm');
```
- 既存の許可済み Date 演算は `src/features/**/utils/` または `src/lib/date/**` に集約し、ヘルパー経由で利用します。

### Stale-While-Revalidate & Scoped Bust (opt-in)
- Flip `VITE_SP_GET_SWR=1` to opt into background refresh with SharePoint ETag reuse. Hard TTL is controlled by `VITE_SP_GET_SWR_TTL_MS`; the additional grace window comes from `VITE_SP_GET_SWR_WINDOW_MS`.
- Fresh hits (<= TTL) return immediately from cache. Between TTL and TTL + SWR window, cached data is returned instantly while a single background refresh revalidates the entry. Beyond that window the entry is treated as cold and a network fetch occurs.
- When SharePoint responds `304 Not Modified`, the client resets the TTL without touching the JSON payload. New `If-None-Match` headers are attached automatically whenever a cached ETag exists.
- `getListItemsByTitle(..., { bypassCache: true })` or a manual `x-sp-bypass-cache: 1` header skips both cache usage and ETag headers for one-off debugging.
- Mutations and `$batch` calls invalidate only the affected cache keys using tags such as `list:Records` / `list:Records:item:42`. If parsing a batch payload fails to detect targets, the client falls back to a global bust.

### Optional Flags
```
# Verbose debug for audit & SharePoint client
VITE_AUDIT_DEBUG=1

# Retry tuning (keep defaults unless diagnosing throttling)
VITE_SP_RETRY_MAX=4
VITE_SP_RETRY_BASE_MS=400
VITE_SP_RETRY_MAX_DELAY_MS=5000
```

### Dev Tips
- After changing auth settings (MSAL config, scopes, or cookie policy), clear site cookies once to flush stale MSAL state.
- Inspect cache stats in DevTools via `window.__SP_DBG__()` — it now reports `{ size, hits, cacheHits, staleHits, swrRefreshes, _304s, lruKeysSample }`. Individual counters (`window.__SP_GET_HITS__`, `__SP_GET_CACHE_HITS__`, `__SP_GET_STALE_HITS__`, `__SP_GET_SWR_REFRESHES__`, `__SP_GET_304s__`) remain available for quick console pokes.

### Bypass cache (for debugging)
- Add header `x-sp-bypass-cache: 1` on a GET to force a network fetch.
- Or pass `opt: { bypassCache: true }` to `getListItemsByTitle` if you opt into the helper flag (suppresses both cache usage and automatic `If-None-Match`).

> Security: Never put client secrets in `.env` (frontend). Only `VITE_` prefixed public config belongs here.

## Security

#### Cookie policy helper

Use `cookiePolicy({ crossSite })` to derive **SameSite** and **Secure** automatically.

- Cross-site cookies in production → `SameSite=None; Secure` (required by modern browsers).
- Local dev without HTTPS → falls back to `SameSite=Lax` (avoids Secure-on-HTTP breakage).
- After switching dev to HTTPS, **clear cookies** to remove stale warnings.

Utilities:
- `buildSetCookie(name, value, options)` → single `Set-Cookie` string.
- `buildCookieBundle(base, items)` → several cookies at once.
- `appendSetCookies(headers, cookies)` → append multiple cookies (Edge-friendly).

Types:
- Reuse `SameSite` union (`'none' | 'lax' | 'strict'`) across frameworks (Express/Next/Hono).
- Pair this helper with your CSP / CSRF strategy—MDN’s [`Set-Cookie` security guide](https://developer.mozilla.org/docs/Web/HTTP/Cookies#security) has an excellent checklist for hardening those headers.
- Set `COOKIE_DEV_WARN=1` in your dev shell to fire `onDevFallbackWarn` whenever a cross-site cookie request falls back to `SameSite=Lax; Secure=false` locally (helps catch stray prod-only expectations).
- Need to bridge framework APIs? Use dedicated adapters like `src/lib/http/edgeAdapter.ts` / `nodeAdapter.ts` (ESLint is configured to allow them). For rare exceptions, add a one-line disable with a justification: `// eslint-disable-next-line no-restricted-properties -- OAuth redirect cookie from framework hook`.
- Local commits run `npm run lint`, `npm run typecheck`, `npm run lint:cookies`, and `lint-staged` automatically via Husky’s pre-commit hook—only use the documented ESLint disable for adapters when absolutely necessary.

## Audit Metrics (Testing Contract)
`AuditPanel` exposes a stable, test-focused metrics container after executing a batch sync.

Selector:
```
[data-testid="audit-metrics"]
```

Exposed data attributes (stringified numbers):
| Attribute | Meaning |
|-----------|---------|
| `data-new` | Newly inserted items (success - duplicates) |
| `data-duplicates` | Duplicate (409) item count (idempotent successes) |
| `data-failed` | Failed (non-2xx except 409) items remaining after last attempt |
| `data-success` | Successful count including duplicates |
| `data-total` | Total items attempted in last batch |

Each pill also has `data-metric` = `new` / `duplicates` / `failed` in stable order for ordering assertions.

### Example (Playwright)
```ts
const metrics = page.getByTestId('audit-metrics');
await expect(metrics).toHaveAttribute('data-total', '6');
await expect(metrics).toHaveAttribute('data-success', '5');
await expect(metrics).toHaveAttribute('data-duplicates', '2');
await expect(metrics).toHaveAttribute('data-new', '3');
await expect(metrics).toHaveAttribute('data-failed', '1');
const order = await metrics.locator('[data-metric]').evaluateAll(ns => ns.map(n => n.getAttribute('data-metric')));
expect(order).toEqual(['new','duplicates','failed']);
```

Rationale: Avoid brittle regex on localized labels (新規/重複/失敗) and ensure i18n or stylistic changes don't break tests.

> i18n Note: Metric pill labels are centralized in `src/features/audit/labels.ts` for future localization. Only data-* attributes are used by tests, so translating the labels will not break assertions.

### Helper Utility (Optional)
`tests/e2e/utils/metrics.ts` provides `readAuditMetrics(page)` and `expectConsistent(snapshot)`:
```ts
import { readAuditMetrics, expectConsistent } from '../utils/metrics';

test('batch metrics math', async ({ page }) => {
  await page.goto('/audit');
  // ... seed logs & trigger batch ...
  const snap = await readAuditMetrics(page);
  expectConsistent(snap); // validates newItems === success - duplicates
  expect(snap.order).toEqual(['new','duplicates','failed']);
});
```

## Authentication Flow
1. MSAL instance configured in `src/auth/msalConfig.ts`
2. `src/lib/msal.ts` boots a shared `PublicClientApplication` instance and initialization
3. App root is wrapped by `MsalProvider` in `src/main.tsx`, and the header shows a `Sign in` / `Sign out` control (`src/ui/components/SignInButton.tsx`)
4. `useAuth()` hook exposes `acquireToken()` which obtains an access token for SharePoint using configured scopes (defaults to `${VITE_SP_RESOURCE}/.default`).
5. Token stored transiently (sessionStorage) to bridge legacy calls during migration.

> ヒント: 自動ログインが無い環境では、右上の「サインイン」ボタンから `loginPopup` を実行できます。既存セッションがある場合は起動時に `ssoSilent` が働き、自動復元されます。

## SharePoint Access: `useSP`
Located in `src/lib/spClient.ts`.

### Responsibilities
- Validate environment & normalize base SharePoint URL
- Provide `spFetch` (authenticated REST calls with retry on 401) 
- Provide convenience helpers:
  - `getListItemsByTitle(title, odataQuery?)`
  - `addListItemByTitle(title, payload)`

### Usage Example
```tsx
import { useSP } from '../lib/spClient';

function Example() {
  const { getListItemsByTitle, addListItemByTitle } = useSP();

  useEffect(() => {
    getListItemsByTitle('Records').then(items => console.log(items));
  }, []);

  const add = () => addListItemByTitle('Records', { Title: 'New Item' });

  return <button onClick={add}>Add</button>;
}
```

### Error Handling
- Misconfigured env throws early, describing what to fix.
- 401 responses trigger a silent re-acquire of token (once) before failing.
- Errors bubble with contextual JSON snippet (truncated) for easier debugging.

### 運用メモ（Choice フィールドの変更ポリシー）

- `choicesPolicy` は 既定 `additive`：不足選択肢のみ追加し、既存は削除しません。
  - Summary 出力例: `+ Add choices ...`, `! Keep existing (not removing) ...`
- `replace` は将来拡張用で、現バージョンでは警告ログを出し `additive` と同じ動作です。
- 選択肢削除が必要な場合は、ユーザー影響とデータ整合性を精査し、移行計画（新列 *_v2 作成など）を検討してください。

## Migration Notes
Legacy helper `spRequest` and old `records/api.ts` have been removed / deprecated.
Use `useSP()` directly in components or create thin feature-specific wrappers if needed.

## Development
Install dependencies and start dev server (port 3000):
```
npm install
npm run dev

### Test & Coverage

### Strategy
- **Unit (厚め)**: 同期ロジック、リトライ、バッチパーサ、CSV 生成などの純粋ロジックは **Vitest** で網羅。UI 断面も **React Testing Library (jsdom)** でコンポーネント単位を検証。  
- **E2E (最小)**: **Playwright** は「失敗のみ再送」「429/503 リトライ」など **重要シナリオの最小数** に絞り、ページ全体のフレーク回避と実行時間を抑制。
- **カバレッジ・ゲート**: Phase 3 固定（Lines/Funcs/Stmts **70%** / Branches **65%**）。  
  ロジックの追加時はユニットテストを先に整備して緑化→E2E 追加は必要最小に留めます。
- Vitest suites that touch `ensureConfig` reset `import.meta.env` per test to avoid leaking real tenant URLs into assertions; keep this pattern when adding new cases.

現在の固定品質ゲート (Phase 3 固定化):
```
Lines >= 70%, Statements >= 70%, Functions >= 70%, Branches >= 65%
```
`vitest.config.ts` の `thresholds` を将来引き上げる際は、CI 3 連続グリーン後に 5–10pt 程度ずつ。急激な引き上げは避けてください。

### Coverage Roadmap (Historical / Plan)
現在: Phase 3 (安定運用ベースライン達成)

| Phase | 目標 (Lines/Fn/Stmts \| Branches) | 達成基準 | 主なアクション | 想定タイミング |
|-------|------------------------------------|-----------|----------------|----------------|
| 0 | 20/20/20 \| 10 (導入) | スモーク + 主要ユーティリティ | 初期テスト整備 | 達成済 ✅ |
| 1 | 40/40/40 \| 20 (現状) | 回帰テスト安定 (直近失敗なし) | バッチパーサ / リトライ / UUID フォールバック | 達成済 ✅ |
| 2 | 60/60/60 \| 40 | クリティカルパス (認証, spClient, 監査同期) Happy/エラー系網羅 | useSP リトライ分岐 / 409 重複成功扱い / 部分失敗再送 | 次期 |
| 3 | 70/70/70 \| 65 (固定現状) | UI ロジック分離・Hooks 単体化 | `useAuditSyncBatch` 分岐別テスト | 達成済 ✅ |
| 4 | 80/80/80 \| 65 | 主要分岐ほぼ網羅 (表示のみ除外) | jsdom コンポーネントテスト導入 (ピンポイント) | 中期 |
| 5 | 85+/85+/85+ \| 70+ | コスト/リターン再評価 | Snapshot 最適化 / Flaky 監視 | 後期 |

運用ポリシー (固定化後):
- 閾値は Phase 3 値を維持。新規機能は同等以上のカバレッジを伴って追加。
- Flaky 発生時は引き上げ計画を一旦停止し要因除去 (jitter/タイマー/ランダム化の deterministic 化)。

ローカル詳細メトリクス確認:
```
npm run test:coverage -- --reporter=text
```
CI では text / lcov / json-summary を生成。将来的にバッジ or PR コメント自動化を計画。

### Utility: `safeRandomUUID`
依存注入オプション付き UUID 生成ヘルパ。優先順: (1) 注入実装 (2) `crypto.randomUUID` (3) `crypto.getRandomValues` v4 生成 (4) `Math.random` フォールバック。

```ts
import { safeRandomUUID } from '@/lib/uuid';

// 通常利用
const id = safeRandomUUID();

// テストや特殊用途で固定値を注入
const predictable = safeRandomUUID({ randomUUID: () => 'fixed-uuid-1234' });
```

> 注入によりグローバル `crypto` を差し替えずテストを安定化。

```

### Quality Gates (Local)
以下をローカルで実行することで、CI と同じ早期フィードバックを得られます:
```
npm run typecheck   # 型不整合の検出
npm run lint        # コードスタイル/潜在バグ検出 (ESLint + @typescript-eslint)
npm run test        # ユニットテスト (最小)
npm run test:coverage  # カバレッジ付き
```
推奨フロー: 変更後すぐ `typecheck` / `lint`、安定したら `test:coverage`。PR 前にすべて PASS を確認してください。

### Mini Runbook (運用即参照)
| 項目 | チェック | メモ |
|------|---------|------|
| Entra App 権限 | Sites.Selected or Sites.ReadWrite.All 同意済 | `API permissions` 画面で Admin consent granted 状態 |
| Redirect URI | `http://localhost:3000` / 本番 URL | SPA (Single-page application) で追加 |
| .env 置換 | `<yourtenant>` / `<SiteName>` が実値化 | `ensureConfig` が placeholder を検出すると起動失敗 |
| SharePoint Lists | `provision-sharepoint.yml` WhatIf → Apply | WhatIf 差分を必ず PR でレビュー |
| Provision schema | `provision/schema.xml` | WhatIf/Apply の両ワークフローが共通参照。古い `schema.json` は使用しません |
| Top Navigation (手動 Apply) | `addTopNavigation` チェックボックス | デフォルト OFF。手動実行で ON にすると Quick/Nav 両方へリンク追加 |
| `changes.json` telemetry | `summary.total` / `summary.byKind[]` | Apply/WhatIf 共通で生成。監査証跡として保存・添付 |
| インデックス | `Audit_Events(entry_hash)` / `Audit_Events(ts)` | 大量化前に作成 (5k item threshold 回避) |
| Backfill entry_hash | 既存行に空がない | PowerShell スクリプト或いは アクション backfill=true |
| Token エラー | 401/403 時 MSAL Silent Refresh 成功 | 発生頻度 > 数/日なら権限再確認 |
| Batch Fallback | parserFallbackCount が 0 | >0 継続ならレスポンス破損調査 |

### 迅速トリアージ手順
1. 500 / 503 増加 → サーバ側ヘルス (SPO 側障害) を MS サービス正常性で確認
2. 429 増加 → バッチサイズ・ユーザー同時操作確認、必要なら `VITE_SP_RETRY_BASE_MS` 引き上げ
3. 409 増加傾向 → 重複 (期待挙動) なので異常ではないが、新規率低下をモニタリング
4. parserFallbackCount > 0 → ネットワーク系 (途中切断) や O365 側一時的フォーマット崩れを疑う

### E2E Tests (Playwright)
初期スモークとして Playwright を導入しています。
```
npm run test:e2e
```
`tests/e2e/audit-basic.spec.ts` がアプリシェルと監査ログ表示の最低限を確認します。拡張する場合は同ディレクトリに追加してください。

### 監査ログフィルタ (Action)
`監査ログ` パネル上部に Action ドロップダウンを追加。`ALL` / 個別アクションでテーブルが絞り込み表示されます。

### デバッグログ制御
`.env` に `VITE_AUDIT_DEBUG=1` を設定すると、バッチ同期内部の以下情報が出力されます。
- リトライ試行 (`[audit:retry]`)
- チャンク解析結果 (`[audit:chunk]`)
- フェータルエラー (`[audit:fatal]`)
OFF 時は `debug` レベルのみ抑制し、warn/error は常に出力されます。

### 部分失敗 / 再送フロー
1回の同期（バッチ）で insert した結果を Content-ID 単位で判定し、失敗したアイテムだけローカルバッファに残します。

UI 指標例:
```
New: 10  Duplicate: 3  Failed: 2  Duration: 420ms
Categories: { throttle:1, server:1 }
```

- New: 新規 201
- Duplicate: 409 （entry_hash の一意制約衝突だが成功扱い）
- Failed: リトライ後も成功しなかったアイテム数
- Duration: バッチ要求～解析完了までの経過時間
- Categories: 失敗を HTTP ステータスグループで集計（server/auth/throttle/bad_request/not_found/other）

再送ボタン（例: 「失敗のみ再送」）を押すと Failed > 0 のものだけ再バッチ化します。全件成功した場合はローカル保持をクリアします。

### E2E 部分失敗シナリオ
`tests/e2e/audit-partial-failure.spec.ts` で $batch をモックし、部分成功 + duplicate + 再送成功パターンを検証しています。

### トークン Soft Refresh
MSAL のキャッシュされたアクセストークン有効期限が閾値（`VITE_MSAL_TOKEN_REFRESH_MIN` 秒、既定 300）未満になると `forceRefresh: true` で再取得します。

メトリクス (debug 有効時 `window.__TOKEN_METRICS__`):
```
{
  acquireCount: <acquireTokenSilent 総呼出回数>,
  refreshCount: <soft refresh 実行回数>,
  lastRefreshEpoch: <最後の refresh UNIX 秒>
}
```
`VITE_AUDIT_DEBUG=1` のとき `spClient` 側で snapshot を `[spClient] token metrics snapshot` として出力します。

### entry_hash Backfill (既存データ補完)
目的: 過去に挿入済みの `Audit_Events` アイテムで `entry_hash` が空のものへ後付与し、以降の重複判定を完全化。

手順 (GitHub Actions 連携後):
1. ワークフロー `Provision SharePoint Lists` を手動実行時に `backfillEntryHash=true` を指定
2. `whatIf=true` でドライラン可（更新件数は 0 / Needed 件数のみ表示）
3. 成功後、今後の同期で 409 重複が“成功扱い”に収束し取りこぼしゼロへ

ローカル / 手動実行例 (接続後):
```
pwsh -File ./scripts/backfill-entry-hash.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Audit -WhatIfMode
pwsh -File ./scripts/backfill-entry-hash.ps1 -SiteUrl https://contoso.sharepoint.com/sites/Audit
```
オプション:
- `-BatchSize`: まとめて更新する件数 (既定 50)
- `-WhatIfMode`: 書き込み抑止

内部ロジック:
- フロントエンドと同じ canonical JSON (Title, Action, User, Timestamp, Details) を SHA-256
- 空または未設定の行のみ対象

### スロットリング / 再試行 (429/503/504)
SharePoint から 429 (Throttle) / 503 / 504 が返った場合は指数バックオフ + full jitter で自動再試行します。`Retry-After` ヘッダが存在する場合はそれを最優先で待機します。

環境変数 (既定値):
```
VITE_SP_RETRY_MAX=4              # 最大試行回数 (初回+再試行含む)
VITE_SP_RETRY_BASE_MS=400        # バックオフ基準 ms (指数 2^(attempt-1))
VITE_SP_RETRY_MAX_DELAY_MS=5000  # 1 回あたり待機時間上限
```
アルゴリズム:
1. 応答が 429/503/504 → attempt < max なら待機
2. 待機時間: Retry-After (秒 or 日付) 優先 / 無ければ `rand(0..min(cap, base*2^(attempt-1)))`
3. 401/403 は別経路 (トークン再取得) を先に実施
4. すべて失敗で最終レスポンス内容を含むエラー throw

デバッグ例 (`VITE_AUDIT_DEBUG=1`):
```
[spClient] retrying { status: 429, attempt: 2, waitMs: 317 }
```

## CSV Export (Audit Panel)
Found in `src/features/audit/AuditPanel.tsx` – quoting & escaping ensures RFC4180-compatible output for Excel.

## Audit Log $batch 同期 & Idempotency (部分成功集計 / 重複防止対応)

大量（数百件以上）の監査ログを逐次 REST POST すると往復回数が増え遅延します。`src/features/audit/useAuditSyncBatch.ts` は SharePoint REST の `$batch` を用いて **最大100件/チャンク（既定）** で一括挿入する実験的フックです。

環境変数 `VITE_AUDIT_BATCH_SIZE` を設定すると 1〜500 の範囲でチャンクサイズを調整できます（範囲外はクランプ・不正値は既定 100）。

### 使い方
- 監査ログパネルに「SPOへ一括同期($batch)」ボタンが追加されています。
- 同期後は `一括同期完了: 成功件数/総件数` を表示します。部分失敗がある場合、失敗件数は UI メッセージ（将来拡張）かコンソールのデバッグログで確認できます。

### 制限 / 今後の改善予定
| 項目 | 現状 | 改善案 |
|------|------|--------|
| 部分失敗解析 | 対応（Content-ID 単位で success/failed 集計） | エラー詳細の UI 表示 / リトライ対象抽出 |
| リトライ | なし | 429/503/一時エラーで指数バックオフ |
| チャンクサイズ調整 | 固定 100 | `.env` (`VITE_AUDIT_BATCH_SIZE`) で可変化 |
| ローカルログ削除 | 全件成功時に自動クリア済み | 失敗分のみ保持 / リトライキュー分離 |

### 実装概要
1. ローカル監査ログを DTO に変換
2. 100件単位に分割
3. `multipart/mixed` ($batch + changeset) 形式の本文を生成（各リクエストに `Content-ID` 付与）
4. `POST https://{tenant}.sharepoint.com/sites/.../_api/$batch`
5. レスポンス multipart を解析し、`Content-ID` ごとの HTTP ステータスから成功/失敗件数算出（全件成功時はローカル監査ログを自動クリア）

現在は最小限パーサ（HTTP/1.1 行 + Content-ID 抽出）で成功/失敗をカウント。レスポンス JSON の個別本文まではまだマッピングしていません（必要になれば拡張可能）。

> 注意: `$batch` は 1 リクエストあたりの総ペイロードサイズ上限（~数 MB）や changeset 内の操作件数制限に留意してください。現状 100件は保守的な値です。

### Idempotency (重複防止) 実装済み: `entry_hash`

監査イベントの再送 / リトライ / 二重操作などによる重複挿入を防ぐため、`Audit_Events` リストに **一意制約付き Text 列 `entry_hash`** を追加し、同期時に計算しています。

実装ポイント:
1. ハッシュ入力要素 (冪等性サーフェス): `ts, actor, action, entity, entity_id, after_json` を canonical JSON 化
2. `src/lib/hashUtil.ts` で: key ソート + cycle safe + SHA-256 → 64 hex をそのまま利用（列長 128 を確保）
3. 逐次同期 (`useAuditSync`) とバッチ同期 (`useAuditSyncBatch`) の両方で DTO に `entry_hash` 付与
4. SharePoint で一意制約違反（重複）を検出した場合は **成功扱い**（既に登録済み）としてカウントするロジックを実装（逐次同期で例外文言を判定 / バッチは現状 HTTP ステータス単位集計。将来的に 409 パターンを個別 success 扱いへ拡張予定）
5. 全件 (真の成功 + 重複成功) の合計が送信総数と一致した場合にローカル監査ログをクリア

メリット:
- 再送やネットワーク再試行時に二重行生成を抑止
- ローカルログのクリア条件が「DB に非重複で存在している」で安定

留意点:
- ハッシュ衝突は極低確率 (SHA-256) のため実用上問題なしと判断
- `before_json` は冪等性キーに含めていない（差分表示用であり、後続更新による変動要素になる可能性があるため）。要件で必要なら basis に追加してください。
- 今後、バッチレスポンスの個別本文解析を拡張し、重複を success に再分類する改善余地あり。

移行（既存データへ後付け）が必要になった場合は、PowerShell / CSOM スクリプトで空の `entry_hash` を順次計算埋め込みすることも可能です（まだスクリプトは同梱していません）。

### バッチ同期のリトライ & 重複/部分失敗ハンドリング

スモールスケール（利用者 ~30 名 / 職員 ~15 名）を想定し、シンプルかつ安全な実装ポリシー:

| 項目 | 実装 | 備考 |
|------|------|------|
| トランジェントリトライ | 429 / 503 / 504 / ネットワーク例外を指数バックオフ (最大3回) | バックオフ: 200ms * 2^n + jitter |
| リトライ設定可変 | `VITE_AUDIT_RETRY_MAX`, `VITE_AUDIT_RETRY_BASE` | 最大回数(<=5), 基本ms (既定 3 / 200ms) |
| 失敗のみ再送 | UI ボタン "失敗のみ再送" | 部分失敗後に残存した失敗行だけ再送 |
| エラー分類表示 | auth / throttle / server / bad_request / not_found / other | バッチ結果下に簡易内訳表示 |
| 所要時間計測 | durationMs | 処理 ms をメトリクス & メッセージに表示 |
| 重複 (409) | 成功扱い (duplicates カウント) | Idempotent なので再送不要 |
| 部分失敗保持 | 成功済みを除去し失敗分のみローカル再保持 | Content-ID から元インデックスを逆引きし正確に失敗行のみ保持 |
| ログクリア | 全件 (成功+重複) カバー時のみ完全クリア | データ消失リスク回避 |
| UI 表示 | `成功/総数 (重複 X 失敗 Y)` 形式 | 重複増加を可視化 |

将来拡張余地:
- 失敗の中からトランジェント以外 (400系) を明示ラベル化
- Content-ID とローカルインデックスの追跡で “本当に失敗した行” のみ精密保持
- リトライ回数/バックオフポリシーを `.env` で可変化
- 解析カテゴリ (auth / throttle / server) 別の件数を UI 表示

### 開発用メトリクス
`window.__AUDIT_BATCH_METRICS__` (DEV) に以下をエクスポート:
```jsonc
{
  "total": 42,
  "success": 40,
  "duplicates": 5,
  "newItems": 35,
  "failed": 2,
  "retryMax": 3,
  "timestamp": "2025-09-23T09:00:00.000Z",
  "categories": { "bad_request": 1, "server": 1 }
}
```

### 失敗のみ再送の動作
1. 部分失敗時、Content-ID から元インデックスを特定し失敗行のみローカル保持。
2. 「失敗のみ再送」ボタンで残存分を再バッチ送信。
3. 全件成功（重複含む）でローカル監査ログをクリア。



## 受け入れ基準確認

  - [x] `npm run dev` 起動 → サインインできる。
  - [x] 「日次記録」で SharePoint から一覧取得できる。
  - [x] Title を入力して「追加」→ 正常終了後、一覧に追加される（read-backによる整合性確保）。
  - [x] ヘッダーの履歴アイコンから監査ログを開き、「CREATE_SUCCESS」ログが記録されていることを確認できる。
  - [x] 主要ボタンが 44px 以上あり、Tab 移動でフォーカス可視。
  - [x] プロジェクトが指定ディレクトリ構成で生成されている。

---

## SharePoint リストの自動プロビジョニング

本プロジェクトは **GitHub Actions + PnP.PowerShell** を用いて、PnP Provisioning Template (`provision/schema.xml`) から SharePoint リストをプロビジョニングします。  
**WhatIf（ドライラン）**に対応し、**Job Summary** に差分と現況スナップショットを出力します。JSON スキーマはレガシー互換用としてのみ残しています。

### 仕組みの概要

- ワークフロー: `.github/workflows/provision-sharepoint.yml`
- スクリプト: `scripts/provision-spo.ps1`
- スキーマ: `provision/schema.xml`（PnP Provisioning Template）

> 認証は **アプリケーション権限**（Entra ID アプリ＋証明書 or クライアントシークレット）を想定。  
> SharePoint の **Sites.FullControl.All** 等、必要権限に管理者同意が必要です。

---

### GitHub Secrets（必須）

| Secret 名             | 説明例                                           |
|-----------------------|--------------------------------------------------|
| `AAD_TENANT_ID`       | `650ea331-3451-4bd8-8b5d-b88cc49e6144`          |
| `AAD_APP_ID`          | `0d704aa1-d263-4e76-afac-f96d92dce620`          |
| `SPO_RESOURCE`        | `https://<tenant>.sharepoint.com`               |
| `SPO_CERT_BASE64`     | （証明書認証を使う場合）PFX の Base64 文字列     |
| `SPO_CERT_PASSWORD`   | （証明書認証を使う場合）PFX パスワード           |
| `SPO_CLIENT_SECRET`   | （クライアントシークレット認証を使う場合のみ）   |

> 証明書とクライアントシークレットは **どちらか一方**を設定。

---

### ワークフロー入力

Actions →「Provision SharePoint Lists」→ **Run workflow** で以下を指定します。

| 入力名             | 既定値                 | 説明                                                                                      |
|--------------------|------------------------|-------------------------------------------------------------------------------------------|
| `siteRelativeUrl`  | `/sites/welfare`       | 対象サイトの相対パス                                                                       |
| `schemaPath`       | `provision/schema.xml` | スキーマのパス（省略時は XML。`.json` も互換サポート）                                      |
| `whatIf`           | `true`                 | **ドライラン**（計画のみ、変更は加えない）                                                 |
| `applyFieldUpdates`| `true`                 | 型が一致している既存列に対して **表示名/説明/選択肢/必須/一意/最大長** を安全に更新        |
| `forceTypeReplace` | `false`                | 型不一致時に `*_v2` 列を新規作成し、**値をコピーして移行**（旧列は残す）                   |
| `recreateExisting` | `false`                | 既存リストを **削除→再作成**（破壊的。データ消失に注意）                                   |

---

### スキーマ（`provision/schema.xml`）の概要

- PnP Provisioning Template 形式でサイト構造とリストを定義します。
- JSON ベースのスキーマはレガシー互換用途として `provision/schema.json` に残していますが、最新の適用は XML を利用してください。
- 詳細なフィールド定義や移行ポリシーは [`docs/provisioning.md`](docs/provisioning.md) を参照。

```xml
<pnp:Provisioning xmlns:pnp="http://schemas.dev.office.com/PnP/2024/05/ProvisioningSchema">
  <pnp:Templates>
    <pnp:ProvisioningTemplate ID="AuditMvpSchema">
      <pnp:Lists>
        <pnp:ListInstance Title="SupportRecord_Daily" TemplateType="100" EnableVersioning="true">
          <pnp:Fields>
            <Field Type="DateTime" DisplayName="記録日" InternalName="cr013_recorddate" />
            <Field Type="Note" DisplayName="特記事項" InternalName="cr013_specialnote" />
          </pnp:Fields>
        </pnp:ListInstance>
        <!-- ... -->
      </pnp:Lists>
    </pnp:ProvisioningTemplate>
  </pnp:Templates>
</pnp:Provisioning>
```

> 補足: JSON スキーマを指定した場合もスクリプトは後方互換で処理しますが、XML と同等のメンテを行っていないため今後の更新は XML 前提でレビューしてください。

---

### WhatIf（ドライラン）と Job Summary

* `whatIf: true` で 計画のみを出力（変更なし）
* Summary 例（抜粋）:

```
List exists: SupportRecord_Daily
  - Add field: cr013_recorddate (DateTime)
  - Add field: cr013_specialnote (Note)
List exists: Audit_Events
  - Type mismatch: entity existing=Note desired=Text
    - Skipped type change (forceTypeReplace=false)
Existing fields snapshot: Audit_Events
  - Title (Type=Text, Req=False, Unique=False, Title='Title')
```

本実行（`whatIf: false`）では Created / Updated / Migration done などが出力されます。

---

### FAQ

| 質問 | 回答 |
|------|------|
| 既存リストを壊したくない | 既定 `recreateExisting=false`, `forceTypeReplace=false`, `applyFieldUpdates=true` を維持 |
| 型が違っていた | まず `whatIf: true` で確認 → 問題なければ `forceTypeReplace: true` で *_v2 移行 |
| 一意制約を付けたい | 重複データがあると失敗。事前に重複を排除 |
| 大量アイテム移行が遅い | 今後バッチ最適化予定。現状は逐次更新 |

---

### 依存・前提

| 項目 | 内容 |
|------|------|
| ランナー | ubuntu-latest |
| モジュール | PnP.PowerShell |
| 権限 | Entra アプリ (Sites.FullControl.All など) + 管理者同意 |

---

より詳細なガイドは `docs/provisioning.md` を参照してください。

## Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| URL parse / 400 errors | Placeholder env values | Update `.env` with real tenant/site values |
| 401 from SharePoint | Token expired / missing scope | Ensure `acquireToken` runs, user signed in, correct API permissions granted |
| Module not found '@/*' | Path alias not applied | Check `tsconfig.json` and `vite.config.ts` alignment |
| Type errors for 'path' or 'url' | Missing node types | Ensure `"types": ["vite/client", "node"]` in `tsconfig.json` |

> ローカルで PWA/Service Worker を試したことがある場合は、DevTools → Application → Service Workers で **Unregister** すると TLS エラーが消えるケースがあります。

## ローカル Vite HTTPS: ERR_SSL_VERSION_OR_CIPHER_MISMATCH 完全解決ガイド

TL;DR（最短復旧フロー）
1. https://localhost:3000 / https://127.0.0.1:3000 で開く
2. Chrome の HSTS を削除：[chrome://net-internals/#hsts](chrome://net-internals/#hsts) → Delete domain localhost → Delete → **ブラウザを完全終了（⌘Q）**（再読み込みでは復旧しない）
3. Service Worker とキャッシュ：DevTools → Network → “Disable cache”、Application → Service Workers → Unregister
4. プロキシ/セキュリティ製品をバイパス（localhost,127.0.0.1 を除外）
5. 証明書を mkcert で作成（プロジェクト直下）

macOS (Homebrew):

```bash
brew install mkcert nss && mkcert -install
```

Windows (PowerShell / Chocolatey):

```powershell
choco install mkcert -y
mkcert -install
```

> Windows で一時的に `npm run dev` を動かす際は、PowerShell で `$env:HTTPS = 1` を設定してから実行すると HTTPS が強制されます。

```bash
mkdir -p .certs
mkcert -key-file ./.certs/localhost-key.pem -cert-file ./.certs/localhost.pem localhost 127.0.0.1 ::1
```

6. Vite を HTTPS (127.0.0.1) で起動

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    https: {
      cert: fs.readFileSync('.certs/localhost.pem'),
      key: fs.readFileSync('.certs/localhost-key.pem'),
      ALPNProtocols: ['http/1.1'],
    },
    hmr: {
      protocol: 'wss',
      host: '127.0.0.1',
      port: 3000,
    },
  },
})
```

```bash
# 例: package.json に登録済み
npm run certs:mkcert
npm run dev:https
```

> ポート 3000 が塞がっている場合、Vite が自動で 3001 へフォールバックすることがあります。ブラウザも `https://127.0.0.1:3001/` に切り替えて再読み込みしてください。

> 认证フローでクロスサイト Cookie を扱う場合は `cookiePolicy` ヘルパーを使うと `SameSite=None; Secure` を自動で付与でき、Chrome の警告を避けられます。

7. ポートの競合を掃除

```bash
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -r kill -TERM
lsof -tiTCP:5173 -sTCP:LISTEN | xargs -r kill -TERM
```

### 1分スモークテスト

```bash
lsof -tiTCP:3000 -sTCP:LISTEN | xargs -r kill -TERM
npm run certs:mkcert
npm run dev:https
# 別シェルで:
curl -I https://127.0.0.1:3000/  # HTTP/2 200 と TLSv1.3 を確認
```

なぜ起きる？（要因別の対処）
- ブラウザ状態（主犯）：HSTS・Service Worker・HTTP/HTTPS取り違え
- 環境の妨害：企業プロキシ/セキュリティソフトの MITM
- 証明書チェーン：mkcert ルート CA が「常に信頼」になっていない
- ポート競合：ゴーストプロセスが 3000/5173 を占有
- Vite 設定ミス/証明書不在

迅速診断コマンド

```bash
curl -vk https://localhost:3000/ | head -n 20
node -p "process.versions.openssl"
curl -vk https://127.0.0.1:3000/ | head -n 20
```

curl で 200 OK & TLSv1.3 が見えればサーバ側は健全。→ ブラウザ状態/環境要因の疑いが濃厚。

チェックリスト
- [ ] https:// でアクセスしている
- [ ] chrome://net-internals/#hsts で localhost を Delete（完全終了→再起動）
- [ ] DevTools: Disable cache / Service Worker Unregister
- [ ] システムプロキシ OFF または localhost,127.0.0.1 除外
- [ ] mkcert CA が「常に信頼」、.certs/localhost*.pem が存在
- [ ] lsof でポート掃除 → プロジェクト直下で npm run dev:https
- [ ] それでもダメ → 別ブラウザ（Firefox/Edge）で切り分け

付録（PowerShell）

```powershell
$env:HTTPS="true"
npm run dev
```

## Azure AD / Entra App Requirements
API permissions should include delegated permissions to SharePoint (e.g. `Sites.Read.All` and `Sites.ReadWrite.All` if writing). Admin consent must be granted. The `${resource}/.default` scope relies on these pre-consented permissions.

## License
Internal / TBD.
# CI smoke

