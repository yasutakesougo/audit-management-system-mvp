/**
 * Dashboard Mock Data Generators
 *
 * 開発・デモ用のモックデータ生成関数。
 * 本番データへの置き換え時にこのファイルを削除すれば済むよう隔離。
 */

import type { PersonDaily, SeizureRecord } from '@/domain/daily/types';
import type { IUserMaster } from '@/sharepoint/fields';

/**
 * モック日々の記録データ生成
 *
 * 利用者一覧から、ランダムな活動・問題行動・発作データを含む
 * PersonDaily 配列を生成する。
 */
export const generateMockActivityRecords = (users: IUserMaster[], date: string): PersonDaily[] => {
  return users.map((user, index) => {
    const hasProblems = Math.random() < 0.15; // 15%の確率で問題行動
    const hasSeizure = Math.random() < 0.05; // 5%の確率で発作
    const mealAmount = ['完食', '多め', '半分', '少なめ', 'なし'][Math.floor(Math.random() * 5)] as PersonDaily['data']['mealAmount'];

    return {
      id: index + 1,
      userId: user.UserID,
      userName: user.FullName,
      date,
      status: Math.random() > 0.1 ? '完了' as const : '作成中' as const,
      reporter: { name: '職員A' },
      draft: { isDraft: false },
      kind: 'A' as const,
      data: {
        amActivities: [['作業活動', '創作活動', '運動'][Math.floor(Math.random() * 3)]],
        pmActivities: [['リハビリ', '個別支援', 'レクリエーション'][Math.floor(Math.random() * 3)]],
        amNotes: 'AM活動を実施しました。',
        pmNotes: 'PM活動を実施しました。',
        mealAmount,
        problemBehavior: hasProblems ? {
          selfHarm: Math.random() < 0.3,
          otherInjury: Math.random() < 0.2,
          loudVoice: Math.random() < 0.4,
          pica: Math.random() < 0.1,
          other: Math.random() < 0.2,
          otherDetail: Math.random() < 0.2 ? '落ち着かない様子が見られました' : ''
        } : {
          selfHarm: false,
          otherInjury: false,
          loudVoice: false,
          pica: false,
          other: false
        },
        seizureRecord: hasSeizure ? {
          occurred: true,
          time: `${10 + Math.floor(Math.random() * 6)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          duration: `${Math.floor(Math.random() * 10) + 1}分`,
          severity: ['軽度', '中等度', '重度'][Math.floor(Math.random() * 3)] as SeizureRecord['severity'],
          notes: '発作が発生しました。適切に対応しました。'
        } : {
          occurred: false
        },
        specialNotes: index % 7 === 0 ? '本日は特に調子が良好でした。' : ''
      }
    };
  });
};
