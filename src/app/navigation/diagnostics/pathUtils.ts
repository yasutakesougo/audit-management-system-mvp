
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
 * Handles optional params: pattern "/admin/foo/:bar?" matches path "/admin/foo"
 */
export const matchDynamic = (path: string, pattern: string): boolean => {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  // Count required (non-optional, non-wildcard) segments
  const requiredParts = patternParts.filter(s => !s.endsWith('?') && s !== '*');

  if (!pattern.endsWith('/*') && (pathParts.length < requiredParts.length || pathParts.length > patternParts.length)) {
    return false;
  }

  for (let i = 0; i < Math.min(pathParts.length, patternParts.length); i++) {
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
  { path: '/schedules/month', category: 'Drilldown', reason: 'スケジュールの「月」ビュー' },
  { path: '/schedules/create', category: 'Creation', reason: 'スケジュール作成モーダル/ページ' },
  { path: '/dev/schedule-create-dialog', category: 'Dev', reason: '開発用画面' },
  { path: '/isp-editor/:userId', category: 'Detail', reason: 'ISP前回比較の利用者別詳細画面（TodayOps・UserDetailから遷移）' },
  { path: '/monitoring-meeting/:userId', category: 'Detail', reason: 'モニタリング会議の利用者別詳細画面（支援計画導線から遷移）' },
  { path: '/admin/csv-import', category: 'Admin', reason: '管理者用CSVインポート画面（直接URLアクセス）' },
  { path: '/analysis/dashboard', category: 'Redirect', reason: '統合ワークスペースのdashboardタブへリダイレクト' },
  { path: '/analysis/iceberg', category: 'Redirect', reason: '統合ワークスペースのicebergタブへリダイレクト' },
  { path: '/analysis/iceberg-pdca', category: 'Redirect', reason: '統合ワークスペースのpdcaタブへリダイレクト' },
  { path: '/analysis/iceberg-standalone', category: 'Standalone', reason: '氷山モデルCanvas専用画面（別ウィンドウ）' },
  { path: '/admin/debug/zod-error', category: 'Dev', reason: '開発用Zodエラー確認画面' },
  { path: '/admin/debug/opening-verification', category: 'Dev', reason: '開発用テナント検証ツール' },
  { path: '/admin/debug/smoke-test', category: 'Dev', reason: '開発用スモークテスト画面' },
  { path: '/admin/data-integrity', category: 'Admin', reason: '管理者用データ整合性確認画面' },
  { path: '/support-planning-sheet/:planningSheetId', category: 'Detail', reason: '支援計画シート詳細画面（計画書一覧・ISPエディタからリンク経由）' },
  { path: '/planning-sheet-list', category: 'Drilldown', reason: '計画書一覧ページ（ISPエディタ・支援計画ガイドからリンク経由）' },
  { path: '/abc-record', category: 'Drilldown', reason: 'ABC記録ページ（IcebergPDCA・計画シートからリンク経由）' },
  { path: '/dashboard/briefing', category: 'Drilldown', reason: 'ブリーフィングビュー（ダッシュボードからリンク経由）' },
  { path: '/meeting-guide', category: 'Drilldown', reason: '会議ガイドページ（管理ツールからリンク経由）' },
  { path: '/records/monthly', category: 'Drilldown', reason: '月次記録ページ（日次記録・ダッシュボードからリンク経由）' },
  { path: '/records/journal', category: 'Drilldown', reason: '業務日誌ページ（日次記録・ダッシュボードからリンク経由）' },
  { path: '/checklist', category: 'Admin', reason: '自己点検チェックリスト（管理ツールhubからリンク経由）' },
  { path: '/audit', category: 'Admin', reason: '監査ログ（管理ツールhubからリンク経由）' },
  { path: '/analysis/intervention', category: 'Drilldown', reason: '介入分析（分析ワークスペースからリンク経由）' },
  { path: '/admin/templates', category: 'Admin', reason: 'テンプレート管理（管理ツールhubからリンク経由）' },
  { path: '/admin/step-templates', category: 'Admin', reason: '支援手順テンプレート（管理ツールhubからリンク経由）' },
  { path: '/admin/individual-support/:userCode?', category: 'Admin', reason: '個別支援設定（管理ツールhubからリンク経由）' },
  { path: '/admin/navigation-diagnostics', category: 'Dev', reason: 'ナビゲーション診断ツール（管理ツールhubからリンク経由）' },
  { path: '/admin/mode-switch', category: 'Admin', reason: 'モード切替画面（管理ツールhubからリンク経由）' },
  { path: '/ibd', category: 'Redirect', reason: 'IBD分析へのリダイレクト' },
  { path: '/settings/operation-flow', category: 'Settings', reason: '運営フロー設定（設定画面からリンク経由）' },
  { path: '/incidents', category: 'Drilldown', reason: 'インシデント管理（日次記録・ダッシュボードからリンク経由）' },
  { path: '/admin/integrated-resource-calendar', category: 'Admin', reason: '統合リソースカレンダー（管理ツール・運用ハブからリンク経由）' },
  { path: '/records/journal/personal', category: 'Detail', reason: '個人別業務日誌詳細（月次記録ハブからリンク経由）' },
  { path: '/records/service-provision', category: 'Admin', reason: 'サービス提供実績記録（実績記録ハブ、請求ハブからリンク経由）' },
  { path: '/survey/tokusei', category: 'Admin', reason: '特性計時アンケート結果（計画ハブからリンク経由）' },
  { path: '/schedule-ops', category: 'Drilldown', reason: 'スケジュール運用ページ（スケジュール画面からリンク経由）' },
  { path: '/users/hub/:userId', category: 'Detail', reason: '利用者の「活動・実績ハブ」画面（利用者詳細からリンク経由）' },
  { path: '/kiosk', category: 'Kiosk', reason: 'キオスクモード専用 — キオスク入口画面（通常Navに露出しない）' },
  { path: '/kiosk-users', category: 'Kiosk', reason: 'キオスクモード専用（互換）— 利用者選択の旧ルート（通常Navに露出しない）' },
  { path: '/kiosk-procedures', category: 'Kiosk', reason: 'キオスクモード専用（互換）— 支援手順一覧の旧ルート（通常Navに露出しない）' },
  { path: '/kiosk/users', category: 'Kiosk', reason: 'キオスクモード専用 — 利用者選択画面（通常Navに露出しない）' },
  { path: '/kiosk/users/:userId/procedures', category: 'Kiosk', reason: 'キオスクモード専用 — 支援手順一覧画面（通常Navに露出しない）' },
  { path: '/kiosk/users/:userId/procedures/:slotKey', category: 'Kiosk', reason: 'キオスクモード専用 — 支援手順詳細画面（通常Navに露出しない）' },
].map(item => ({ ...item, path: normalizeRouterPath(item.path) }));

export const ORPHAN_ALLOWLIST = new Set(ORPHAN_ALLOWLIST_DETAILS.map(d => d.path));
