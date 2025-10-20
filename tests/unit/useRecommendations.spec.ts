import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecommendations } from '../../src/features/recommendations/useRecommendations';
import type { EnvFactorId, MoodId, PersonFactorId, StrengthId } from '../../src/config/master';

vi.stubEnv('VITE_FEATURE_SUPPORT_CDS', 'true');

describe('useRecommendations', () => {
  afterEach(() => {
    vi.stubEnv('VITE_FEATURE_SUPPORT_CDS', 'true');
  });

  it('suggests environmental adjustment when auditory sensitivity is present', () => {
    const recs = useRecommendations({
      strengths: [],
      iceberg: [{ kind: 'person', id: 'auditorySensitivity', label: '聴覚過敏' }],
    });

    expect(recs.some((rec) => rec.id === 'env-noise-1')).toBe(true);
  });

  it('suggests differential reinforcement when attention function is indicated', () => {
    const recsFromAbc = useRecommendations({
      strengths: [],
      iceberg: [],
      abc: { C: '職員の注目を得る' },
    });

    const recsFromMood = useRecommendations({
      strengths: [],
      iceberg: [],
      moodId: 'signsEmerging',
    });

    expect(recsFromAbc.some((rec) => rec.id === 'aba-dra-1')).toBe(true);
    expect(recsFromMood.some((rec) => rec.id === 'aba-dra-1')).toBe(true);
  });

  it('suggests visual schedule when strengths include predictability/visual preference', () => {
    const recs = useRecommendations({
      strengths: ['predictability'],
      iceberg: [],
    });

    expect(recs.some((rec) => rec.id === 'visual-schedule-1')).toBe(true);
  });

  it('normalizes raw label inputs to ids before evaluating rules', () => {
    const recs = useRecommendations({
      strengths: ['見通し' as unknown as StrengthId],
      iceberg: [{ kind: 'person', id: '聴覚過敏' as unknown as PersonFactorId, label: '聴覚過敏' }],
      moodId: 'サインが出ている' as unknown as MoodId,
    });

    expect(recs.some((rec) => rec.id === 'env-noise-1')).toBe(true);
    expect(recs.some((rec) => rec.id === 'aba-dra-1')).toBe(true);
    expect(recs.some((rec) => rec.id === 'visual-schedule-1')).toBe(true);
  });

  it('ignores unknown ids/labels while still applying known matches', () => {
    const recs = useRecommendations({
      strengths: [
        'predictability',
        '未知の強み' as unknown as StrengthId,
      ],
      iceberg: [
        { kind: 'person', id: 'auditorySensitivity', label: '聴覚過敏' },
        { kind: 'environment', id: '不明な環境要因' as unknown as EnvFactorId, label: '不明な環境要因' },
      ],
      abc: { C: '注目を集めるために声を出す' },
      moodId: 'signsEmerging',
    });

    expect(recs.some((rec) => rec.id === 'env-noise-1')).toBe(true);
    expect(recs.some((rec) => rec.id === 'aba-dra-1')).toBe(true);
    expect(recs.some((rec) => rec.id === 'visual-schedule-1')).toBe(true);
    expect(recs).toHaveLength(3);
  });

  it('returns an empty array when the feature flag is off', () => {
    vi.stubEnv('VITE_FEATURE_SUPPORT_CDS', 'false');

    const recs = useRecommendations({
      strengths: ['predictability'],
      iceberg: [{ kind: 'person', id: 'auditorySensitivity', label: '聴覚過敏' }],
      abc: { C: '職員の注目を得る' },
      moodId: 'signsEmerging',
    });

    expect(recs).toEqual([]);
  });
});
