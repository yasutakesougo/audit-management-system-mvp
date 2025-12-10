import { useUsersDemo } from '@/features/users/usersStoreDemo';
import type { IUserMaster } from '@/sharepoint/fields';
import { useMemo } from 'react';

export type PriorityUser = {
  id: number;
  name: string;
  memo: string;
  priority: 'high' | 'medium' | 'low';
  reason: string; // フォローが必要な理由
};

/**
 * 重点フォロー対象者のデータを提供するカスタムフック
 *
 * DashboardPageとMeetingGuidePageで共通して使用される
 * 強度行動障害対象者の中から上位3名を重点フォロー対象として抽出し、
 * それぞれに適切な理由とメモを付与する
 *
 * @returns PriorityUser[] - 重点フォロー対象者のリスト（最大3名）
 */
export function usePriorityFollowUsers(): PriorityUser[] {
  const { data: users } = useUsersDemo();

  const priorityFollowUsers = useMemo(() => {
    // 強度行動障害対象者をフィルタリング
    const intensiveSupportUsers = users.filter((user: IUserMaster) => user.IsSupportProcedureTarget);

    // 基本は強度行動障害対象者から3名
    const baseUsers = intensiveSupportUsers.slice(0, 3);

    return baseUsers.map((user, index) => {
      // 模擬的な理由生成（実際はDBやAPIから取得）
      const reasons = [
        { reason: '昨日落ち着き不安定', priority: 'high' as const, memo: '午後の活動で注意深く観察' },
        { reason: '新しい活動プログラム初日', priority: 'medium' as const, memo: '反応と適応状況を確認' },
        { reason: '服薬変更2日目', priority: 'high' as const, memo: '副作用や行動変化をチェック' },
        { reason: '家族面談予定', priority: 'low' as const, memo: '面談前の様子を記録' },
        { reason: '定期健康診断後', priority: 'medium' as const, memo: '結果を踏まえた支援確認' }
      ];

      const selectedReason = reasons[index % reasons.length];

      return {
        id: user.Id,
        name: user.FullName || '利用者',
        memo: selectedReason.memo,
        priority: selectedReason.priority,
        reason: selectedReason.reason
      };
    });
  }, [users]);

  return priorityFollowUsers;
}

/**
 * レガシー互換性のため、PriorityUser型をエクスポート
 * 将来的にはMeetingGuideDrawerからimportするよう移行予定
 */
export type { PriorityUser as PriorityFollowUser };
