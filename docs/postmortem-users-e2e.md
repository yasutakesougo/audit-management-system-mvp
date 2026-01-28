# Postmortem: E2E users.detail-flow stabilization

## Summary
users.detail-flow.spec.ts がCIで失敗。原因は MSAL CLIENT_ID/TENANT_ID がE2E環境に注入されず、MsalProvider 初期化で落ちて React root がマウントされないこと。

## Root cause
- Console error:
  - [MSAL CONFIG] Missing CLIENT_ID/TENANT_ID. Set VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID
- Effect:
  - `<div id="root"></div>` のまま
  - users-panel-root がDOMに出現せずタイムアウト

## Fix (already merged into main)
- tests/e2e/_helpers/setupPlaywrightEnv.ts
  - BASE_ENV に `VITE_MSAL_CLIENT_ID` / `VITE_MSAL_TENANT_ID` を追加（E2E mock 前提）
- tests/e2e/_helpers/bootUsersPage.ts
  - root空のときだけ network/pageerror/console を収集して出力
  - `E2E_DEBUG=1` or `CI=true` で詳細ログ
- tests/e2e/users.detail-flow.spec.ts
  - app初期化の明示（/ → /users）
  - CI安定のため timeout 調整

## Verification
- npm run health: PASS
- npm run test -- src/features/schedules: PASS
- npm run test:e2e:users: PASS (users関連 6/6)

## Prevention
- main direct push を ruleset で禁止（GH013で拒否されることを確認済み）
