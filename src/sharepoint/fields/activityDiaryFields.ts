/**
 * ActivityDiary フィールド定義
 */


/**
 * ActivityDiary リストのフィールド候補マップ
 */
export const ACTIVITY_DIARY_CANDIDATES = {
  /** タイトル (標準列) */
  title:           ['Title', 'title', 'RecordTitle'],
  /** ユーザー識別子。Text 型の UserID と Lookup 型 UserId/UserIdId の両方、およびドリフトを吸収 */
  userId:          ['UserID', 'UserId', 'UserIdId', 'user_id', 'cr013_userId', 'UserID0', 'UserId0', 'User_x0020_ID'],
  /** 記録日 */
  date:            ['Date', 'date', 'RecordDate', 'EntryDate', 'cr013_date', 'Date0', 'RecordDate0', 'Record_x0020_Date'],
  /** 時間帯 (AM / PM / 1日) */
  shift:           ['Shift', 'shift', 'Period', 'TimeSlot', 'cr013_shift', 'Shift0'],
  /** 活動カテゴリ */
  category:        ['Category', 'category', 'ActivityCategory', 'cr013_category', 'Category0'],
  /** 昼食量 */
  lunchAmount:     ['LunchAmount', 'lunchAmount', 'Lunch', 'cr013_lunchAmount', 'LunchAmount0', 'Lunch_x0020_Amount'],
  /** 主食量 */
  mealMain:        ['MealMain', 'mealMain', 'cr013_mealMain', 'MealMain0'],
  /** 副食量 */
  mealSide:        ['MealSide', 'mealSide', 'cr013_mealSide', 'MealSide0'],
  /** 問題行動あり/なし */
  problemBehavior: ['ProblemBehavior', 'problemBehavior', 'cr013_problemBehavior', 'ProblemBehavior0', 'HasProblemBehavior'],
  /** 問題行動種別 */
  behaviorType:    ['BehaviorType', 'behaviorType', 'cr013_behaviorType', 'BehaviorType0'],
  /** 問題行動メモ */
  behaviorNote:    ['BehaviorNote', 'behaviorNote', 'cr013_behaviorNote', 'BehaviorNote0'],
  /** てんかん発作あり/なし */
  seizure:         ['Seizure', 'seizure', 'cr013_seizure', 'Seizure0', 'HasSeizure'],
  /** てんかん発作時刻 */
  seizureAt:       ['SeizureAt', 'seizureAt', 'cr013_seizureAt', 'SeizureAt0'],
  /** 目標ID列 (カンマ区切り、またはJSON) */
  goals:           ['Goals', 'goals', 'GoalIds', 'cr013_goals', 'Goals0', 'Goal_x0020_Ids', 'GoalIdsJSON'],
  /** 備考 */
  notes:           ['Notes', 'notes', 'cr013_notes', 'Notes0', 'Remarks'],
} as const;

/**
 * ActivityDiary の必須フィールド。
 * 欠落時、信頼できるドメインモデルを構築できないため FAIL 判定。
 */
export const ACTIVITY_DIARY_ESSENTIALS: (keyof typeof ACTIVITY_DIARY_CANDIDATES)[] = [
  'userId', 'date', 'shift', 'category',
];

/**
 * 自己修復 (Self-Healing) 用の列定義
 */
export const ACTIVITY_DIARY_ENSURE_FIELDS = [
  { internalName: 'UserID', type: 'Text', required: true, displayName: 'User ID' },
  { internalName: 'Date', type: 'DateTime', required: true, displayName: 'Date', dateTimeFormat: 'DateOnly' },
  { internalName: 'Shift', type: 'Text', required: true, displayName: 'Shift' },
  { internalName: 'Category', type: 'Text', required: true, displayName: 'Category' },
  { internalName: 'LunchAmount', type: 'Text', required: false, displayName: 'Lunch Amount' },
  { internalName: 'MealMain', type: 'Text', required: false, displayName: 'Meal Main' },
  { internalName: 'MealSide', type: 'Text', required: false, displayName: 'Meal Side' },
  { internalName: 'ProblemBehavior', type: 'Boolean', required: false, displayName: 'Problem Behavior' },
  { internalName: 'BehaviorType', type: 'Text', required: false, displayName: 'Behavior Type' },
  { internalName: 'BehaviorNote', type: 'Note', required: false, displayName: 'Behavior Note' },
  { internalName: 'Seizure', type: 'Boolean', required: false, displayName: 'Seizure' },
  { internalName: 'SeizureAt', type: 'Text', required: false, displayName: 'Seizure At' },
  { internalName: 'Goals', type: 'Note', required: false, displayName: 'Goal IDs' },
  { internalName: 'Notes', type: 'Note', required: false, displayName: 'Notes' },
] as const;
