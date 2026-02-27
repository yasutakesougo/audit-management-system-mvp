/**
 * userStatusUtils
 *
 * ユーザー一覧テーブルの状態可視化ロジック（ピュア関数）。
 * - チップ生成
 * - 支給決定期限の緊急度判定
 * - 重要順ソート
 */
import type { IUserMaster } from '../types';
import { USAGE_STATUS_VALUES } from '../typesExtended';

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type ChipColor = 'success' | 'error' | 'warning' | 'info' | 'default';

export type StatusChip = {
  label: string;
  color: ChipColor;
  /** MUI Chip の variant */
  variant?: 'filled' | 'outlined';
  /** tooltip（溢れた場合や補足用） */
  tooltip?: string;
  /** 内部優先度（小さいほど優先） */
  priority: number;
};

export type GrantUrgency = 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';

// ---------------------------------------------------------------------------
// 支給決定期限の緊急度
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getGrantPeriodUrgency(
  user: Pick<IUserMaster, 'GrantPeriodEnd'>,
  now: Date = new Date(),
): GrantUrgency {
  const raw = user.GrantPeriodEnd;
  if (!raw) return 'unknown';

  const end = new Date(raw);
  if (Number.isNaN(end.getTime())) return 'unknown';

  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / MS_PER_DAY);

  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'critical';
  if (diffDays <= 30) return 'warning';
  return 'ok';
}

// ---------------------------------------------------------------------------
// チップ生成
// ---------------------------------------------------------------------------

const MAX_VISIBLE_CHIPS = 3;

function resolveUsageLabel(user: Pick<IUserMaster, 'IsActive' | 'UsageStatus'>): {
  label: string;
  color: ChipColor;
} {
  const status = user.UsageStatus;
  if (status === USAGE_STATUS_VALUES.TERMINATED) {
    return { label: '終了', color: 'default' };
  }
  if (status === USAGE_STATUS_VALUES.SUSPENDED || user.IsActive === false) {
    return { label: '休止', color: 'default' };
  }
  if (status === USAGE_STATUS_VALUES.PENDING) {
    return { label: '開始待ち', color: 'info' };
  }
  return { label: '利用中', color: 'success' };
}

export function getUserStatusChips(
  user: IUserMaster,
  now: Date = new Date(),
): { visible: StatusChip[]; overflow: StatusChip[] } {
  const chips: StatusChip[] = [];

  // 1) 利用状態（常に表示）
  const usage = resolveUsageLabel(user);
  chips.push({ label: usage.label, color: usage.color, priority: 1 });

  // 2) 重度フラグ
  if (user.severeFlag) {
    chips.push({ label: '重度', color: 'error', priority: 2 });
  }

  // 3) 支給決定期限
  const urgency = getGrantPeriodUrgency(user, now);
  if (urgency === 'expired') {
    chips.push({ label: '期限切れ', color: 'error', priority: 3 });
  } else if (urgency === 'critical') {
    chips.push({ label: '期限7日', color: 'error', priority: 3 });
  } else if (urgency === 'warning') {
    chips.push({ label: '期限30日', color: 'warning', priority: 3 });
  }

  // 4) selectMode（full以外のみ）
  const mode = user.__selectMode;
  if (mode === 'core') {
    chips.push({
      label: 'CORE',
      color: 'default',
      variant: 'outlined',
      tooltip: 'FULL fields not available (missing columns?). Fallback applied.',
      priority: 4,
    });
  } else if (mode === 'detail') {
    chips.push({
      label: 'DETAIL',
      color: 'info',
      variant: 'outlined',
      tooltip: 'Billing addon fields not available. Detail-level data.',
      priority: 4,
    });
  }

  // sort by priority, then split visible / overflow
  chips.sort((a, b) => a.priority - b.priority);

  const visible = chips.slice(0, MAX_VISIBLE_CHIPS);
  const overflow = chips.slice(MAX_VISIBLE_CHIPS);

  return { visible, overflow };
}

// ---------------------------------------------------------------------------
// 行の inactive 判定
// ---------------------------------------------------------------------------

export function isUserInactive(user: Pick<IUserMaster, 'IsActive' | 'UsageStatus'>): boolean {
  if (user.IsActive === false) return true;
  const status = user.UsageStatus;
  return status === USAGE_STATUS_VALUES.TERMINATED || status === USAGE_STATUS_VALUES.SUSPENDED;
}

// ---------------------------------------------------------------------------
// 重要順ソート
// ---------------------------------------------------------------------------

/** urgency → 数値（小 = 高優先） */
const URGENCY_ORDER: Record<GrantUrgency, number> = {
  expired: 0,
  critical: 1,
  warning: 2,
  unknown: 3,
  ok: 4,
};

const SELECT_MODE_ORDER: Record<string, number> = {
  core: 0,
  detail: 1,
  full: 2,
};

export function sortUsersByPriority(users: IUserMaster[], now: Date = new Date()): IUserMaster[] {
  return [...users].sort((a, b) => {
    // 1. urgency
    const ua = URGENCY_ORDER[getGrantPeriodUrgency(a, now)];
    const ub = URGENCY_ORDER[getGrantPeriodUrgency(b, now)];
    if (ua !== ub) return ua - ub;

    // 2. selectMode (core first = needs attention)
    const ma = SELECT_MODE_ORDER[a.__selectMode ?? 'full'] ?? 2;
    const mb = SELECT_MODE_ORDER[b.__selectMode ?? 'full'] ?? 2;
    if (ma !== mb) return ma - mb;

    // 3. severeFlag (true first)
    const sa = a.severeFlag ? 0 : 1;
    const sb = b.severeFlag ? 0 : 1;
    if (sa !== sb) return sa - sb;

    // 4. active (inactive last)
    const aa = isUserInactive(a) ? 1 : 0;
    const ab = isUserInactive(b) ? 1 : 0;
    if (aa !== ab) return aa - ab;

    // 5. tie-break: UserID then Id
    const userIdCmp = (a.UserID ?? '').localeCompare(b.UserID ?? '');
    if (userIdCmp !== 0) return userIdCmp;
    return (a.Id ?? 0) - (b.Id ?? 0);
  });
}
