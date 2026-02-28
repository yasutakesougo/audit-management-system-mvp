// ---------------------------------------------------------------------------
// TimeFlow 支援記録 — 定数・マッピング
// ---------------------------------------------------------------------------

import type { SupportActivityTemplate as MasterSupportActivityTemplate } from '@/domain/support/types';
import type { SupportStrategyStage } from '@/features/planDeployment/supportFlow';
import type { SupportUser } from './timeFlowTypes';

// ===== ステージラベル =====

export const stageLabelMap: Record<SupportStrategyStage, string> = {
  proactive: '予防的支援',
  earlyResponse: '早期対応',
  crisisResponse: '危機対応',
  postCrisis: '事後対応',
};

export const stageOrder: SupportStrategyStage[] = [
  'proactive',
  'earlyResponse',
  'crisisResponse',
  'postCrisis',
];

// ===== カテゴリ→ステージ変換テーブル =====

export const categoryToStageMap: Record<MasterSupportActivityTemplate['category'], SupportStrategyStage> = {
  '通所・帰宅': 'proactive',
  '朝の準備': 'proactive',
  '健康確認': 'earlyResponse',
  '活動準備': 'proactive',
  'AM活動': 'proactive',
  '昼食準備': 'earlyResponse',
  '昼食': 'earlyResponse',
  '休憩': 'postCrisis',
  'PM活動': 'proactive',
  '終了準備': 'postCrisis',
  '振り返り': 'postCrisis',
  'その他': 'proactive',
};

// ===== LocalStorage キー =====

export const SUPPORT_ACTIVITY_STORAGE_KEY = 'supportActivityTemplates';

// ===== フォーム選択肢 =====

export const moodOptions = [
  '落ち着いている',
  '楽しそう',
  '集中している',
  '不安そう',
  'イライラ',
] as const;

export const abcOptionMap: Record<'antecedent' | 'behavior' | 'consequence', string[]> = {
  antecedent: ['課題中', '要求があった', '感覚刺激', '他者との関わり'],
  behavior: ['大声を出す', '物を叩く', '自傷行為', '他害行為'],
  consequence: ['クールダウン', '要求に応えた', '無視(意図的)', '場所移動'],
};

// ===== モック利用者データ =====

export const mockSupportUsers: SupportUser[] = [
  { id: '001', name: '田中太郎', planType: '日常生活', isActive: true },
  { id: '005', name: '佐藤花子', planType: '作業活動', isActive: true },
  { id: '012', name: '山田一郎', planType: 'コミュニケーション', isActive: true },
  { id: '018', name: '鈴木美子', planType: '健康管理', isActive: true },
  { id: '023', name: '高橋次郎', planType: '社会生活', isActive: true },
  { id: '030', name: '中村勇気', planType: '作業活動', isActive: true },
  { id: '032', name: '小林さくら', planType: 'コミュニケーション', isActive: true },
];
