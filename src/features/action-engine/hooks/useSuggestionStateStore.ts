import { create } from 'zustand';
import type { ActionSuggestionState } from '../domain/types';

export type SuggestionStateMeta = {
  by?: string;
  reason?: string;
};

export type SuggestionStateStore = {
  states: Record<string, ActionSuggestionState>;
  dismiss: (stableId: string, meta?: SuggestionStateMeta) => void;
  snooze: (stableId: string, until: string, meta?: SuggestionStateMeta) => void;
  reopen: (stableId: string) => void;
};

function buildBaseState(
  stableId: string,
  meta: SuggestionStateMeta | undefined,
): Pick<ActionSuggestionState, 'stableId' | 'updatedAt' | 'updatedBy' | 'reason'> {
  return {
    stableId,
    updatedAt: new Date().toISOString(),
    updatedBy: meta?.by,
    reason: meta?.reason,
  };
}

export const useSuggestionStateStore = create<SuggestionStateStore>((set) => ({
  states: {},

  dismiss: (stableId, meta) =>
    set((state) => ({
      states: {
        ...state.states,
        [stableId]: {
          ...buildBaseState(stableId, meta),
          status: 'dismissed',
        },
      },
    })),

  snooze: (stableId, until, meta) =>
    set((state) => ({
      states: {
        ...state.states,
        [stableId]: {
          ...buildBaseState(stableId, meta),
          status: 'snoozed',
          snoozedUntil: until,
        },
      },
    })),

  reopen: (stableId) =>
    set((state) => ({
      states: {
        ...state.states,
        [stableId]: {
          stableId,
          status: 'open',
          updatedAt: new Date().toISOString(),
        },
      },
    })),
}));
