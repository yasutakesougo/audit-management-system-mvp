// Centralized UI presets for mood options and ABC selections.
// These strings are currently Japanese labels shown directly in the UI.
// If localization is introduced later, migrate these constants to the i18n layer.

// ---- Shared types (narrow unions for safety) ----
export type AbcKey = 'antecedent' | 'behavior' | 'consequence';

export interface LabeledOption<K extends string = string> {
  /** stable id for code/tests; keep ascii for i18n-friendliness */
  id: K;
  /** UI label (current locale) */
  label: string;
}

export type MoodId =
  | 'calm'
  | 'happy'
  | 'anxious'
  | 'tired'
  | 'signsEmerging';

export type StrengthId =
  | 'predictability'
  | 'routine'
  | 'visualSupport'
  | 'music'
  | 'quietPlace';

export type PersonFactorId =
  | 'auditorySensitivity'
  | 'expressiveLanguageDifficulties'
  | 'emotionRegulation';

export type EnvFactorId =
  | 'noisyEnvironment'
  | 'activityTransition'
  | 'unclearOutlook';

// ---- Centralized UI presets (value/label pairs) ----
// 将来 i18n 時は label を t('...') に差し替え、id は不変キーとして維持。

export const moodOptions: readonly LabeledOption<MoodId>[] = [
  { id: 'calm', label: '落ち着いている' },
  { id: 'happy', label: '楽しそう' },
  { id: 'anxious', label: '不安そう' },
  { id: 'tired', label: '疲れている' },
  { id: 'signsEmerging', label: 'サインが出ている' },
] as const;

export const abcOptionMap: Readonly<Record<AbcKey, readonly string[]>> = {
  antecedent: ['要求が通らない', '活動の切り替え', '感覚刺激が強い', '周囲が騒がしい'],
  behavior: ['手を叩く', '大きな声を出す', 'その場を離れる', '泣く / 叫ぶ'],
  consequence: ['支援者が近づく', '活動から離れる', '要求が受け入れられる', '時間を置いて再開する'],
} as const;

export const strengthTags: readonly LabeledOption<StrengthId>[] = [
  { id: 'predictability', label: '見通し' },
  { id: 'routine', label: 'ルーティン' },
  { id: 'visualSupport', label: '視覚支援' },
  { id: 'music', label: '好きな音楽' },
  { id: 'quietPlace', label: '静かな場所' },
] as const;

export const personFactors: readonly LabeledOption<PersonFactorId>[] = [
  { id: 'auditorySensitivity', label: '聴覚過敏' },
  { id: 'expressiveLanguageDifficulties', label: '言語表出の困難' },
  { id: 'emotionRegulation', label: '情動調整の難しさ' },
] as const;

export const envFactors: readonly LabeledOption<EnvFactorId>[] = [
  { id: 'noisyEnvironment', label: '周囲が騒がしい' },
  { id: 'activityTransition', label: '活動の切り替え' },
  { id: 'unclearOutlook', label: '見通しが不明瞭' },
] as const;

// ---- Small helpers (optional) ----
export const getAbcOptions = (key: AbcKey) => abcOptionMap[key];

export const moodsById = Object.freeze(
  Object.fromEntries(moodOptions.map((option) => [option.id, option])) as Record<
    MoodId,
    LabeledOption<MoodId>
  >,
);

export const strengthOptionsById = Object.freeze(
  Object.fromEntries(strengthTags.map((option) => [option.id, option])) as Record<
    StrengthId,
    LabeledOption<StrengthId>
  >,
);

export const personFactorsById = Object.freeze(
  Object.fromEntries(personFactors.map((option) => [option.id, option])) as Record<
    PersonFactorId,
    LabeledOption<PersonFactorId>
  >,
);

export const envFactorsById = Object.freeze(
  Object.fromEntries(envFactors.map((option) => [option.id, option])) as Record<
    EnvFactorId,
    LabeledOption<EnvFactorId>
  >,
);

const normalizeCandidate = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return null;
};

const matchOption = <K extends string>(
  options: readonly LabeledOption<K>[],
  candidate: unknown,
): LabeledOption<K> | undefined => {
  const normalized = normalizeCandidate(candidate);
  if (!normalized) {
    return undefined;
  }
  return (
    options.find((option) => option.id === normalized) ??
    options.find((option) => option.label === normalized)
  );
};

export const coerceMoodId = (value: unknown): MoodId | null => {
  const match = matchOption(moodOptions, value);
  return match?.id ?? null;
};

export const coerceStrengthId = (value: unknown): StrengthId | null => {
  const match = matchOption(strengthTags, value);
  return match?.id ?? null;
};

export const coercePersonFactorId = (value: unknown): PersonFactorId | null => {
  const match = matchOption(personFactors, value);
  return match?.id ?? null;
};

export const coerceEnvFactorId = (value: unknown): EnvFactorId | null => {
  const match = matchOption(envFactors, value);
  return match?.id ?? null;
};
