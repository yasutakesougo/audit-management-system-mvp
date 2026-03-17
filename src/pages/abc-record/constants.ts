/**
 * ABC Record Page — 定数・プリセット
 */
import type { AbcIntensity } from '@/domain/abc/abcRecord';
import type { AbcRecordCreateInput } from '@/domain/abc/abcRecord';

export const EMPTY_FORM: Omit<AbcRecordCreateInput, 'userId' | 'userName' | 'recorderName'> = {
  occurredAt: new Date().toISOString().slice(0, 16),
  setting: '',
  antecedent: '',
  behavior: '',
  consequence: '',
  intensity: 'medium' as AbcIntensity,
  durationMinutes: null,
  riskFlag: false,
  tags: [],
  notes: '',
};

export const SETTING_PRESETS = [
  '食事場面', '活動場面', '外出場面', '入浴場面',
  '排泄場面', '余暇時間', '送迎時', '朝の会',
  '帰りの会', '作業場面', '休憩時間', 'その他',
] as const;

export const TAG_PRESETS = [
  '自傷', '他害', '物壊し', 'パニック', '拒否',
  '大声', '座り込み', '飛び出し', '不穏', 'こだわり',
] as const;
