# 通信・永続化 Observability 設計メモ

> **Date**: 2026-03-16
> **Status**: 設計段階
> **前提**: fetchSp→spFetch 移行完了（通信出口一本化済み）

---

## 現状分析

### すでにあるもの

| レイヤー | 仕組み | ファイル | 状態 |
|---------|--------|---------|------|
| Hydration計測 | `startFeatureSpan` + budget | `hydration/features.ts` | ✅ 14スパン運用中 |
| Hydration HUD | `beginHydrationSpan` / pub-sub | `lib/hydrationHud.ts` | ✅ 運用中 |
| Telemetry送信 | `sendHydrationSpans` (Beacon) | `telemetry/hydrationBeacon.ts` | ✅ サンプリング対応 |
| デバッグログ | `auditLog` (console wrapper) | `lib/debugLogger.ts` | ✅ 運用中 |
| 永続エラーログ | `persistentLogger` (localStorage) | `lib/persistentLogger.ts` | ✅ タブレット対応 |
| SP通信デバッグ | `auditLog.debug('sp:fetch')` | `lib/sp/spFetch.ts` | ✅ AUDIT_DEBUG時のみ |

### ないもの（＝今回作るもの）

| 不足 | 影響 |
|------|------|
| **通信レベルの構造化イベント** | 「どの API が」「何回失敗したか」が定量的に見えない |
| **Graph 通信のログ** | graphFetch に auditLog がなく、失敗が完全にサイレント |
| **リトライの可視化** | spFetch のリトライは debug ログだけ — HUD やテレメトリに乗らない |
| **Repository 保存系の計測** | daily の save は計測済みだが、他の Repository の write は未計測 |
| **ドメイン別の失敗率** | どのドメインが不安定か、を把握する手段がない |

---

## 目標

> **通信出口（spFetch / graphFetch）に薄い観測レイヤーを入れ、**
> **既存の HydrationSpan + Beacon インフラに乗せる**

新しいインフラは作らない。既存の `beginHydrationSpan` + `sendHydrationSpans` を活用する。

---

## Phase 1: イベント設計

### 記録するイベント

```
sp.request       — SharePoint API 呼び出し (成功/失敗/リトライ)
graph.request     — Graph API 呼び出し (成功/失敗/リトライ)
```

### イベントのペイロード

```typescript
type FetchSpanMeta = {
  layer: 'sp' | 'graph';
  method: string;                // GET, POST, PATCH, ...
  path: string;                  // /_api/web/lists/... (先頭80文字)
  status: number;                // HTTP status
  durationMs: number;            // レイテンシ
  retryCount: number;            // リトライ回数 (0 = 初回成功)
  errorName?: string;            // SpHttpError, GraphApiError, etc.
  domain?: string;               // daily, schedules, monitoring, ...
};
```

### 記録しないもの

| 項目 | 理由 |
|------|------|
| リクエストボディ | 個人情報が含まれる可能性 |
| レスポンスボディ | 同上 + サイズが大きい |
| Authorization ヘッダー | トークン漏洩防止 |
| ユーザー ID / 名前 | PII（個人識別情報） |
| クエリパラメータの値 | フィルター条件に名前が含まれうる |

**原則**: パスの構造部分 + ステータスコード + 時間情報のみ。

---

## Phase 2: 実装 — fetchSpan ヘルパー

新しいモジュールは1つだけ。既存のスパン基盤に乗せる。

### `src/telemetry/fetchSpan.ts`

```typescript
import { beginHydrationSpan } from '@/lib/hydrationHud';

type FetchSpanOptions = {
  layer: 'sp' | 'graph';
  method: string;
  path: string;
  domain?: string;
};

export function startFetchSpan(options: FetchSpanOptions) {
  const id = `${options.layer}:${options.method}:${truncatePath(options.path)}`;

  const complete = beginHydrationSpan(id, {
    label: `${options.layer} ${options.method}`,
    group: `fetch:${options.layer}`,
    meta: {
      layer: options.layer,
      method: options.method,
      path: truncatePath(options.path),
      domain: options.domain,
    },
  });

  return {
    succeed: (status: number, retryCount = 0) =>
      complete({
        meta: { status, retryCount, durationMs: /* auto from span */ undefined },
      }),
    fail: (status: number, errorName: string, retryCount = 0) =>
      complete({
        error: `${errorName} (${status})`,
        meta: { status, retryCount, errorName },
      }),
  };
}

function truncatePath(path: string): string {
  // クエリパラメータを除去し、80文字に制限
  const clean = path.split('?')[0];
  return clean.length > 80 ? clean.slice(0, 80) + '…' : clean;
}
```

