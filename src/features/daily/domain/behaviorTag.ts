/**
 * @fileoverview 行動タグのドメイン定数・ヘルパー
 * @description
 * 日次記録の UserRowData に付与する行動タグのマスタ定義。
 * 保存データはキー文字列のみ。表示ラベル・カテゴリは実行時にマスタ参照する。
 *
 * SSOT: タグの追加・変更はこのファイルのみで行う。
 * schema.ts の z.enum はこのファイルの BEHAVIOR_TAG_KEYS から自動生成される。
 */

// ─── カテゴリ定義 ────────────────────────────────────────

/** タグカテゴリの定数マスタ */
export const BEHAVIOR_TAG_CATEGORIES = {
  behavior: '行動',
  communication: 'コミュニケーション',
  dailyLiving: '生活',
  positive: 'ポジティブ',
} as const;

export type BehaviorTagCategory = keyof typeof BEHAVIOR_TAG_CATEGORIES;

// ─── タグマスタ ─────────────────────────────────────────

/** 行動タグの定義。key = 保存値、value = 表示情報 */
export const BEHAVIOR_TAGS = {
  // ── 行動系 ──
  panic:      { label: 'パニック',   category: 'behavior' as const },
  sensory:    { label: '感覚過敏',   category: 'behavior' as const },
  elopement:  { label: '離席・離園', category: 'behavior' as const },

  // ── コミュニケーション系 ──
  verbalRequest:  { label: '言語要求',       category: 'communication' as const },
  gestureRequest: { label: 'ジェスチャー要求', category: 'communication' as const },
  echolalia:      { label: 'エコラリア',      category: 'communication' as const },

  // ── 生活系 ──
  eating:    { label: '食事', category: 'dailyLiving' as const },
  toileting: { label: '排泄', category: 'dailyLiving' as const },
  sleeping:  { label: '睡眠', category: 'dailyLiving' as const },

  // ── ポジティブ系 ──
  cooperation:    { label: '協力行動',   category: 'positive' as const },
  selfRegulation: { label: '自己調整',   category: 'positive' as const },
  newSkill:       { label: '新しいスキル', category: 'positive' as const },
} as const;

export type BehaviorTagKey = keyof typeof BEHAVIOR_TAGS;

/** 全タグキーの配列（z.enum の引数に使用） */
export const BEHAVIOR_TAG_KEYS = Object.keys(BEHAVIOR_TAGS) as BehaviorTagKey[];

// ─── ヘルパー関数 ───────────────────────────────────────

/** カテゴリに属するタグキーの一覧を取得 */
export const getTagsByCategory = (category: BehaviorTagCategory): BehaviorTagKey[] =>
  BEHAVIOR_TAG_KEYS.filter(key => BEHAVIOR_TAGS[key].category === category);

/** タグキーから表示ラベルを取得 */
export const getTagLabel = (key: BehaviorTagKey): string => BEHAVIOR_TAGS[key].label;

/** タグキーからカテゴリの表示名を取得 */
export const getTagCategoryLabel = (key: BehaviorTagKey): string =>
  BEHAVIOR_TAG_CATEGORIES[BEHAVIOR_TAGS[key].category];

/** 全カテゴリキーの配列（表示順序を固定） */
export const BEHAVIOR_TAG_CATEGORY_ORDER: BehaviorTagCategory[] = [
  'behavior',
  'communication',
  'dailyLiving',
  'positive',
];
