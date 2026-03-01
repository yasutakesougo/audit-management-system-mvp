import { useMemo } from 'react';
// 最小限のスケジュール情報型
export interface MinimalSchedule {
	id: string;
	title: string;
	start: string;
	end: string;
	status?: string;
	notes?: string;
	location?: string;
}

/**
 * 重要な注意事項の検出
 * 将来的にはより高度なheuristicsを実装可能
 */
export function isImportantNote(note: string): boolean {
	if (!note) return false;

	return (
		note.includes('アレルギー') ||
		note.includes('注意') ||
		note.includes('薬') ||
		note.includes('禁忌') ||
		note.includes('要注意') ||
		note.includes('危険')
	);
}

interface NextActionCardProps {
	schedules: MinimalSchedule[];
	className?: string;
	onPrimaryAction?: (item: ScheduleWithStatus) => void;
	onViewDetail?: (item: ScheduleWithStatus) => void;
	onEmergencyContact?: (item: ScheduleWithStatus) => void;
	onReportIssue?: (item: ScheduleWithStatus) => void;
}

type ScheduleStatus = 'upcoming' | 'current' | 'overdue' | 'completed' | 'next';

export interface ScheduleWithStatus {
	schedule: MinimalSchedule;
	status: ScheduleStatus;
	timeUntil?: number; // minutes until start (negative if overdue)
	actionType: 'start' | 'record' | 'complete' | 'review' | 'wait';
}

/**
 * 現在時刻とスケジュールの関係を分析して最適な1つを選出
 */
export function analyzeCurrentSchedule(schedules: MinimalSchedule[]): ScheduleWithStatus | null {
	if (!schedules.length) return null;

	const now = new Date();
	const currentTime = now.getTime();

	const analyzed = schedules
		.map((schedule): ScheduleWithStatus | null => {
			// 日付バリデーション強化
			if (!schedule.start || !schedule.end) return null;

			const start = new Date(schedule.start);
			const end = new Date(schedule.end);
			if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

			const startTime = start.getTime();
			const endTime = end.getTime();
			const minutesUntilStart = Math.round((startTime - currentTime) / (1000 * 60));
			const minutesSinceStart = Math.round((currentTime - startTime) / (1000 * 60));

			const normalizedStatus = schedule.status?.toLowerCase().trim();
			const isMarkedCompleted = normalizedStatus === '完了' || normalizedStatus === 'completed';
			// 開始終了が確定した後に、終了済みかつ完了扱いの予定は除外する
			if (isMarkedCompleted && currentTime > endTime) {
				return null;
			}

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
		})
		.filter((x): x is ScheduleWithStatus => x !== null);

	if (!analyzed.length) return null;

	// 優先順位: 進行中 > 遅延 > 近い予定 > 次の予定
	const priorities: Record<ScheduleStatus, number> = {
		current: 1,
		overdue: 2,
		upcoming: 3,
		next: 4,
		completed: 5,
	};

	const activeItems = analyzed.filter(item => item.status !== 'completed');
	if (activeItems.length === 0) return null;

	return activeItems
		.sort((a, b) => {
			const priorityDiff = priorities[a.status] - priorities[b.status];
			if (priorityDiff !== 0) return priorityDiff;

			// 同じ優先度なら時間順
			// |timeUntil| でソートする意図：
			// - current/overdue: |timeUntil| が小さいほど開始時間に近い（より緊急）
			// - upcoming/next: |timeUntil| が小さいほど開始が近い（より優先）
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
				statusText: 'text-green-700'
			};
		case 'overdue':
			return {
				cardBorder: 'border-red-400 shadow-red-100',
				statusDot: 'bg-red-500',
				statusText: 'text-red-700'
			};
		case 'upcoming':
			return {
				cardBorder: 'border-orange-400 shadow-orange-100',
				statusDot: 'bg-orange-500',
				statusText: 'text-orange-700'
			};
		case 'next':
			return {
				cardBorder: 'border-emerald-400 shadow-emerald-100',
				statusDot: 'bg-emerald-500',
				statusText: 'text-emerald-700'
			};
		case 'completed':
			return {
				cardBorder: 'border-gray-300 shadow-gray-50',
				statusDot: 'bg-gray-400',
				statusText: 'text-gray-600'
			};
		default:
			return {
				cardBorder: 'border-gray-300 shadow-gray-50',
				statusDot: 'bg-gray-400',
				statusText: 'text-gray-600'
			};
	}
}

