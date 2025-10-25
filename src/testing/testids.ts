// src/testing/testids.ts
// data-testid definitions for E2E/test stability on /records/support-procedures


export const TESTIDS = {
  DASHBOARD: {
    PAGE: 'dashboard-page',
    WEEKLY_CHART: 'dashboard-weekly-chart',
    SUMMARY_CARD: 'dashboard-summary-card',
  },
  supportProcedures: {
    page: 'support-procedures/page',
    form: {
      root: 'support-procedures/form',
      fieldTitle: 'support-procedures/form/title',
      fieldDate: 'support-procedures/form/date',
      WEEKLY_CHART: 'dashboard-weekly-chart',
      save: 'support-procedures/form/save',
      cancel: 'support-procedures/form/cancel',
      errors: 'support-procedures/form/errors',
    },
    table: {
      root: 'support-procedures/table',
      row: (id: string | number) => `support-procedures/table/row/${id}`,
      rowEdit: (id: string | number) => `support-procedures/table/row/${id}/edit`,
      rowDelete: (id: string | number) => `support-procedures/table/row/${id}/delete`,
    },
    toast: {
      root: 'support-procedures/toast',
      message: 'support-procedures/toast/message',
      success: 'support-procedures/toast/success',
      error: 'support-procedures/toast/error',
    },
  },
} as const;
