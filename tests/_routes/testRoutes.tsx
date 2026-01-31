/**
 * テスト専用ルート定義（smoke test 用）
 * 
 * ⚠️ 注意: 本番の router.tsx とは完全に独立
 * 
 * 目的:
 * - Router 基盤（react-router）が正常に動作することを確認
 * - URL直入 → レンダー成功 を地雷なしで保証
 * 
 * 本番の route 定義検証は router.flags.spec.tsx の「構造テスト」で実施
 */
import React from 'react';
import type { RouteObject } from 'react-router-dom';

/**
 * 依存ゼロのダミー画面（統合の地雷を完全回避）
 * - useLocation 不使用
 * - MSAL 不使用
 * - ErrorBoundary 不使用
 * - lazy/Suspense 不使用
 * - gate（ProtectedRoute/AdminGate）不使用
 * 
 * NOTE: testid は smoke- prefix（本番の audit-root とは独立）
 */
function AuditSmoke() {
  return <div data-testid="smoke-audit-root">audit smoke</div>;
}

function ChecklistSmoke() {
  return <div data-testid="smoke-checklist-root">checklist smoke</div>;
}

/**
 * テスト専用 smoke routes
 * router.flags.spec.tsx の「レンダースモーク」で使用
 */
export const smokeRoutes: RouteObject[] = [
  { path: '/audit', element: <AuditSmoke /> },
  { path: '/checklist', element: <ChecklistSmoke /> },
];
