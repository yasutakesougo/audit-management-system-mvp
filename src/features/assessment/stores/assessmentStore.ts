import { ASSESSMENT_DRAFT_KEY, assessmentStoreSchema } from '@/features/assessment/domain/assessmentSchema';
import { createDefaultAssessment, type UserAssessment } from '@/features/assessment/domain/types';
import { useCallback } from 'react';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = ASSESSMENT_DRAFT_KEY;
const DEBOUNCE_MS = 600;

function loadFromStorage(): Record<string, UserAssessment> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = assessmentStoreSchema.parse(JSON.parse(raw));
    return parsed.data;
  } catch {
    // 破損 or スキーマ不一致 → 破棄してクリーンスタート
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function persistToStorage() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const { assessments } = useAssessmentStoreBase.getState();
    const payload = { version: 1 as const, data: assessments };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, DEBOUNCE_MS);
}

/** テスト用: debounce を即座にフラッシュ */
export function __flushPersist() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  const { assessments } = useAssessmentStoreBase.getState();
  const payload = { version: 1 as const, data: assessments };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

interface AssessmentStoreState {
  assessments: Record<string, UserAssessment>;
}

const useAssessmentStoreBase = create<AssessmentStoreState>()(() => ({
  assessments: loadFromStorage(),
}));

const saveAssessment = (data: UserAssessment) => {
  useAssessmentStoreBase.setState((state) => ({
    assessments: {
      ...state.assessments,
      [data.userId]: {
        ...data,
        updatedAt: new Date().toISOString(),
      },
    },
  }));
  persistToStorage();
};

/**
 * 指定ユーザーのドラフトを削除する（完了/送信時に呼び出し）
 */
export function clearAssessmentDraft(userId: string) {
  useAssessmentStoreBase.setState((state) => {
    const { [userId]: _, ...rest } = state.assessments;
    return { assessments: rest };
  });
  persistToStorage();
}

/**
 * テスト用: store をリセットし localStorage から再読み込み
 */
export function __resetStore() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  useAssessmentStoreBase.setState({ assessments: loadFromStorage() });
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useAssessmentStore() {
  const store = useAssessmentStoreBase((s) => s.assessments);

  const getByUserId = useCallback(
    (userId: string): UserAssessment => {
      return store[userId] ?? createDefaultAssessment(userId);
    },
    [store],
  );

  const save = useCallback((data: UserAssessment) => {
    saveAssessment(data);
  }, []);

  const seedDemoData = useCallback(
    (userId: string) => {
      if (store[userId]) return;

      saveAssessment({
        ...createDefaultAssessment(userId),
        id: 'demo-assess-01',
        sensory: {
          visual: 4,
          auditory: 5,
          tactile: 2,
          olfactory: 3,
          vestibular: 3,
          proprioceptive: 4,
        },
        items: [
          { id: '1', category: 'body', topic: '睡眠', status: 'challenge', description: '中途覚醒あり' },
          { id: '2', category: 'activity', topic: '手先', status: 'strength', description: '細かい作業が得意' },
        ],
        analysisTags: ['聴覚過敏', '手先が器用', '睡眠不足'],
      });
    },
    [store],
  );

  return {
    getByUserId,
    save,
    seedDemoData,
    clearDraft: clearAssessmentDraft,
  } as const;
}
