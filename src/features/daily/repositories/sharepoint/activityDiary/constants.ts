import { get as getEnv } from '@/env';
import { ACTIVITY_DIARY_CANDIDATES } from '@/sharepoint/fields/activityDiaryFields';

/**
 * SharePoint field names for ActivityDiary
 */
export const AD_FIELDS = {
  title:           ACTIVITY_DIARY_CANDIDATES.title[0],
  userId:          ACTIVITY_DIARY_CANDIDATES.userId[0],
  date:            ACTIVITY_DIARY_CANDIDATES.date[0],
  shift:           ACTIVITY_DIARY_CANDIDATES.shift[0],
  category:        ACTIVITY_DIARY_CANDIDATES.category[0],
  lunchAmount:     ACTIVITY_DIARY_CANDIDATES.lunchAmount[0],
  mealMain:        ACTIVITY_DIARY_CANDIDATES.mealMain[0],
  mealSide:        ACTIVITY_DIARY_CANDIDATES.mealSide[0],
  problemBehavior: ACTIVITY_DIARY_CANDIDATES.problemBehavior[0],
  behaviorType:    ACTIVITY_DIARY_CANDIDATES.behaviorType[0],
  behaviorNote:    ACTIVITY_DIARY_CANDIDATES.behaviorNote[0],
  seizure:         ACTIVITY_DIARY_CANDIDATES.seizure[0],
  seizureAt:       ACTIVITY_DIARY_CANDIDATES.seizureAt[0],
  goals:           ACTIVITY_DIARY_CANDIDATES.goals[0],
  notes:           ACTIVITY_DIARY_CANDIDATES.notes[0],
} as const;

export type ADFieldKey = keyof typeof ACTIVITY_DIARY_CANDIDATES;
export type ADMapping = Partial<Record<ADFieldKey, string>>;

export const getADListTitle = (): string => {
  return getEnv('VITE_SP_LIST_ACTIVITY_DIARY', 'ActivityDiary').trim();
};
