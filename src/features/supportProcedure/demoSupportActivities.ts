// デモ用の支援手順データ
import type { SupportActivityTemplate } from '@/features/planDeployment/supportFlow';

export const demoSupportActivities: SupportActivityTemplate[] = [
  {
    time: '09:30',
    title: '朝の会',
    stage: 'proactive',
    personTodo: '出席確認・今日の予定を確認する',
    supporterTodo: '笑顔で声かけ、安心できる雰囲気づくり',
  },
  {
    time: '10:00',
    title: 'AM活動',
    stage: 'proactive',
    personTodo: '作業・学習に集中する',
    supporterTodo: '適宜サポート、集中できる環境調整',
  },
  {
    time: '12:00',
    title: '昼食',
    stage: 'earlyResponse',
    personTodo: '落ち着いて食事をとる',
    supporterTodo: '食事の準備・声かけ、食事中の見守り',
  },
  {
    time: '13:00',
    title: '休憩',
    stage: 'earlyResponse',
    personTodo: 'リラックスして過ごす',
    supporterTodo: '休憩スペースの案内・声かけ',
  },
  {
    time: '14:00',
    title: 'PM活動',
    stage: 'crisisResponse',
    personTodo: '午後の活動に参加する',
    supporterTodo: '活動内容の説明・サポート',
  },
  {
    time: '15:30',
    title: '振り返り',
    stage: 'postCrisis',
    personTodo: '今日の活動を振り返る',
    supporterTodo: '良かった点・課題を一緒に確認',
  },
];
