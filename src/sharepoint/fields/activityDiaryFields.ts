/**
 * SharePoint フィールド定義 — ActivityDiary (支援記録/ケース記録)
 */
import { buildSelectFieldsFromMap } from './fieldUtils';

/**
 * ActivityDiary リストのフィールド候補マップ
 *
 * 各候補配列の先頭が「provisioningFields に記載されている基準名」。
 * 以降は SharePoint がリネームした可能性のある代替名。
 * UserID (Text) と UserIdId (Lookup) の両スキーマを candidates で吸収する。
 */
export const ACTIVITY_DIARY_CANDIDATES = {
  /** ユーザー識別子。Text 型の UserID と Lookup 型 UserId/UserIdId の両方を吸収 */
  userId:          ['UserID', 'UserId', 'UserIdId', 'user_id', 'cr013_userId'],
  /** 記録日 */
  date:            ['Date', 'date', 'ServiceDate', 'RecordDate', 'EntryDate', 'cr013_date'],
  /** 時間帯 (AM / PM / 1日) */
  shift:           ['Shift', 'shift', 'Period', 'TimeSlot', 'cr013_shift'],
  /** 活動カテゴリ */
  category:        ['Category', 'category', 'ActivityCategory', 'cr013_category'],
  /** 昼食量 */
  lunchAmount:     ['LunchAmount', 'lunchAmount', 'Lunch', 'cr013_lunchAmount'],
  /** 主食量 */
  mealMain:        ['MealMain', 'mealMain', 'cr013_mealMain'],
  /** 副食量 */
  mealSide:        ['MealSide', 'mealSide', 'cr013_mealSide'],
  /** 問題行動あり/なし */
  problemBehavior: ['ProblemBehavior', 'problemBehavior', 'cr013_problemBehavior'],
  /** 問題行動種別 */
  behaviorType:    ['BehaviorType', 'behaviorType', 'cr013_behaviorType'],
  /** 問題行動メモ */
  behaviorNote:    ['BehaviorNote', 'behaviorNote', 'cr013_behaviorNote'],
  /** てんかん発作あり/なし */
  seizure:         ['Seizure', 'seizure', 'cr013_seizure'],
  /** てんかん発作時刻 */
  seizureAt:       ['SeizureAt', 'seizureAt', 'cr013_seizureAt'],
  /** 目標ID列 (カンマ区切り) */
  goals:           ['Goals', 'goals', 'GoalIds', 'cr013_goals'],
  /** 備考 */
  notes:           ['Notes', 'notes', 'cr013_notes'],
} as const;

/**
 * ActivityDiary の必須フィールド。
 * この 4 つが解決できない場合、リストをソースとして使えない。
 */
export const ACTIVITY_DIARY_ESSENTIALS: (keyof typeof ACTIVITY_DIARY_CANDIDATES)[] = [
  'userId', 'date', 'shift', 'category',
];

/**
 * ActivityDiary リスト用の動的 $select ビルダー
 */
export function buildActivityDiarySelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  const baseMap: Record<string, string> = {};
  for (const [key, candidates] of Object.entries(ACTIVITY_DIARY_CANDIDATES)) {
    baseMap[key] = candidates[0];
  }

  return buildSelectFieldsFromMap(baseMap, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified', 'Title'],
    fallback: [
      'Id',
      'Title',
      'UserID',
      'Date',
      'Shift',
      'Category',
      'LunchAmount',
      'MealMain',
      'MealSide',
      'ProblemBehavior',
      'BehaviorType',
      'BehaviorNote',
      'Seizure',
      'SeizureAt',
      'Goals',
      'Notes',
      'Created',
      'Modified',
    ],
  });
}
