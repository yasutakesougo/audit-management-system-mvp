import { describe, expect, it } from 'vitest';
import {
  BEHAVIOR_TAG_CATEGORIES,
  BEHAVIOR_TAG_CATEGORY_ORDER,
  BEHAVIOR_TAG_KEYS,
  BEHAVIOR_TAGS,
  type BehaviorTagCategory,
  getTagLabel,
  getTagsByCategory,
  getTagCategoryLabel,
} from '../behaviorTag';

describe('behaviorTag', () => {
  describe('BEHAVIOR_TAGS マスタ', () => {
    it('12個のタグが定義されている', () => {
      expect(BEHAVIOR_TAG_KEYS).toHaveLength(12);
    });

    it('全タグに label と category が存在する', () => {
      for (const key of BEHAVIOR_TAG_KEYS) {
        const tag = BEHAVIOR_TAGS[key];
        expect(tag.label).toBeTruthy();
        expect(tag.category).toBeTruthy();
        expect(Object.keys(BEHAVIOR_TAG_CATEGORIES)).toContain(tag.category);
      }
    });

    it('問題行動チップと重複するキーが含まれていない', () => {
      const problemBehaviorKeys = ['selfHarm', 'otherInjury', 'loudVoice', 'pica', 'other'];
      for (const key of BEHAVIOR_TAG_KEYS) {
        expect(problemBehaviorKeys).not.toContain(key);
      }
    });
  });

  describe('BEHAVIOR_TAG_CATEGORIES', () => {
    it('4カテゴリが定義されている', () => {
      expect(Object.keys(BEHAVIOR_TAG_CATEGORIES)).toHaveLength(4);
    });

    it('全カテゴリに日本語ラベルがある', () => {
      expect(BEHAVIOR_TAG_CATEGORIES.behavior).toBe('行動');
      expect(BEHAVIOR_TAG_CATEGORIES.communication).toBe('コミュニケーション');
      expect(BEHAVIOR_TAG_CATEGORIES.dailyLiving).toBe('生活');
      expect(BEHAVIOR_TAG_CATEGORIES.positive).toBe('ポジティブ');
    });
  });

  describe('BEHAVIOR_TAG_CATEGORY_ORDER', () => {
    it('4カテゴリが正しい順序で並んでいる', () => {
      expect(BEHAVIOR_TAG_CATEGORY_ORDER).toEqual([
        'behavior',
        'communication',
        'dailyLiving',
        'positive',
      ]);
    });
  });

  describe('getTagsByCategory', () => {
    it('behavior カテゴリのタグを返す', () => {
      const tags = getTagsByCategory('behavior');
      expect(tags).toEqual(['panic', 'sensory', 'elopement']);
    });

    it('communication カテゴリのタグを返す', () => {
      const tags = getTagsByCategory('communication');
      expect(tags).toEqual(['verbalRequest', 'gestureRequest', 'echolalia']);
    });

    it('dailyLiving カテゴリのタグを返す', () => {
      const tags = getTagsByCategory('dailyLiving');
      expect(tags).toEqual(['eating', 'toileting', 'sleeping']);
    });

    it('positive カテゴリのタグを返す', () => {
      const tags = getTagsByCategory('positive');
      expect(tags).toEqual(['cooperation', 'selfRegulation', 'newSkill']);
    });

    it('全カテゴリのタグを合計すると全タグ数と一致する', () => {
      const categories: BehaviorTagCategory[] = ['behavior', 'communication', 'dailyLiving', 'positive'];
      const allFromCategories = categories.flatMap(c => getTagsByCategory(c));
      expect(allFromCategories).toHaveLength(BEHAVIOR_TAG_KEYS.length);
    });
  });

  describe('getTagLabel', () => {
    it('全キーに対してラベルを返す', () => {
      for (const key of BEHAVIOR_TAG_KEYS) {
        const label = getTagLabel(key);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('個別のラベルが正しい', () => {
      expect(getTagLabel('panic')).toBe('パニック');
      expect(getTagLabel('cooperation')).toBe('協力行動');
      expect(getTagLabel('eating')).toBe('食事');
    });
  });

  describe('getTagCategoryLabel', () => {
    it('タグキーからカテゴリの表示名を返す', () => {
      expect(getTagCategoryLabel('panic')).toBe('行動');
      expect(getTagCategoryLabel('verbalRequest')).toBe('コミュニケーション');
      expect(getTagCategoryLabel('eating')).toBe('生活');
      expect(getTagCategoryLabel('cooperation')).toBe('ポジティブ');
    });
  });
});
