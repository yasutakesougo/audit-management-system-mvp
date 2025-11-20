import { ui } from './ui';

// UI文言の型安全なアクセスのための型定義
export type UIPath =
  | 'schedule.listTitle'
  | 'schedule.actions.new'
  | 'schedule.actions.edit'
  | 'schedule.actions.delete'
  | 'schedule.actions.duplicate'
  | 'schedule.form.createTitle'
  | 'schedule.form.editTitle'
  | 'schedule.form.save'
  | 'schedule.form.cancel'
  | 'schedule.form.close'
  | 'schedule.form.submitting'
  | 'schedule.form.successMessage'
  | 'schedule.form.errorMessage'
  | 'schedule.deleteDialog.title'
  | 'schedule.deleteDialog.message'
  | 'schedule.deleteDialog.confirm'
  | 'schedule.deleteDialog.cancel'
  | 'schedule.deleteDialog.successMessage'
  | 'schedule.deleteDialog.errorMessage'
  | 'schedule.state.loading'
  | 'schedule.state.empty'
  | 'schedule.state.loadError'
  | 'filters.schedule'
  | 'filters.scheduleFields.heading'
  | 'filters.scheduleFields.keywordLabel'
  | 'filters.scheduleFields.dateRangeLabel'
  | 'filters.scheduleFields.staffLabel'
  | 'filters.scheduleFields.userLabel'
  | 'filters.scheduleFields.statusLabel'
  | 'filters.scheduleFields.reset'
  | 'filters.scheduleFields.apply';

// ネストされたパスから値を安全に取得するヘルパー
export const getUIText = (path: UIPath): string => {
  const parts = path.split('.');
  let current: unknown = ui;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      throw new Error(`UI text not found for path: ${path}`);
    }
  }

  if (typeof current !== 'string') {
    throw new Error(`UI text at path "${path}" is not a string`);
  }

  return current;
};

// 型安全なUI文言アクセス用のヘルパー関数群
export const scheduleUI = {
  title: () => ui.schedule.listTitle,
  actions: {
    new: () => ui.schedule.actions.new,
    edit: () => ui.schedule.actions.edit,
    delete: () => ui.schedule.actions.delete,
    duplicate: () => ui.schedule.actions.duplicate,
  },
  form: {
    createTitle: () => ui.schedule.form.createTitle,
    editTitle: () => ui.schedule.form.editTitle,
    save: () => ui.schedule.form.save,
    cancel: () => ui.schedule.form.cancel,
    close: () => ui.schedule.form.close,
    submitting: () => ui.schedule.form.submitting,
    successMessage: () => ui.schedule.form.successMessage,
    errorMessage: () => ui.schedule.form.errorMessage,
  },
  deleteDialog: {
    title: () => ui.schedule.deleteDialog.title,
    message: () => ui.schedule.deleteDialog.message,
    confirm: () => ui.schedule.deleteDialog.confirm,
    cancel: () => ui.schedule.deleteDialog.cancel,
    successMessage: () => ui.schedule.deleteDialog.successMessage,
    errorMessage: () => ui.schedule.deleteDialog.errorMessage,
  },
  state: {
    loading: () => ui.schedule.state.loading,
    empty: () => ui.schedule.state.empty,
    loadError: () => ui.schedule.state.loadError,
  },
} as const;

export const filtersUI = {
  schedule: () => ui.filters.schedule,
  scheduleFields: {
    heading: () => ui.filters.scheduleFields.heading,
    keywordLabel: () => ui.filters.scheduleFields.keywordLabel,
    dateRangeLabel: () => ui.filters.scheduleFields.dateRangeLabel,
    staffLabel: () => ui.filters.scheduleFields.staffLabel,
    userLabel: () => ui.filters.scheduleFields.userLabel,
    statusLabel: () => ui.filters.scheduleFields.statusLabel,
    reset: () => ui.filters.scheduleFields.reset,
    apply: () => ui.filters.scheduleFields.apply,
  },
} as const;