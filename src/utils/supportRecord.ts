/**
 * Support record utility functions
 *
 * Extracted from SupportRecordPage.tsx for reuse across the support module.
 */

import { defaultSupportSteps } from '@/constants/supportSteps';
import type { DailySupportRecord, SupportRecord, SupportStep } from '@/types/support';

/**
 * Generate support steps with unique IDs for a specific person.
 */
export const generateSupportSteps = (userId: string): SupportStep[] => {
  return defaultSupportSteps.map((step, index) => ({
    ...step,
    id: `${userId}-step-${String(index + 1).padStart(2, '0')}`,
  }));
};

/**
 * Generate an empty support record for a given person, date, and step.
 * Uses deterministic IDs for stability.
 */
export const generateEmptyRecord = (
  userId: string,
  userName: string,
  date: string,
  step: SupportStep,
): SupportRecord => ({
  id: parseInt(`${userId.replace(/\D/g, '')}${step.stepNumber.toString().padStart(2, '0')}${date.replace(/-/g, '')}`),
  supportPlanId: `plan-${userId}`,
  userId,
  userName,
  date,
  stepId: step.id,
  stepNumber: step.stepNumber,
  implemented: false,
  userResponse: {
    notes: '',
  },
  supportEvaluation: {},
  reporter: {
    name: '',
  },
  status: '未実施',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Mock support user type (for demo data generation).
 */
export interface MockSupportUser {
  id: string;
  name: string;
  planType: string;
  isActive: boolean;
}

/**
 * Generate mock daily support record with deterministic data based on user ID.
 */
export const generateMockDailyRecord = (
  user: MockSupportUser,
  date: string,
): DailySupportRecord => {
  const steps = generateSupportSteps(user.id);
  const records = steps.map((step) => generateEmptyRecord(user.id, user.name, date, step));

  // Deterministic implemented indices based on user ID
  const userIdNum = parseInt(user.id.replace(/\D/g, '')) || 1;
  const baseImplemented = [0, 1, 3, 4, 5, 7, 9, 10, 11, 12, 14, 16];
  const implementedIndices = baseImplemented.slice(0, Math.min(baseImplemented.length, 8 + (userIdNum % 8)));

  implementedIndices.forEach((index) => {
    if (records[index]) {
      records[index].implemented = true;
      records[index].status = '実施済み';
      records[index].implementedAt = `${9 + Math.floor(index / 2)}:${(index % 2) * 30}`.padEnd(5, '0');

      // Deterministic response generation
      const responseIndex = (userIdNum + index) % 3;
      records[index].userResponse = {
        mood: (['良好', '普通', '不安定'] as const)[responseIndex],
        participation: (['積極的', '普通', '消極的'] as const)[responseIndex],
        understanding: (['理解良好', '部分理解'] as const)[(userIdNum + index) % 2],
        notes: `Step ${index + 1}の実施記録です。本人は${['協力的', '普通', '少し困惑気味'][responseIndex]}でした。`,
      };
      records[index].supportEvaluation = {
        effectiveness: (['効果的', '部分的効果'] as const)[(userIdNum + index) % 2],
        nextAction: (['継続', '方法変更'] as const)[(userIdNum + index) % 2],
      };
      records[index].reporter = {
        name: '支援員A',
        role: '生活支援員',
      };
    }
  });

  return {
    id: parseInt(`${userIdNum}${date.replace(/-/g, '')}`),
    supportPlanId: `plan-${user.id}`,
    userId: user.id,
    userName: user.name,
    date,
    records,
    summary: {
      totalSteps: 19,
      implementedSteps: implementedIndices.length,
      effectiveSteps: implementedIndices.length - Math.min(2, implementedIndices.length),
      improvementNeeded: Math.min(2, implementedIndices.length),
      overallProgress: implementedIndices.length >= 15 ? '良好' : implementedIndices.length >= 10 ? '順調' : '要注意',
    },
    completedBy: '支援員A',
    status: implementedIndices.length >= 15 ? '完了' : implementedIndices.length >= 5 ? '作成中' : '未作成',
  };
};
