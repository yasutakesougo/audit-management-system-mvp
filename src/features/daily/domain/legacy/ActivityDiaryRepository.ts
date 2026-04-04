export type ActivityDiaryMealAmount = '完食' | '多め' | '半分' | '少なめ' | 'なし';
export type ActivityDiaryPeriod = 'AM' | 'PM' | '1日';
export type ActivityDiaryCategory = '請負' | '個別' | '外活動' | '余暇';

// contract:allow-interface
export interface ActivityDiaryRecord {
  id: string;
  userId: string; // "UserID" (Text) または Lookup
  date: string;   // ISO string (YYYY-MM-DD or full)
  shift: ActivityDiaryPeriod;
  category: ActivityDiaryCategory;
  lunchAmount?: string;
  mealMain?: string;
  mealSide?: string;
  problemBehavior: boolean;
  behaviorType?: string;
  behaviorNote?: string;
  seizure: boolean;
  seizureAt?: string;
  goals?: string;
  notes?: string;
}

export interface ActivityDiaryUpsert {
  userId: number | string;
  dateISO: string;
  period: ActivityDiaryPeriod;
  category: ActivityDiaryCategory;
  goalIds?: (number | string)[];
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
}

export interface ActivityDiaryRepository {
  add(upsert: ActivityDiaryUpsert): Promise<ActivityDiaryRecord>;
  // TODO: list or getByDate? currently only add is needed based on spActivityDiary.ts usage.
}
