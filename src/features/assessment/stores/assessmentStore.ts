import { createDefaultAssessment, type UserAssessment } from '@/features/assessment/domain/types';
import { useCallback, useSyncExternalStore } from 'react';

let assessments: Record<string, UserAssessment> = {};
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getAssessmentSnapshot = () => assessments;

const saveAssessment = (data: UserAssessment) => {
  assessments = {
    ...assessments,
    [data.userId]: {
      ...data,
      updatedAt: new Date().toISOString(),
    },
  };
  emit();
};

export function useAssessmentStore() {
  const store = useSyncExternalStore(subscribe, getAssessmentSnapshot, getAssessmentSnapshot);

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
  } as const;
}
