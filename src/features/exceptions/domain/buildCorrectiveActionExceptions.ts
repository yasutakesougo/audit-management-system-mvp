/**
 * buildCorrectiveActionExceptions
 *
 * Action Engine 提案を「利用者 parent + 提案 child」構造の ExceptionItem[] に変換する。
 * ExceptionCenter では parent を折りたたみ単位として扱い、child を個別対応単位にする。
 */

import type {
  ActionSuggestion,
  SuggestionPriority,
} from '@/features/action-engine/domain/types';
import {
  MAX_SUGGESTIONS_PER_USER,
} from '@/features/action-engine/domain/types';
import type { ExceptionItem, ExceptionSeverity } from './exceptionLogic';
import { mapSuggestionToException } from './mapSuggestionToException';

export type BuildCorrectiveActionExceptionsOptions = {
  suggestions: ActionSuggestion[];
  maxChildrenPerUser?: number;
  userNames?: Record<string, string>;
};

const PRIORITY_RANK: Record<SuggestionPriority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
};

const PRIORITY_TO_SEVERITY: Record<SuggestionPriority, ExceptionSeverity> = {
  P0: 'critical',
  P1: 'high',
  P2: 'medium',
};

function toTimestamp(iso: string): number {
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function normalizeUserId(userId: string | undefined): string | null {
  if (!userId) return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildParentId(userId: string): string {
  return `corrective-user-${encodeURIComponent(userId)}`;
}

function resolveUserName(userId: string, userNames?: Record<string, string>): string {
  return userNames?.[userId] ?? userId;
}

export function buildCorrectiveActionExceptions(
  options: BuildCorrectiveActionExceptionsOptions,
): ExceptionItem[] {
  const {
    suggestions,
    userNames,
    maxChildrenPerUser = MAX_SUGGESTIONS_PER_USER,
  } = options;

  const groups = new Map<string, ActionSuggestion[]>();

  for (const suggestion of suggestions) {
    const userId = normalizeUserId(suggestion.targetUserId);
    if (!userId) continue;

    const group = groups.get(userId) ?? [];
    group.push(suggestion);
    groups.set(userId, group);
  }

  const result: ExceptionItem[] = [];

  for (const [userId, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
    });

    const childrenSource = sorted.slice(0, maxChildrenPerUser);
    if (childrenSource.length === 0) continue;

    const parentId = buildParentId(userId);
    const userName = resolveUserName(userId, userNames);

    const highestPriority = childrenSource.reduce<SuggestionPriority>(
      (best, current) => (
        PRIORITY_RANK[current.priority] < PRIORITY_RANK[best]
          ? current.priority
          : best
      ),
      childrenSource[0].priority,
    );

    const latestCreatedAt = childrenSource.reduce(
      (latest, current) => (
        toTimestamp(current.createdAt) > toTimestamp(latest)
          ? current.createdAt
          : latest
      ),
      childrenSource[0].createdAt,
    );

    const hiddenCount = Math.max(0, group.length - childrenSource.length);
    const hiddenLabel = hiddenCount > 0 ? `（他 ${hiddenCount} 件）` : '';

    result.push({
      id: parentId,
      category: 'corrective-action',
      severity: PRIORITY_TO_SEVERITY[highestPriority],
      title: `${userName} の改善提案`,
      description: `${childrenSource.length}件の提案があります。優先度の高い項目から確認してください。${hiddenLabel}`,
      targetUser: userName,
      targetUserId: userId,
      targetDate: latestCreatedAt.split('T')[0],
      updatedAt: latestCreatedAt,
      actionLabel: `${userName}の提案を確認`,
      actionPath: `/users/${encodeURIComponent(userId)}`,
    });

    for (const suggestion of childrenSource) {
      const child = mapSuggestionToException(suggestion);
      result.push({
        ...child,
        parentId,
        targetUser: userName,
      });
    }
  }

  return result;
}