---

## Phase 3: 差し込み箇所

### spFetch (`src/lib/sp/spFetch.ts`)

```
差し込み位置: createSpFetch の spFetch 関数内
```

```diff
 return async function spFetch(path, init) {
+  const span = startFetchSpan({
+    layer: 'sp',
+    method: init.method ?? 'GET',
+    path: resolvedPath,
+  });

   // ... existing retry logic ...

+  if (response.ok) {
+    span.succeed(response.status, attempt - 1);
+  } else {
+    span.fail(response.status, 'SpHttpError', attempt - 1);
+  }
   return response;
 };
```

**変更量**: 約10行の追加。既存ロジックへの影響なし。

### graphFetch (`src/lib/graph/graphFetch.ts`)

```
差し込み位置: createGraphClient の fetchRaw 関数内
```

```diff
 const fetchRaw = async (path, options) => {
+  const span = startFetchSpan({
+    layer: 'graph',
+    method: options.method ?? 'GET',
+    path,
+  });

   // ... existing retry logic ...

-  if (response.ok) return response;
+  if (response.ok) {
+    span.succeed(response.status, attempt);
+    return response;
+  }

   // error path
+  span.fail(response.status, 'GraphApiError', attempt);
   throw new GraphApiError(...);
 };
```

**変更量**: 約10行の追加。既存ロジックへの影響なし。

---

## Phase 4: 出力先（将来）

現時点では **HydrationSpan ストアに蓄積** するだけで十分。

既存の `sendHydrationSpans` (Beacon API) がそのまま使えるため、
テレメトリエンドポイント (`VITE_TELEMETRY_URL`) を設定すれば
自動的に外部送信される。

```
startFetchSpan
  → beginHydrationSpan (store に蓄積)
  → subscribeHydrationSpans (HUD に表示)
  → sendHydrationSpans (Beacon で外部送信)
```

| 将来の出力先 | 接続方法 |
|-------------|---------|
| HydrationHUD (開発時) | すでに接続済み（subscribe） |
| Beacon (テレメトリ) | すでに接続済み（sendHydrationSpans） |
| SharePoint リスト | 専用の subscriber を追加 |
| App Insights | SDK の trackDependency に変換 |
| Firestore | Cloud Function 経由 |

**今は何も追加しない。** スパンを蓄積するだけで、
既存インフラが HUD 表示とテレメトリ送信を自動的にやってくれる。

---

## 実装の優先順序

| Step | 作業 | 見積もり |
|------|------|---------|
| 1 | `telemetry/fetchSpan.ts` 作成 | 30分 |
| 2 | `spFetch.ts` に差し込み | 20分 |
| 3 | `graphFetch.ts` に差し込み | 20分 |
| 4 | テスト追加 | 30分 |
| **合計** | | **~1.5h** |

---

## 設計判断

### Q: なぜ新しいテレメトリ基盤を作らないのか？

A: 既存の `HydrationSpan` + `hydrationBeacon` がすでに
「スパン蓄積 → サブスクライブ → Beacon 送信」のパイプラインを持っている。
通信イベントも同じパイプラインに乗せるのが最もシンプル。

### Q: `domain` フィールドはどう埋めるのか？

A: Phase 3 では `spFetch` / `graphFetch` レベルでは `domain` を入れない
（パスから推測する汎用ロジックは脆い）。
Repository レベルで `startFeatureSpan` を使う既存パターンで
ドメイン別の計測はすでにカバーされている（daily.save, schedules.load 等）。

### Q: パフォーマンスへの影響は？

A: `beginHydrationSpan` は `performance.now()` + Map 操作のみ。
通信の RTT（数十〜数百ms）に比べて無視できるオーダー。

### Q: サンプリングは？

A: `hydrationBeacon.ts` の `VITE_TELEMETRY_SAMPLE` で制御済み。
スパンの蓄積自体は全件、送信時にサンプリング。

---

## まとめ

```
+------------------+     +------------------+     +------------------+
|   spFetch        | --> | fetchSpan        | --> | HydrationSpan    |
|   graphFetch     |     | (計測ヘルパー)    |     | Store            |
+------------------+     +------------------+     +--------+---------+
                                                           |
                                            +--------------+--------------+
                                            |              |              |
                                         HUD 表示    Beacon 送信    将来: App Insights
```

**新規ファイル**: `telemetry/fetchSpan.ts` (1ファイル)
**変更ファイル**: `spFetch.ts`, `graphFetch.ts` (各10行程度)
**新規インフラ**: なし（既存の HydrationSpan パイプラインを活用）
