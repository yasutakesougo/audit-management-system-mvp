import type { ScheduleCategory } from './types';

export const scheduleCategoryLabels: Record<ScheduleCategory, string> = {
  User: '利用者',
  Staff: '職員',
  Org: '施設',
};

export const scheduleFacilityPlaceholder = '例）会議／全体予定／共有タスク';

export const scheduleFacilityHelpText = '個人ではなく、施設全体に関わる予定です。';

export const scheduleFacilityEmptyCopy = {
  title: '施設の予定はまだありません',
  description: '会議や全体予定、共有タスクなど、施設全体に関わる予定を登録できます。',
  cta: '施設の予定を追加',
};
