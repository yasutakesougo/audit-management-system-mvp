import type {
  IspRecommendation,
  IspRecommendationLevel,
  IspRecommendationSummary,
} from '@/features/monitoring/domain/ispRecommendationTypes';
import {
  ISP_RECOMMENDATION_LABELS,
  ISP_RECOMMENDATION_SEVERITY,
} from '@/features/monitoring/domain/ispRecommendationTypes';

import type { TodaySignal } from '../types/todaySignal.types';

export type IspRenewSuggestImpact = 'low' | 'high';

export interface IspRenewSuggestSignalPayload extends Record<string, unknown> {
  userId: string;
  sourceRef: string;
  reason: string;
  impact: IspRenewSuggestImpact;
  createdAt: string;
}

export interface BuildIspRenewSuggestSignalInput {
  userId: string;
  recommendationSummary?: IspRecommendationSummary | null;
  sourceRef: string;
  createdAt?: string;
  actionPath?: string;
}

const REVIEW_TRIGGER_LEVELS = new Set<IspRecommendationLevel>([
  'adjust-support',
  'revise-goal',
  'urgent-review',
]);

export function mapIspRecommendationToTodaySignal(
  input: BuildIspRenewSuggestSignalInput,
): TodaySignal | null {
  const userId = input.userId.trim();
  if (!userId) return null;

  const summary = input.recommendationSummary;
  if (!summary || summary.recommendations.length === 0) return null;

  const topReviewRecommendation = resolveTopReviewRecommendation(summary.recommendations);
  if (!topReviewRecommendation) return null;

  const createdAt = input.createdAt ?? new Date().toISOString();
  const impact = toImpact(topReviewRecommendation.level);
  const payload: IspRenewSuggestSignalPayload = {
    userId,
    sourceRef: input.sourceRef,
    reason: topReviewRecommendation.reason,
    impact,
    createdAt,
  };

  return {
    id: buildSignalId(userId, input.sourceRef),
    code: 'isp_renew_suggest',
    domain: 'Monitoring',
    priority: 'P2',
    audience: ['admin'],
    title: `利用者 ${userId} の ISP見直しを推奨`,
    description: `${ISP_RECOMMENDATION_LABELS[topReviewRecommendation.level]}: ${topReviewRecommendation.reason}`,
    actionPath:
      input.actionPath ??
      `/support-plan-guide?userId=${encodeURIComponent(userId)}&tab=operations.monitoring`,
    metadata: payload,
  };
}

function resolveTopReviewRecommendation(
  recommendations: IspRecommendation[],
): IspRecommendation | null {
  const candidates = recommendations.filter((rec) => REVIEW_TRIGGER_LEVELS.has(rec.level));
  if (candidates.length === 0) return null;

  return candidates.sort(
    (a, b) => ISP_RECOMMENDATION_SEVERITY[b.level] - ISP_RECOMMENDATION_SEVERITY[a.level],
  )[0] ?? null;
}

function toImpact(level: IspRecommendationLevel): IspRenewSuggestImpact {
  if (level === 'revise-goal' || level === 'urgent-review') return 'high';
  return 'low';
}

function buildSignalId(userId: string, sourceRef: string): string {
  return `isp_renew_suggest:${normalizeKeyPart(userId)}:${normalizeKeyPart(sourceRef)}`;
}

function normalizeKeyPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unknown';
}
