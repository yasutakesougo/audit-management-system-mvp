import { sensoryToAssessmentItems } from '@/features/analysis/domain/sensoryToAssessmentItems';
import type { SensoryProfile } from '@/features/assessment/domain/types';
import { describe, expect, it } from 'vitest';

describe('sensoryToAssessmentItems', () => {
  const DEFAULT_PROFILE: SensoryProfile = {
    visual: 3,
    auditory: 3,
    tactile: 3,
    olfactory: 3,
    vestibular: 3,
    proprioceptive: 3,
  };

  it('全スコア3（定型）→ 空配列を返す', () => {
    const result = sensoryToAssessmentItems(DEFAULT_PROFILE);
    expect(result).toEqual([]);
  });

  it('過敏 (≥4) の項目をフィルタする', () => {
    const profile: SensoryProfile = { ...DEFAULT_PROFILE, auditory: 5 };
    const result = sensoryToAssessmentItems(profile);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'sensory-auditory',
      topic: '聴覚: 過敏',
      status: 'challenge',
      category: 'body',
    });
    expect(result[0].description).toContain('5');
    expect(result[0].description).toContain('過敏');
  });

  it('鈍麻 (≤2) の項目をフィルタする', () => {
    const profile: SensoryProfile = { ...DEFAULT_PROFILE, tactile: 1 };
    const result = sensoryToAssessmentItems(profile);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'sensory-tactile',
      topic: '触覚: 鈍麻',
      status: 'challenge',
      category: 'body',
    });
    expect(result[0].description).toContain('1');
    expect(result[0].description).toContain('鈍麻');
  });

  it('過敏＋鈍麻の複合ケースを正しく返す', () => {
    const profile: SensoryProfile = {
      ...DEFAULT_PROFILE,
      auditory: 5,
      tactile: 1,
    };
    const result = sensoryToAssessmentItems(profile);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.id)).toEqual(['sensory-auditory', 'sensory-tactile']);
  });

  it('ボーダースコア4は過敏、2は鈍麻として扱う', () => {
    const profile: SensoryProfile = {
      ...DEFAULT_PROFILE,
      visual: 4,
      vestibular: 2,
    };
    const result = sensoryToAssessmentItems(profile);

    expect(result).toHaveLength(2);
    expect(result[0].topic).toBe('視覚: 過敏');
    expect(result[1].topic).toBe('前庭覚: 鈍麻');
  });

  it('全スコア閾値超え → 6件返す', () => {
    const profile: SensoryProfile = {
      visual: 5,
      auditory: 5,
      tactile: 1,
      olfactory: 1,
      vestibular: 4,
      proprioceptive: 2,
    };
    const result = sensoryToAssessmentItems(profile);

    expect(result).toHaveLength(6);
  });

  it('IDが sensory-{field} 形式で安定する', () => {
    const profile: SensoryProfile = { ...DEFAULT_PROFILE, olfactory: 5 };
    const result = sensoryToAssessmentItems(profile);

    expect(result[0].id).toBe('sensory-olfactory');
  });
});
