import { useMemo } from 'react';
// 最小限のスケジュール情報型
interface MinimalSchedule {
  id: string;
  title: string;
  start: string;
  end: string;
  status?: string;
  notes?: string;
  location?: string;
}

interface NextActionCardProps {
  schedules: MinimalSchedule[];
  className?: string;
}

type ScheduleStatus = 'upcoming' | 'current' | 'overdue' | 'completed' | 'next';

interface ScheduleWithStatus {
  schedule: MinimalSchedule;
  status: ScheduleStatus;
  timeUntil?: number; // minutes until start (negative if overdue)
  actionType: 'start' | 'record' | 'complete' | 'review' | 'wait';
}

/**
 * 現在時刻とスケジュールの関係を分析して最適な1つを選出
 */
function analyzeCurrentSchedule(schedules: MinimalSchedule[]): ScheduleWithStatus | null {
  if (!schedules.length) return null;

  const now = new Date();
  const currentTime = now.getTime();

  const analyzed = schedules.map((schedule): ScheduleWithStatus => {
    const start = new Date(schedule.start);
    const end = new Date(schedule.end);
    const startTime = start.getTime();
    const endTime = end.getTime();
    const minutesUntilStart = Math.round((startTime - currentTime) / (1000 * 60));
    const minutesSinceStart = Math.round((currentTime - startTime) / (1000 * 60));

    // ステータス判定
    let status: ScheduleStatus;
    let actionType: ScheduleWithStatus['actionType'];

    if (currentTime >= startTime && currentTime <= endTime) {
      // 進行中
      status = 'current';
      actionType = schedule.status === '完了' ? 'review' : 'record';
    } else if (currentTime < startTime) {
      // 未開始
      if (minutesUntilStart <= 15) {
        status = 'upcoming';
        actionType = 'start';
      } else {
        status = 'next';
        actionType = 'wait';
      }
    } else {
      // 終了済み
      if (schedule.status === '完了') {
        status = 'completed';
        actionType = 'review';
      } else if (minutesSinceStart <= 30) {
        // 終了から30分以内なら記録入力可能
        status = 'overdue';
        actionType = 'complete';
      } else {
        status = 'completed';
        actionType = 'review';
      }
    }

    return {
      schedule,
      status,
      timeUntil: minutesUntilStart,
      actionType,
    };
  });

  // 優先順位: 進行中 > 遅延 > 近い予定 > 次の予定
  const priorities: Record<ScheduleStatus, number> = {
    current: 1,
    overdue: 2,
    upcoming: 3,
    next: 4,
    completed: 5,
  };

  return analyzed
    .filter(item => item.status !== 'completed')
    .sort((a, b) => {
      const priorityDiff = priorities[a.status] - priorities[b.status];
      if (priorityDiff !== 0) return priorityDiff;

      // 同じ優先度なら時間順
      return Math.abs(a.timeUntil || 0) - Math.abs(b.timeUntil || 0);
    })[0] || null;
}

/**
 * 時間表示のフォーマット
 */
function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startStr = startDate.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const endStr = endDate.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `${startStr} - ${endStr}`;
}

/**
 * アクションボタンの設定
 */
function getActionConfig(item: ScheduleWithStatus): {
  text: string;
  variant: 'primary' | 'success' | 'warning' | 'info';
  icon: string;
} {
  switch (item.actionType) {
    case 'start':
      return {
        text: 'サービス開始',
        variant: 'primary',
        icon: '▶️'
      };
    case 'record':
      return {
        text: 'サービス記録を記入',
        variant: 'success',
        icon: '✏️'
      };
    case 'complete':
      return {
        text: '完了報告',
        variant: 'warning',
        icon: '✅'
      };
    case 'review':
      return {
        text: '記録を確認',
        variant: 'info',
        icon: '👁️'
      };
    default:
      return {
        text: '詳細を見る',
        variant: 'info',
        icon: '📋'
      };
  }
}

