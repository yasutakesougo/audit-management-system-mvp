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

export const createFooterActions = ({
  schedulesEnabled = false,
}: CreateFooterActionsParams): FooterAction[] => {
  const actions: FooterAction[] = [
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

  if (schedulesEnabled) {
    actions.push({
      key: 'schedules-month',
      label: 'スケジュール',
      shortLabel: '予定',
      color: 'info',
      variant: 'contained',
      accent: '#B7791F',
      testId: TESTIDS['schedules-footer-month'],
      kind: 'link',
      to: '/schedules/month',
    });
  }

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
      label: 'ケース記録入力',
      shortLabel: 'ケース記録',
      color: 'primary',
      variant: 'contained',
      accent: '#C05621',
      testId: TESTIDS.footer.dailyFooterActivity,
      kind: 'link',
      to: '/daily/table',
    },
    {
      key: 'daily-support',
      label: '支援手順記録入力',
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
