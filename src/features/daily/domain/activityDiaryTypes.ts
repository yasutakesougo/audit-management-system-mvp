/**
 * ActivityDiary (支援記録/ケース記録) ドメイン型
 * 
 * 日次支援の総括、食事、行動、発作等の記録を定義する。
 * Migrated from legacy src/lib/spActivityDiary.ts.
 */

export type ActivityDiaryMealAmount = '完食' | '多め' | '半分' | '少なめ' | 'なし';
export type ActivityDiaryPeriod = 'AM' | 'PM';
export type ActivityDiaryCategory = '請負' | '個別' | '外活動' | '余暇';

export type ActivityDiaryUpsert = {
  userId: number;
  dateISO: string;
  period: ActivityDiaryPeriod;
  category: ActivityDiaryCategory;
  goalIds: number[];
  mealMain?: ActivityDiaryMealAmount;
  mealSide?: ActivityDiaryMealAmount;
  behavior?: {
    has: boolean;
    kinds?: string[];
  };
  seizure?: {
    has: boolean;
    at?: string;
  };
  notes?: string;
};
