/**
 * useGoalActions — Goal CRUD handlers for Support Plan
 *
 * Extracted from useSupportPlanForm for single-responsibility.
 */

import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanDraft } from '../types';

export interface GoalActionsParams {
  activeDraftId: string;
  isAdmin: boolean;
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, SupportPlanDraft>>>;
}

export function useGoalActions({ activeDraftId, isAdmin, setDrafts }: GoalActionsParams) {
  const handleGoalChange = (goalId: string, updates: Partial<GoalItem>) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            goals: target.data.goals.map((g) =>
              g.id === goalId ? { ...g, ...updates } : g,
            ),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleToggleDomain = (goalId: string, domainId: string) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            goals: target.data.goals.map((g) => {
              if (g.id !== goalId) return g;
              const next = g.domains.includes(domainId)
                ? g.domains.filter((d) => d !== domainId)
                : [...g.domains, domainId];
              return { ...g, domains: next };
            }),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleAddGoal = (type: 'long' | 'short' | 'support', defaultLabel: string) => {
    if (!activeDraftId || !isAdmin) return;
    const newGoal: GoalItem = {
      id: crypto.randomUUID(),
      type,
      label: defaultLabel,
      text: '',
      domains: [],
    };
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            goals: [...target.data.goals, newGoal],
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleDeleteGoal = (goalId: string) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            goals: target.data.goals.filter((g) => g.id !== goalId),
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  /** P3-B: 目標候補を採用して goals に追加する */
  const handleAcceptSuggestion = (goal: GoalItem) => {
    if (!activeDraftId || !isAdmin) return;
    setDrafts((prev) => {
      const target = prev[activeDraftId];
      if (!target) return prev;
      return {
        ...prev,
        [activeDraftId]: {
          ...target,
          data: {
            ...target.data,
            goals: [...target.data.goals, goal],
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  return { handleGoalChange, handleToggleDomain, handleAddGoal, handleDeleteGoal, handleAcceptSuggestion };
}
