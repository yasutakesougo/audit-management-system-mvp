# Fetch Client ガイドライン

> **最終更新**: Phase 3-C 完了 (fetchSp.ts 削除)  
> **ステータス**: ✅ 全フェーズ完了

---

## 原則

本プロジェクトでは **生 `fetch()` の直接呼び出しを禁止** し、
ドメイン別の通信クライアントを通じて API 通信を行います。

| 通信先 | 正規クライアント | ファイル |
|--------|-----------------|---------|
| SharePoint REST API | `spFetch` / `createSpClient()` | `src/lib/sp/spFetch.ts`, `src/lib/spClient.ts` |
| Microsoft Graph API | `graphFetch` | `src/lib/graph/graphFetch.ts` |
| その他外部 API | `resilientFetch` (予定) | — |

---

## なぜ直接 `fetch()` を禁止するのか

1. **認証ヘッダの一元管理** — Bearer トークンの取得・更新を各所で重複させない
2. **リトライの統一** — 429 / 5xx に対する指数バックオフを一本化
3. **エラー整形** — `SpHttpError` / `GraphApiError` 等の統一型で上位に伝播
4. **Mock 対応** — E2E / デモ環境でのモック注入が正規出口を通じて一括で効く
5. **監査ログ** — 全通信がリクエスト/レスポンスを監査ログに記録

---

## ESLint によるガードレール

### 生 `fetch` 禁止

```
'no-restricted-globals': ['error', { name: 'fetch', ... }]
'no-restricted-properties': ['error', { object: 'window', property: 'fetch', ... }]
```

### `fetchSp` (削除済み)

`fetchSp.ts` は Phase 3-C で全利用箇所を `spClient` に移行し、**削除済み** です。
ESLint の `no-restricted-imports` ルールが残っているため、万一復活しても即検出されます。

---

## 新規コードの書き方

### SharePoint API を呼ぶ場合

```typescript
// ✅ 推奨: useSP hook 経由 (React コンポーネント内)
import { useSP } from '@/hooks/useSP';

const { spFetch } = useSP();
const response = await spFetch('/lists/...', { method: 'GET' });

// ✅ 推奨: createSpClient 経由 (非 React / Repository 層)
import { createSpClient } from '@/lib/spClient';

const client = createSpClient(acquireToken, baseUrl);
const data = await client.fetchJson<T>('/lists/...');
```

### Microsoft Graph API を呼ぶ場合

```typescript
import { createGraphClient } from '@/lib/graph/graphFetch';

const client = createGraphClient({ acquireToken });
const data = await client.fetchJson<T>('/me/events');
const allPages = await client.fetchAllPages<T>('/groups');
```

### ❌ 禁止パターン

```typescript
// ❌ 生 fetch
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

// ❌ fetchSp を新規コードで使用
import { fetchSp } from '@/lib/fetchSp'; // ESLint エラー
```

---

## `fetchSp` 移行の変遷

| Phase | 状態 |
|-------|------|
| 3-A | `fetchSp.ts` 内部を `spFetch` に委譲（互換レイヤー化） |
| 3-B | ESLint で `fetchSp` import を凍結 |
| 3-C | 全7箇所を `spClient` に移行、`fetchSp.ts` を **削除** |

現在は `spClient` / `useSP()` が唯一の SharePoint 通信手段です。

---

## Phase 3-C 移行テンプレート

> **参照PR**: #998 (DataIntegrityPage 移行)

`fetchSp` → `spClient` 移行は以下の3ステップで行います。

### Step 1: import を差し替える

```typescript
// ❌ Before
// eslint-disable-next-line no-restricted-imports -- Phase 3-C: spClient 移行予定
import { fetchSp } from '@/lib/fetchSp';

// ✅ After (React コンポーネント内)
import { useSP } from '@/lib/spClient';
const { spFetch } = useSP();

// ✅ After (非 React / Repository 層)
// acquireToken を引数またはコンストラクタでDI
import { createSpClient } from '@/lib/spClient';
const client = createSpClient(acquireToken, baseUrl);
```

### Step 2: パスを相対化する

```typescript
// ❌ Before: 絶対 URL
const res = await fetchSp(`${baseUrl}/_api/web/lists/GetByTitle('Users')/items`);

// ✅ After: 相対パス（baseUrl は spFetch 内部で解決）
const res = await spFetch(`/_api/web/lists/GetByTitle('Users')/items`);
```

**注意**: `odata.nextLink` は絶対 URL で返るため、パス抽出が必要:

```typescript
const nextLink = payload['odata.nextLink'] ?? null;
if (nextLink) {
  const idx = nextLink.indexOf('/_api/');
  path = idx >= 0 ? nextLink.slice(idx) : nextLink;
}
```

### Step 3: エラー契約を throwOnError 前提に合わせる

```typescript
// ❌ Before: 手動チェック
const response = await fetchSp(url);
if (!response.ok) {
  auditLog.warn('context', 'action', { status: response.status });
  break;
}

// ✅ After: spFetch は throwOnError: true がデフォルト
// → HTTP エラーは SpHttpError として自動 throw される
// → 上位の try-catch で補足すればよい
const response = await spFetch(path);
```

### 完了チェック

- [ ] `fetchSp` import を除去
- [ ] `eslint-disable-next-line no-restricted-imports` コメントを除去
- [ ] パスを相対化 (`baseUrl` 直指定を排除)
- [ ] `response.ok` 手動チェックを削除 or `throwOnError` 前提に変更
- [ ] TypeScript / ESLint / テスト全通過

---

## 既存 `fetchSp` 利用箇所 (Phase 3-C 移行完了)

| ファイル | 用途 | Issue | 状態 |
|---------|------|-------|------|
| `pages/admin/DataIntegrityPage.tsx` | データ整合性チェック | #993 | ✅ #998 |
| `features/monitoring/data/SharePointIspDecisionRepository.ts` | ISP 判断レコード | #994 | ✅ #999 |
| `features/monitoring/data/SharePointSupportPlanningSheetRepository.ts` | 計画書シート | #994 | ✅ #999 |
| `features/support-plan-guide/infra/SharePointSupportPlanDraftRepository.ts` | 支援計画ドラフト | #995 | ✅ 完了 |
| `features/daily/infra/SharePointDailyRecordRepository.ts` | 日次記録 CRUD | #996 | ✅ 完了 |
| `features/schedules/data/scheduleSpHelpers.ts` | スケジュール取得 | #997 | ✅ 完了 |
| `features/schedules/infra/SharePointScheduleRepository.ts` | スケジュール Repository | #997 | ✅ 完了 |

> **`fetchSp.ts` は削除済み** — 全7箇所が `spClient` に移行完了

---

## フェーズ計画

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | ESLint ガードレール (生 fetch 禁止) | ✅ 完了 |
| 2 | `graphFetch` 設計 + Graph 4箇所移行 | ✅ 完了 |
| 3-A | `fetchSp` を `spFetch` 互換レイヤーに変換 | ✅ 完了 |
| 3-B | `fetchSp` import 禁止 (ESLint) + 全既存箇所に disable 付与 | ✅ 完了 |
| 3-C | 既存7箇所を `spClient` に段階移行 → `fetchSp.ts` 削除 | ✅ **完了** |
