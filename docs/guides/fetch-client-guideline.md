# Fetch Client ガイドライン

> **最終更新**: Phase 3-B (fetchSp 凍結)  
> **ステータス**: 運用中

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

### `fetchSp` import 禁止 (Phase 3-B)

```
'no-restricted-imports': ['error', {
  paths: [{ name: '@/lib/fetchSp', message: '...' }]
}]
```

`fetchSp` は `spFetch` への互換レイヤーとして残存していますが、
**新規コードでの import は禁止** です。

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

## `fetchSp` 互換レイヤーの仕組み

Phase 3-A で `fetchSp.ts` の内部実装を `spFetch` に委譲しました。

```
呼び出し元 → fetchSp() → createSpFetch(throwOnError: false) → spFetch() → fetch()
```

- 既存7箇所は `fetchSp` 経由でも `spFetch` の恩恵 (リトライ, mock, トークン更新) を受ける
- `throwOnError: false` により既存の `response.ok` チェックとの互換性を維持
- **新規コードは `fetchSp` ではなく `spClient` / `useSP()` を使うこと**

---

## 既存 `fetchSp` 利用箇所 (7箇所 — Phase 3-C で段階移行)

| ファイル | 用途 |
|---------|------|
| `features/daily/infra/SharePointDailyRecordRepository.ts` | 日次記録 CRUD |
| `features/monitoring/data/SharePointIspDecisionRepository.ts` | ISP 判断レコード |
| `features/monitoring/data/SharePointSupportPlanningSheetRepository.ts` | 計画書シート |
| `features/schedules/data/scheduleSpHelpers.ts` | スケジュール取得ヘルパー |
| `features/schedules/infra/SharePointScheduleRepository.ts` | スケジュール Repository |
| `features/support-plan-guide/infra/SharePointSupportPlanDraftRepository.ts` | 支援計画ドラフト |
| `pages/admin/DataIntegrityPage.tsx` | データ整合性チェック |

各箇所には `eslint-disable-next-line no-restricted-imports -- Phase 3-C: spClient 移行予定` が付与済み。

---

## フェーズ計画

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | ESLint ガードレール (生 fetch 禁止) | ✅ 完了 |
| 2 | `graphFetch` 設計 + Graph 4箇所移行 | ✅ 完了 |
| 3-A | `fetchSp` を `spFetch` 互換レイヤーに変換 | ✅ 完了 |
| 3-B | `fetchSp` import 禁止 (ESLint) + 全既存箇所に disable 付与 | ✅ 完了 |
| 3-C | 既存7箇所を `spClient` に段階移行 → `fetchSp.ts` 削除 | 🔜 次回 |
