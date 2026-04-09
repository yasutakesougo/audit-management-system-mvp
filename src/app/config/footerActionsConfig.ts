import { TESTIDS } from '@/testids';

// ─── Types ───────────────────────────────────────────────────────────
export type FooterActionKind = 'link' | 'dialog';

export type FooterAction = {
  key: string;
  label: string;
  shortLabel: string;
  color: 'primary' | 'secondary' | 'info';
  variant: 'contained' | 'outlined';
  accent: string;
  testId: string;
  kind: FooterActionKind;
  to?: string;           // kind='link' only
  onClickKey?: string;   // kind='dialog' only
};

// ─── Factory ─────────────────────────────────────────────────────────
type CreateFooterActionsParams = {
  schedulesEnabled?: boolean;
};

export const createFooterActions = (
  _params: CreateFooterActionsParams = {},
): FooterAction[] => {
  const actions: FooterAction[] = [
    {
      key: 'call-log-quick',
      label: '受電ログ登録',
      shortLabel: '受電ログ',
      color: 'primary',
      variant: 'contained',
      accent: '#2B6CB0',
      testId: 'footer-action-call-log-quick',
      kind: 'dialog',
      onClickKey: 'call-log-quick',
    },
    {
      key: 'handoff-quicknote',
      label: '今すぐ申し送り',
      shortLabel: '申し送り',
      color: 'secondary',
      variant: 'contained',
      accent: '#C53030',
      testId: TESTIDS['handoff-footer-quicknote'],
      kind: 'dialog',
      onClickKey: 'handoff-quicknote',
    },
  ];

  actions.push(
    {
      key: 'daily-attendance',
      label: '通所管理',
      shortLabel: '通所',
      color: 'info',
      variant: 'contained',
      accent: '#2F855A',
      testId: TESTIDS.footer.dailyFooterAttendance,
      kind: 'link',
      to: '/daily/attendance',
    },
    {
      key: 'daily-activity',
      label: '日々の記録',
      shortLabel: '日々の記録',
      color: 'primary',
      variant: 'contained',
      accent: '#C05621',
      testId: TESTIDS.footer.dailyFooterActivity,
      kind: 'link',
      to: '/daily/table',
    },
    {
      key: 'daily-support',
      label: '支援手順の実施',
      shortLabel: '支援手順',
      color: 'primary',
      variant: 'outlined',
      accent: '#6B46C1',
      testId: TESTIDS['daily-footer-support'],
      kind: 'link',
      to: '/daily/support',
    },
  );

  return actions;
};

// ─── Derived constants (for Diagnostics / CI) ────────────────────────

/** Compute footer link hrefs from config (replaces old static FOOTER_HREFS). */
export const getFooterHrefs = (params: CreateFooterActionsParams = {}): string[] =>
  createFooterActions(params)
    .filter((a): a is FooterAction & { to: string } => a.kind === 'link' && Boolean(a.to))
    .map((a) => a.to);

/**
 * Static snapshot for router-consistency CI checks.
 * Covers the "all flags on" scenario to maximise coverage.
 */
export const FOOTER_HREFS = getFooterHrefs({ schedulesEnabled: true });