/**
 * ステータスに応じたスタイリング
 */
function getStatusStyle(status: ScheduleStatus): {
  cardBorder: string;
  statusDot: string;
  statusText: string;
} {
  switch (status) {
    case 'current':
      return {
        cardBorder: 'border-green-400 shadow-green-100',
        statusDot: 'bg-green-500',
        statusText: '実行中'
      };
    case 'upcoming':
      return {
        cardBorder: 'border-blue-400 shadow-blue-100',
        statusDot: 'bg-blue-500',
        statusText: '開始予定'
      };
    case 'overdue':
      return {
        cardBorder: 'border-red-400 shadow-red-100',
        statusDot: 'bg-red-500',
        statusText: '要完了'
      };
    default:
      return {
        cardBorder: 'border-gray-300 shadow-gray-100',
        statusDot: 'bg-gray-400',
        statusText: '待機中'
      };
  }
}

export function NextActionCard({ schedules, className = '' }: NextActionCardProps) {
  const currentItem = useMemo(() => analyzeCurrentSchedule(schedules), [schedules]);

  if (!currentItem) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 shadow-sm ${className}`}>
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">🎉</div>
          <div className="text-gray-600 text-lg font-medium">今日の予定はありません</div>
          <div className="text-gray-500 text-sm mt-1">お疲れさまでした</div>
        </div>
      </div>
    );
  }

  const { schedule, status, timeUntil } = currentItem;
  const statusStyle = getStatusStyle(status);
  const actionConfig = getActionConfig(currentItem);

  // 重要な注意事項の検出（例：アレルギー情報）
  const hasImportantNotes = schedule.notes &&
    (schedule.notes.includes('アレルギー') ||
     schedule.notes.includes('注意') ||
     schedule.notes.includes('薬'));

  return (
    <div className={`bg-white rounded-lg border-2 ${statusStyle.cardBorder} shadow-lg ${className}`}>
      {/* ヘッダー：ステータス */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusStyle.statusDot}`} />
          <span className="text-blue-600 font-semibold text-sm tracking-wide">
            {statusStyle.statusText}
          </span>
          {timeUntil !== undefined && status === 'upcoming' && (
            <span className="text-gray-500 text-sm">
              ({Math.abs(timeUntil)}分{timeUntil < 0 ? '経過' : '前'})
            </span>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="px-6 pb-4">
        {/* 時間 */}
        <div className="text-2xl font-bold text-gray-900 mb-2">
          {formatTimeRange(schedule.start, schedule.end)}
        </div>

        {/* タイトル */}
        <div className="text-xl font-medium text-gray-800 mb-3">
          {schedule.title}
        </div>

        {/* 場所 */}
        {schedule.location && (
          <div className="text-gray-600 text-sm mb-3 flex items-center gap-2">
            <span>📍</span>
            {schedule.location}
          </div>
        )}

        {/* 重要な注意事項 */}
        {hasImportantNotes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-sm">⚠️</span>
              <div className="text-yellow-800 text-sm font-medium">
                注意事項があります
              </div>
            </div>
            <div className="text-yellow-700 text-sm mt-1 line-clamp-2">
              {schedule.notes}
            </div>
          </div>
        )}

        {/* メインアクションボタン */}
        <button
          className={`w-full py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
            actionConfig.variant === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' :
            actionConfig.variant === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
            actionConfig.variant === 'warning' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
            'bg-gray-600 hover:bg-gray-700 text-white'
          }`}
        >
          <span className="mr-2">{actionConfig.icon}</span>
          {actionConfig.text}
        </button>

        {/* サブアクション */}
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <button className="text-blue-600 hover:text-blue-800 transition-colors">
            詳細を見る
          </button>
          <button className="text-blue-600 hover:text-blue-800 transition-colors">
            緊急連絡
          </button>
          <button className="text-red-600 hover:text-red-800 transition-colors">
            問題報告
          </button>
        </div>
      </div>
    </div>
  );
}

export default NextActionCard;