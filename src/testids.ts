// ---- Single source of truth for data-testid ----

// 値は常に文字列。キーと同じ値を返すことでテストコードからの参照を簡易化。
export const TESTIDS = {
  // Shell / Router
  'app-root': 'app-root',
  'app-router-outlet': 'app-router-outlet',

  // Pages
  'meeting-guide': 'meeting-guide',
  'meeting-guide-page': 'meeting-guide-page',
  'dashboard-page': 'dashboard-page',
  'dashboard-records': 'dashboard-records',
  'attendance-page': 'attendance-page',
  'plan-create-page': 'plan-create-page',
  'plan-edit-page': 'plan-edit-page',
  'profile-placeholder': 'profile-placeholder',

  // Features
  'record-form': 'record-form',
  'record-table': 'record-table',
  'record-row': 'record-row',
  'toast-announcer': 'toast-announcer',
  'toast-message': 'toast-message',
  'nav-schedules': 'nav-schedules',
  'app-bottom-nav': 'app-bottom-nav',

  // Users feature
  'users-panel-root': 'users-panel-root',
  'users-list-table': 'users-list-table',
  'users-detail-pane': 'users-detail-pane',
  'user-detail-sections': 'user-detail-sections',
  'users-quick-prefix': 'users-quick-',
  'user-menu-card-prefix': 'user-menu-card-',
  'user-menu-tabpanel-prefix': 'user-menu-tabpanel-',
  'user-menu-section-prefix': 'user-menu-section-',
} as const;



// React で使うお手軽ヘルパー（型はstringで十分）
export function tid(id: string) {
  return { 'data-testid': id } as const;
}
