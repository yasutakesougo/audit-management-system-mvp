
/**
 * Normalizes a URL or href by stripping query strings and trailing slashes.
 */
export const normalizePath = (href: string): string => {
  if (!href) return '';
  const pathPart = href.split('?')[0].split('#')[0];
  const withoutTrailing = pathPart.replace(/\/$/, '');
  return withoutTrailing || '/'; // Ensure root is '/'
};

/**
 * Normalizes a router path.
 * e.g. "users/:userId" -> "/users/:userId"
 */
export const normalizeRouterPath = (path: string): string => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

/**
 * Checks if a normalized router path contains a dynamic segment (e.g. `/:id`).
 */
export const isDynamicPattern = (pattern: string): boolean => {
  return pattern.includes('/:');
};

/**
 * Extremely basic matching for dynamic segments.
 * example: pattern "/users/:id" matches path "/users/123"
 */
export const matchDynamic = (path: string, pattern: string): boolean => {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length && !pattern.endsWith('/*')) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const pPart = patternParts[i];

    if (pPart === '*') {
      return true; // wildcard matches rest
    }

    if (pPart.startsWith(':')) {
      continue; // dynamic segment matches anything
    }

    if (pPart !== pathParts[i]) {
      return false;
    }
  }

  return true;
};

export interface AllowlistRoute {
  path: string;
  category: string;
  reason: string;
}

/**
 * 意図的に「露出しない設計」としたルートのリスト (allowlist)
 * 幽霊ルート探索(Router -> Nav)において無視するべきもの。
 *
 * 構造的に NavDiagnosticsUI や nav-router-consistency テストで利用・共有されます。
 */
export const ORPHAN_ALLOWLIST_DETAILS: AllowlistRoute[] = [
  { path: '/auth/callback', category: 'Auth', reason: '認証完了後のリダイレクト先' },
  { path: '/', category: 'Redirect', reason: 'ダッシュボード等への自動リダイレクト' },
  { path: '/admin/dashboard', category: 'Redirect', reason: 'ダッシュボードへのリダイレクト' },
  { path: '/dashboard/briefing', category: 'Drilldown', reason: 'ダッシュボード内の詳細タブ' },
  { path: '/today', category: 'Drilldown', reason: 'トップレベル概念ページ' },
  { path: '/room-management', category: 'Settings', reason: '設定・管理用の別導線' },
  { path: '/meeting-minutes/:id', category: 'Detail', reason: '特定の議事録詳細画面' },
  { path: '/meeting-minutes/:id/edit', category: 'Edit', reason: '議事録の編集画面' },
  { path: '/users/new', category: 'Creation', reason: '新規利用者の作成画面' },
  { path: '/users/:userId', category: 'Detail', reason: '個別の利用者詳細画面' },
  { path: '/staff/new', category: 'Creation', reason: '新規スタッフの作成画面' },
  { path: '/staff/:staffId', category: 'Detail', reason: '個別のスタッフ詳細画面' },
  { path: '/daily', category: 'Redirect', reason: '日次記録メニューへのリダイレクト' },
  { path: '/daily/menu', category: 'Redirect', reason: '日次記録メニューへのリダイレクト' },
  { path: '/daily/activity', category: 'Internal', reason: '内部利用用の日次活動ルート' },
  { path: '/daily/support-checklist', category: 'Detail', reason: 'サポートチェックリスト' },
  { path: '/daily/time-based', category: 'Redirect', reason: '時間記録ベースへのリダイレクト' },
  { path: '/analysis', category: 'Redirect', reason: '分析ダッシュボードへのリダイレクト' },
  { path: '/analysis/iceberg-pdca/edit', category: 'Edit', reason: '氷山PDCAの編集画面' },
  { path: '/schedule', category: 'Redirect', reason: 'スケジュール一覧へのリダイレクト' },
  { path: '/schedule/*', category: 'Wildcard', reason: 'スケジュールサブパスのキャッチオール' },
  { path: '/schedules', category: 'Redirect', reason: 'スケジュール一覧へのリダイレクト' },
  { path: '/schedules/day', category: 'Drilldown', reason: 'スケジュールの「日」ビュー' },
  { path: '/schedules/timeline', category: 'Drilldown', reason: 'スケジュールのタイムラインビュー' },
  { path: '/schedules/unified', category: 'Redirect', reason: '統合スケジュールへのリダイレクト' },
  { path: '/schedules/create', category: 'Creation', reason: 'スケジュール作成モーダル/ページ' },
  { path: '/dev/schedule-create-dialog', category: 'Dev', reason: '開発用画面' },
  { path: '/isp-editor/:userId', category: 'Detail', reason: 'ISP前回比較の利用者別詳細画面（TodayOps・UserDetailから遷移）' }
].map(item => ({ ...item, path: normalizeRouterPath(item.path) }));

export const ORPHAN_ALLOWLIST = new Set(ORPHAN_ALLOWLIST_DETAILS.map(d => d.path));