/**
 * 現在のスケジュールを表示するカードコンポーネント
 */
const NextActionCard: React.FC<NextActionCardProps> = ({
	schedules,
	className = '',
	onPrimaryAction,
	onViewDetail,
	onEmergencyContact,
	onReportIssue
}) => {
	const currentSchedule = useMemo(() => analyzeCurrentSchedule(schedules), [schedules]);

	// 予定がない場合
	if (!currentSchedule) {
		return (
			<div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
				<div className="text-center">
					<div className="text-4xl mb-2">😌</div>
					<h3 className="text-lg font-semibold text-gray-700">現在の予定はありません</h3>
					<p className="text-sm text-gray-500 mt-1">お疲れ様です。次の予定をお待ちください。</p>
				</div>
			</div>
		);
	}

	const { schedule, status, timeUntil } = currentSchedule;
	const statusStyle = getStatusStyle(status);
	const actionConfig = getActionConfig(currentSchedule);

	const urgencyMessage = (() => {
		switch (status) {
			case 'current':
				return '現在進行中';
			case 'overdue':
				return `${Math.abs(timeUntil || 0)}分前に開始予定でした`;
			case 'upcoming':
				return `${timeUntil}分後に開始予定`; // 15分以内
			case 'next':
				return `次の予定まで${timeUntil}分`; // 15分以上
			case 'completed':
				return '完了済み';
			default:
				return '';
		}
	})();

	const importantNotes = schedule.notes && isImportantNote(schedule.notes);

	return (
		<div className={`bg-white rounded-xl shadow-lg border-l-4 ${statusStyle.cardBorder} p-4 ${className}`}>
			{/* ヘッダー */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<div className={`w-3 h-3 rounded-full ${statusStyle.statusDot}`}></div>
					<span className={`text-sm font-medium ${statusStyle.statusText}`}>
						{urgencyMessage}
					</span>
				</div>
				<span className="text-xs text-gray-500">{formatTimeRange(schedule.start, schedule.end)}</span>
			</div>

			{/* 予定内容 */}
			<div className="mb-4">
				<h3 className="text-lg font-semibold text-gray-900 mb-1">
					{schedule.title}
				</h3>
				{schedule.location && (
					<p className="text-sm text-gray-600">📍 {schedule.location}</p>
				)}
				{importantNotes && (
					<div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
						<p className="text-xs text-red-700 font-medium">⚠️ 重要注意事項あり</p>
					</div>
				)}
			</div>

			{/* アクションボタン */}
			<div className="space-y-2">
				<button
					className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
						actionConfig.variant === 'primary'
							? 'bg-emerald-600 text-white hover:bg-emerald-700'
							: actionConfig.variant === 'success'
							? 'bg-green-600 text-white hover:bg-green-700'
							: actionConfig.variant === 'warning'
							? 'bg-orange-600 text-white hover:bg-orange-700'
							: 'bg-gray-600 text-white hover:bg-gray-700'
					}`}
					onClick={() => onPrimaryAction?.(currentSchedule)}
				>
					{actionConfig.icon} {actionConfig.text}
				</button>

				<div className="flex gap-2">
					<button
						className="flex-1 py-1.5 px-3 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
						onClick={() => onViewDetail?.(currentSchedule)}
					>
						詳細
					</button>
					<button
						className="flex-1 py-1.5 px-3 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
						onClick={() => onEmergencyContact?.(currentSchedule)}
					>
						緊急連絡
					</button>
					<button
						className="flex-1 py-1.5 px-3 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50"
						onClick={() => onReportIssue?.(currentSchedule)}
					>
						問題報告
					</button>
				</div>
			</div>
		</div>
	);
};

export default NextActionCard;
