import { z } from 'zod';

// ---------------------------------------------------------------------------
// Assessment Zod Schemas — localStorage 復元時のバリデーション用
// ---------------------------------------------------------------------------

const sensoryProfileSchema = z.object({
  visual: z.number(),
  auditory: z.number(),
  tactile: z.number(),
  olfactory: z.number(),
  vestibular: z.number(),
  proprioceptive: z.number(),
});

const assessmentItemSchema = z.object({
  id: z.string(),
  category: z.enum(['body', 'activity', 'environment', 'personal']),
  topic: z.string(),
  status: z.enum(['strength', 'neutral', 'challenge']),
  description: z.string(),
});

export const userAssessmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  updatedAt: z.string(),
  items: z.array(assessmentItemSchema),
  sensory: sensoryProfileSchema,
  analysisTags: z.array(z.string()),
});

/**
 * localStorage に保存する envelope 形式。
 * version キーにより将来のスキーマ移行を安全に行う。
 */
export const assessmentStoreSchema = z.object({
  version: z.literal(1),
  data: z.record(z.string(), userAssessmentSchema),
});

export type AssessmentStorePayload = z.infer<typeof assessmentStoreSchema>;

/** localStorage key — shared between store and hub page */
export const ASSESSMENT_DRAFT_KEY = 'assessmentDraft.v1';
