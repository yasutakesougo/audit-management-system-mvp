// Domain models for Iceberg-PDCA daily observations.
// TODO: Replace mock master data with SharePoint-backed values once API wiring lands.

export type BehaviorIntensity = 1 | 2 | 3 | 4 | 5;

export type BehaviorMood = '良好' | '普通' | 'やや不安定' | '不安定' | '高揚' | '疲労';

export interface BehaviorObservation {
  id: string;
  userId: string;
  timestamp: string;
  antecedent: string | null;
  behavior: string;
  consequence: string | null;
  intensity: BehaviorIntensity;
  durationMinutes?: number;
  memo?: string;
  timeSlot?: string;
  plannedActivity?: string;
  actualObservation?: string;
  staffResponse?: string;
  userMood?: BehaviorMood;
  followUpNote?: string;
}

export interface ObservationMaster {
  antecedents: string[];
  behaviors: string[];
  consequences: string[];
}

export const MOCK_OBSERVATION_MASTER: ObservationMaster = {
  antecedents: ['要求却下', '課題提示', '環境変化(音・光)', '待ち時間', '移動/切替', '不明'],
  behaviors: ['自傷(叩く)', '他害(叩く/蹴る)', '器物破損', '大声/奇声', '離席/飛び出し', '拒否/座り込み'],
  consequences: ['見守り', '環境調整', '声かけ', '身体的介入', 'スケジュール再提示']
};
