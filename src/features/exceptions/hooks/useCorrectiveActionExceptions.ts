/**
 * useCorrectiveActionExceptions — ExceptionCenter 用の Action Engine 統合 hook
 *
 * Action Engine の純粋関数は1利用者単位だが、ExceptionCenter は全利用者横断。
 * この hook は複数利用者の提案を受け取り、ExceptionItem に変換して返す。
 *
 * ## 設計意図
 * - Phase 1: useBehaviorStore のスナップショットから suggestions を受け取る
 * - Phase 2: 将来的にバッチ計算結果をキャッシュから読む形に拡張可能
 *
 * ExceptionCenterPage はこの hook の戻り値を aggregateExceptions に渡すだけでいい。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ActionSuggestion, ActionSuggestionState } from '@/features/action-engine/domain/types';
import { isSuggestionVisible } from '@/features/action-engine/domain/types';
import { filterSuggestionsByDisplayTiming } from '@/features/action-engine/domain/suggestionDisplayTiming';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import { useSuggestionVisibilityTelemetry } from '@/features/action-engine/telemetry/useSuggestionVisibilityTelemetry';
import { buildCorrectiveActionExceptions } from '@/features/exceptions/domain/buildCorrectiveActionExceptions';
import { useUsers } from '@/features/users/useUsers';

export interface UseCorrectiveActionExceptionsOptions {
  /** 全利用者分の Action Engine 提案（外部から注入） */
  suggestions: ActionSuggestion[];
  /** dismiss / snooze 状態（stableId → state） */
  states: Record<string, ActionSuggestionState>;
  /** snooze 期限再評価の間隔（既定: 60秒） */
  pollingIntervalMs?: number;
}

export interface UseCorrectiveActionExceptionsReturn {
  /** ExceptionItem に変換済みの提案（parent + child） */
  items: ExceptionItem[];
  /** 提案件数（child 件数） */
  count: number;
}

/**
 * Action Engine 提案 → ExceptionItem 変換 hook
 *
 * 1. dismissed / snoozed を除外
 * 2. 利用者ごとに parent + child へ変換
 */
export function useCorrectiveActionExceptions(
  options: UseCorrectiveActionExceptionsOptions,
): UseCorrectiveActionExceptionsReturn {
  const {
    suggestions,
    states,
    pollingIntervalMs = 60_000,
  } = options;
  const [now, setNow] = useState(new Date());
  const { data: users } = useUsers();

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, pollingIntervalMs);
    return () => clearInterval(timer);
  }, [pollingIntervalMs]);

  const timedSuggestions = useMemo(
    () => filterSuggestionsByDisplayTiming(suggestions, now),
    [suggestions, now],
  );

  useSuggestionVisibilityTelemetry({
    suggestions: timedSuggestions,
    states,
    sourceScreen: 'exception-center',
    now,
  });

  const visibleSuggestions = useMemo(() => {
    return timedSuggestions
      .filter((s) => {
        const state = states[s.stableId];
        return isSuggestionVisible(state, now);
      });
  }, [timedSuggestions, states, now]);

  const items = useMemo(() => {
    const userNames: Record<string, string> = {};
    for (const user of users) {
      if (user.UserID && user.FullName) {
        userNames[user.UserID] = user.FullName;
      }
    }

    return buildCorrectiveActionExceptions({
      suggestions: visibleSuggestions,
      userNames,
    });
  }, [users, visibleSuggestions]);

  const count = useMemo(
    () => items.filter((item) => Boolean(item.stableId)).length,
    [items],
  );

  return {
    items,
    count,
  };
}
