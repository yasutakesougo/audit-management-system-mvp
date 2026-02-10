import type { ScheduleCategory } from './types';

export const scheduleCategoryLabels: Record<ScheduleCategory, string> = {
  User: '利用者',
  Staff: '職員',
  Org: '施設',
};

export const scheduleFacilityPlaceholder = '例）朝礼／職員会議／全体イベント準備／送迎調整／設備点検';

export const scheduleFacilityHelpText =
  '「施設」は、会議・全体予定・共有タスクなど“みんなに影響する予定”を入れるレーンです。';

export const scheduleFacilityOneTimeGuide =
  '施設レーンは「会議・全体予定・共有タスク」用です。';

export const scheduleFacilityEmptyCopy = {
  title: '予定はまだありません',
  description: '「＋予定を追加」から登録できます。会議・全体予定・共有タスクは「施設」へ。',
  cta: '＋予定を追加',
};
