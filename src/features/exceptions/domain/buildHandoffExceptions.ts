/**
 * buildHandoffExceptions
 *
 * 重要申し送りを「利用者 parent + 申し送り child」構造の ExceptionItem[] に変換する。
 * ExceptionCenter では parent を折りたたみ単位、child を個別対応単位として扱う。
 */

import type { ExceptionItem, ExceptionSeverity, HandoffSummaryItem } from './exceptionLogic';

export type BuildHandoffExceptionsOptions = {
  handoffs: HandoffSummaryItem[];
  maxChildrenPerUser?: number;
  userNames?: Record<string, string>;
};

const DEFAULT_MAX_CHILDREN_PER_USER = 5;

const SEVERITY_RANK: Record<ExceptionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function normalize(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestamp(iso: string): number {
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function toIsoDate(input: string): string {
  const direct = input.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

  const ts = Date.parse(input);
  if (!Number.isNaN(ts)) {
    return new Date(ts).toISOString().split('T')[0];
  }

  return '1970-01-01';
}

function buildParentId(userId: string): string {
  return `handoff-user-${encodeURIComponent(userId)}`;
}

function resolveUserName(
  item: HandoffSummaryItem,
  userId: string,
  userNames?: Record<string, string>,
): string {
  return userNames?.[userId] ?? item.userName ?? userId;
}

function isCriticalUnresolved(item: HandoffSummaryItem): boolean {
  return (
    item.severity === '重要' &&
    item.status !== '完了' &&
    item.status !== '確認済'
  );
}

function toChildSeverity(status: string): ExceptionSeverity {
  if (status === '未対応') return 'critical';
  return 'high';
}

function highestSeverity(items: ExceptionItem[]): ExceptionSeverity {
  if (items.length === 0) return 'low';

  let best: ExceptionSeverity = items[0].severity;
  for (const item of items) {
    if (SEVERITY_RANK[item.severity] < SEVERITY_RANK[best]) {
      best = item.severity;
    }
  }
  return best;
}

export function buildHandoffExceptions(
  options: BuildHandoffExceptionsOptions,
): ExceptionItem[] {
  const {
    handoffs,
    userNames,
    maxChildrenPerUser = DEFAULT_MAX_CHILDREN_PER_USER,
  } = options;

  const groups = new Map<string, HandoffSummaryItem[]>();

  for (const handoff of handoffs) {
    if (!isCriticalUnresolved(handoff)) continue;

    const userId = normalize(handoff.userId);
    if (!userId) continue; // user 不明は安全にスキップ

    const group = groups.get(userId) ?? [];
    group.push(handoff);
    groups.set(userId, group);
  }

  const result: ExceptionItem[] = [];

  for (const [userId, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const sevDiff = SEVERITY_RANK[toChildSeverity(a.status)] - SEVERITY_RANK[toChildSeverity(b.status)];
      if (sevDiff !== 0) return sevDiff;
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    });

    const childrenSource = sorted.slice(0, maxChildrenPerUser);
    if (childrenSource.length === 0) continue;

    const parentId = buildParentId(userId);
    const userName = resolveUserName(childrenSource[0], userId, userNames);

    const children: ExceptionItem[] = childrenSource.map((handoff) => {
      const targetDate = toIsoDate(handoff.createdAt);
      const message = handoff.message || '';
      const snippet = message.length > 60 ? `${message.slice(0, 60)}…` : message;

      return {
        id: `handoff-${handoff.id}`,
        parentId,
        category: 'critical-handoff',
        severity: toChildSeverity(handoff.status),
        title: `${userName}の重要申し送り（${handoff.status}）`,
        description: snippet || '内容を確認してください。',
        targetUser: userName,
        targetUserId: userId,
        targetDate,
        updatedAt: handoff.createdAt || targetDate,
        actionLabel: '申し送りを開く',
        actionPath: `/handoff-timeline?range=day&date=${encodeURIComponent(targetDate)}&handoffId=${encodeURIComponent(String(handoff.id))}`,
      };
    });

    const hiddenCount = Math.max(0, group.length - children.length);
    const hiddenLabel = hiddenCount > 0 ? `（他 ${hiddenCount} 件）` : '';
    const newestChild = children.reduce(
      (latest, current) => (
        toTimestamp(current.updatedAt) > toTimestamp(latest.updatedAt)
          ? current
          : latest
      ),
      children[0],
    );

    result.push({
      id: parentId,
      category: 'critical-handoff',
      severity: highestSeverity(children),
      title: `${userName}の重要申し送り`,
      description: `${children.length}件の未完了申し送りがあります。対応状況を確認してください。${hiddenLabel}`,
      targetUser: userName,
      targetUserId: userId,
      targetDate: newestChild.targetDate,
      updatedAt: newestChild.updatedAt,
      actionLabel: `${userName}の申し送りを確認`,
      actionPath: `/handoff-timeline?range=day&date=${encodeURIComponent(newestChild.targetDate ?? '1970-01-01')}&userCode=${encodeURIComponent(userId)}`,
    });

    result.push(...children);
  }

  return result;
}
