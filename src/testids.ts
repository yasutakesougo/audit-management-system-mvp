// ---- Single source of truth for data-testid ----

// 値は常に true（型はリテラル化）。キーが TestId になる。
// as const での構文互換性問題がある環境向けに Object.freeze を採用
export const TESTIDS = Object.freeze({
  // Shell / Router
  'app-root': true,
  'app-router-outlet': true,

  // Pages
  'meeting-guide': true,
  'dashboard-records': true,
  'attendance-page': true,
  'plan-create-page': true,
  'plan-edit-page': true,
  'profile-placeholder': true,

  // Features
  'record-form': true,
  'record-table': true,
  'record-row': true,
  'toast-announcer': true,
  'toast-message': true,
  'nav-schedule': true,
  'app-bottom-nav': true,
});



// React で使うお手軽ヘルパー（型はstringで十分）
export function tid(id: string) {
  return { 'data-testid': id } as const;
}
