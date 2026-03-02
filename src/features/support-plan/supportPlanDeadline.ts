/**
 * Support Plan — Deadline calculation logic
 * Extracted from SupportPlanGuidePage.tsx for single-responsibility.
 */

// ── Types ──
export type DeadlineInfo = {
  label: string;
  date?: Date;
  daysLeft?: number; // 正数: 期限までの日数 / 負数: 経過日数
  color: 'default' | 'success' | 'warning' | 'error';
  tooltip?: string;
};

// ── Date helpers ──
export const toDate = (s: string | undefined): Date | undefined => {
  if (!s) return undefined;
  const m = s.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(dt.getTime()) ? undefined : dt;
};

export const parsePlanPeriod = (period: string): { start?: Date; end?: Date } => {
  if (!period) return {};
  const parts = period.split(/~|〜/).map((s) => s.trim());
  return { start: toDate(parts[0]), end: toDate(parts[1]) };
};

export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // handle month-end overflow
  if (d.getDate() < day) d.setDate(0);
  return d;
};

export const formatDateJP = (d?: Date): string =>
  d ? `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : '';

export const daysDiff = (a: Date, b: Date): number =>
  Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));

// ── SupportPlanForm shape (minimal for deadline computation) ──
export type SupportPlanFormForDeadline = {
  planPeriod: string;
  lastMonitoringDate: string;
};

// ── Core computation ──
export const computeDeadlineInfo = (
  form: SupportPlanFormForDeadline,
): { creation: DeadlineInfo; monitoring: DeadlineInfo } => {
  const now = new Date();
  const { start, end } = parsePlanPeriod(form.planPeriod);

  // 作成期限: 計画期間の開始日 + 30日
  let creationDate: Date | undefined = start ? new Date(start) : undefined;
  if (creationDate) creationDate = new Date(creationDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const creationDaysLeft = creationDate ? daysDiff(creationDate, now) : undefined;
  let creationColor: DeadlineInfo['color'] = 'default';
  if (creationDaysLeft !== undefined) {
    if (creationDaysLeft < 0) creationColor = 'error';
    else if (creationDaysLeft <= 7) creationColor = 'warning';
    else creationColor = 'success';
  }

  // 次回モニタ期限: 直近モニタ実施日 + 6か月（無ければ計画開始 + 6か月）
  const lastMon = toDate(form.lastMonitoringDate);
  let monitoringDate: Date | undefined = lastMon ? addMonths(lastMon, 6) : start ? addMonths(start, 6) : undefined;
  if (monitoringDate && end && end.getTime() < monitoringDate.getTime()) monitoringDate = end;
  const monitoringDaysLeft = monitoringDate ? daysDiff(monitoringDate, now) : undefined;
  let monitoringColor: DeadlineInfo['color'] = 'default';
  if (monitoringDaysLeft !== undefined) {
    if (monitoringDaysLeft < 0) monitoringColor = 'error';
    else if (monitoringDaysLeft <= 14) monitoringColor = 'warning';
    else monitoringColor = 'success';
  }

  return {
    creation: {
      label: '作成期限(開始+30日)',
      date: creationDate,
      daysLeft: creationDaysLeft,
      color: creationColor,
      tooltip: creationDate ? `期限: ${formatDateJP(creationDate)} / 残り: ${creationDaysLeft}日` : '計画期間(開始日)が未入力',
    },
    monitoring: {
      label: '次回モニタ期限(6か月)',
      date: monitoringDate,
      daysLeft: monitoringDaysLeft,
      color: monitoringColor,
      tooltip: monitoringDate ? `期限: ${formatDateJP(monitoringDate)} / 残り: ${monitoringDaysLeft}日` : '計画期間(開始日)が未入力',
    },
  };
};
