/**
 * @fileoverview Exception Center 集約ロジック
 * @description
 * 施設全体の例外を監視・分析するための要約モデルを構築する。
 */
import type { ExceptionItem, ExceptionSeverity, ExceptionCategory } from './exceptionLogic';
import { SEVERITY_ORDER } from './exceptionLogic';

export type UserExceptionGroup = {
  userId: string;
  userName: string;
  items: ExceptionItem[];
  criticalCount: number;
  maxSeverity: ExceptionSeverity;
};

export type ExceptionAgingInfo = {
  itemId: string;
  hoursElapsed: number;
  isStale: boolean; // 2時間以上経過
  isOverdue: boolean; // 日付を跨いでいる
};

export type ExceptionCenterSummary = {
  totalCount: number;
  groups: UserExceptionGroup[];
  stats: {
    bySeverity: Record<ExceptionSeverity, number>;
    byCategory: Record<ExceptionCategory, number>;
  };
  highRiskUserIds: string[];
};

/**
 * 経過時間の計算
 */
export function computeExceptionAging(item: ExceptionItem, now: Date = new Date()): ExceptionAgingInfo {
  const updated = new Date(item.updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  const hoursElapsed = Math.floor(diffMs / (1000 * 60 * 60));

  const isStale = hoursElapsed >= 2;
  const isOverdue = updated.getDate() !== now.getDate();

  return {
    itemId: item.id,
    hoursElapsed,
    isStale,
    isOverdue
  };
}

/**
 * 利用者単位での集約
 */
export function summarizeExceptionsByUser(items: ExceptionItem[]): UserExceptionGroup[] {
  const groupMap = new Map<string, UserExceptionGroup>();

  for (const item of items) {
    const userId = item.targetUserId || 'unknown';
    const userName = item.targetUser || '不明な利用者';

    if (!groupMap.has(userId)) {
      groupMap.set(userId, {
        userId,
        userName,
        items: [],
        criticalCount: 0,
        maxSeverity: 'low'
      });
    }

    const group = groupMap.get(userId)!;
    group.items.push(item);

    if (item.severity === 'critical') {
      group.criticalCount++;
    }

    if (SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[group.maxSeverity]) {
      group.maxSeverity = item.severity;
    }
  }

  return Array.from(groupMap.values()).sort((a, b) => {
    // 1. クリティカル件数順
    if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
    // 2. 最大重要度順
    return SEVERITY_ORDER[a.maxSeverity] - SEVERITY_ORDER[b.maxSeverity];
  });
}

/**
 * 総合サマリの構築
 */
export function buildExceptionCenterSummary(items: ExceptionItem[]): ExceptionCenterSummary {
  const groups = summarizeExceptionsByUser(items);
  const highRiskUserIds = groups
    .filter(g => g.maxSeverity === 'critical' || g.criticalCount > 0)
    .map(g => g.userId);

  const statsBySeverity: Record<ExceptionSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const statsByCategory: Record<string, number> = {}; 

  for (const item of items) {
    statsBySeverity[item.severity]++;
    statsByCategory[item.category] = (statsByCategory[item.category] || 0) + 1;
  }

  return {
    totalCount: items.length,
    groups,
    stats: {
      bySeverity: statsBySeverity,
      byCategory: statsByCategory as Record<ExceptionCategory, number>
    },
    highRiskUserIds
  };
}
