# Cloudflare Workers SPA Routing Guide

## 問題

React Router などの SPA を Cloudflare Workers + Assets で運用する際、直接 URL アクセス（例: `/schedules/week`）が 404 や `(canceled)` になる問題。

## 原因

Cloudflare Workers Assets は、デフォルトでは存在しないパスに対して 404 を返す。SPA は `index.html` をすべてのルートで返す必要がある。

## 解決策

`src/worker.ts` で **pathname ベースの SPA fallback** を実装：

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes - pass through
    if (url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    // Static files (has file extension) - serve as-is
    if (url.pathname.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // SPA routes (no extension) - always return index.html
    const indexRequest = new Request(new URL('/index.html', url), request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    
    const headers = new Headers(indexResponse.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(indexResponse.body, {
      status: 200,
      headers,
    });
  },
};
```

## キーポイント

### ✅ DO (正解)
- **拡張子あり** (`.js`, `.css`, `.png`) → Assets から取得
- **拡張子なし** (`/schedules/week`) → `index.html` を返す
- COOP ヘッダーで MSAL popup サポート

### ❌ DON'T (失敗パターン)
- `response.status === 404` で判定 → Cloudflare Workers では不安定
- `not_found_handling = "single-page-application"` だけに依存 → Worker がいると無視される

## デプロイ

```bash
npm run build
npx wrangler deploy
```

## 検証

本番URLで直接アクセステスト：
```
https://[your-worker].workers.dev/schedules/week  → 200 OK
https://[your-worker].workers.dev/schedules/day   → 200 OK
https://[your-worker].workers.dev/assets/index-*.js → 200 OK
```

## トラブルシューティング

### 白い画面が出る
→ DevTools Console でエラー確認  
→ Network タブで JS/CSS が 200 か確認

### MSAL エラー
→ `VITE_MSAL_REDIRECT_URI` が本番ドメインと一致しているか  
→ Azure AD で Redirect URI 登録済みか

## 参考

- Cloudflare Workers Assets: https://developers.cloudflare.com/workers/static-assets/
- React Router: https://reactrouter.com/
- Commit: 94e851f (fix(worker): implement SPA routing fallback for Workers assets)
