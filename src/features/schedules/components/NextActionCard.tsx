import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { SxProps, Theme } from '@mui/material/styles';
import { useMemo } from 'react';

// ===== Types (exported for external use) =====

/** 最小限のスケジュール情報型 */
export interface MinimalSchedule {
	id: string;
	title: string;
	start: string;
	end: string;
	status?: string;
	notes?: string;
	location?: string;
}

type ScheduleStatus = 'upcoming' | 'current' | 'overdue' | 'completed' | 'next';

export interface ScheduleWithStatus {
	schedule: MinimalSchedule;
	status: ScheduleStatus;
	timeUntil?: number; // minutes until start (negative if overdue)
	actionType: 'start' | 'record' | 'complete' | 'review' | 'wait';
}

// ===== Pure logic (exported for testing) =====

/**
 * 重要な注意事項の検出
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

/**
 * 現在時刻とスケジュールの関係を分析して最適な1つを選出
 */
export function analyzeCurrentSchedule(schedules: MinimalSchedule[]): ScheduleWithStatus | null {
	if (!schedules.length) return null;

	const now = new Date();
	const currentTime = now.getTime();

	const analyzed = schedules
		.map((schedule): ScheduleWithStatus | null => {
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
			if (isMarkedCompleted && currentTime > endTime) return null;

			let status: ScheduleStatus;
			let actionType: ScheduleWithStatus['actionType'];

			if (currentTime >= startTime && currentTime <= endTime) {
				status = 'current';
				actionType = schedule.status === '完了' ? 'review' : 'record';
			} else if (currentTime < startTime) {
				if (minutesUntilStart <= 15) {
					status = 'upcoming';
					actionType = 'start';
				} else {
					status = 'next';
					actionType = 'wait';
				}
			} else {
				if (schedule.status === '完了') {
					status = 'completed';
					actionType = 'review';
				} else if (minutesSinceStart <= 30) {
					status = 'overdue';
					actionType = 'complete';
				} else {
					status = 'completed';
					actionType = 'review';
				}
			}

			return { schedule, status, timeUntil: minutesUntilStart, actionType };
		})
		.filter((x): x is ScheduleWithStatus => x !== null);

	if (!analyzed.length) return null;

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
			return Math.abs(a.timeUntil || 0) - Math.abs(b.timeUntil || 0);
		})[0] || null;
}

// ===== Helpers =====

function formatTimeRange(start: string, end: string): string {
	const startDate = new Date(start);
	const endDate = new Date(end);
	const fmt = (d: Date) =>
		d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false });
	return `${fmt(startDate)} - ${fmt(endDate)}`;
}

/** MUI theme-compatible status colors */
const STATUS_CONFIG: Record<ScheduleStatus, {
	borderColor: string;
	chipColor: 'success' | 'error' | 'warning' | 'info' | 'default';
	label: string;
}> = {
	current: { borderColor: 'success.main', chipColor: 'success', label: '進行中' },
	overdue: { borderColor: 'error.main', chipColor: 'error', label: '遅延' },
	upcoming: { borderColor: 'warning.main', chipColor: 'warning', label: 'まもなく' },
	next: { borderColor: 'info.main', chipColor: 'info', label: '次の予定' },
	completed: { borderColor: 'grey.400', chipColor: 'default', label: '完了' },
};

/** MUI Button color mapping */
const ACTION_CONFIG: Record<ScheduleWithStatus['actionType'], {
	text: string;
	color: 'primary' | 'success' | 'warning' | 'info';
	icon: React.ReactNode;
}> = {
	start: { text: 'サービス開始', color: 'primary', icon: <PlayArrowIcon /> },
	record: { text: 'サービス記録を記入', color: 'success', icon: <EditIcon /> },
	complete: { text: '完了報告', color: 'warning', icon: <CheckCircleIcon /> },
	review: { text: '記録を確認', color: 'info', icon: <VisibilityIcon /> },
	wait: { text: '予定の詳細を表示', color: 'info', icon: <InfoOutlinedIcon /> },
};

function getUrgencyMessage(status: ScheduleStatus, timeUntil?: number): string {
	switch (status) {
		case 'current':
			return '現在進行中';
		case 'overdue':
			return `${Math.abs(timeUntil || 0)}分前に開始予定でした`;
		case 'upcoming':
			return `${timeUntil}分後に開始予定`;
		case 'next':
			return `次の予定まで${timeUntil}分`;
		case 'completed':
			return '完了済み';
		default:
			return '';
	}
}

// ===== Component =====

interface NextActionCardProps {
	schedules: MinimalSchedule[];
	sx?: SxProps<Theme>;
	onPrimaryAction?: (item: ScheduleWithStatus) => void;
	onViewDetail?: (item: ScheduleWithStatus) => void;
	onEmergencyContact?: (item: ScheduleWithStatus) => void;
	onReportIssue?: (item: ScheduleWithStatus) => void;
}

const NextActionCard: React.FC<NextActionCardProps> = ({
	schedules,
	sx,
	onPrimaryAction,
	onViewDetail,
	onEmergencyContact,
	onReportIssue,
}) => {
	const currentSchedule = useMemo(() => analyzeCurrentSchedule(schedules), [schedules]);

	// 予定がない場合
	if (!currentSchedule) {
		return (
			<Card variant="outlined" sx={{ borderRadius: 3, ...sx }}>
				<CardContent sx={{ textAlign: 'center', py: 3 }}>
					<SentimentSatisfiedAltIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
					<Typography variant="h6" color="text.primary" gutterBottom>
						現在の予定はありません
					</Typography>
					<Typography variant="body2" color="text.secondary">
						お疲れ様です。次の予定をお待ちください。
					</Typography>
				</CardContent>
			</Card>
		);
	}

	const { schedule, status, timeUntil } = currentSchedule;
	const statusCfg = STATUS_CONFIG[status];
	const actionCfg = ACTION_CONFIG[currentSchedule.actionType];
	const urgencyMessage = getUrgencyMessage(status, timeUntil);
	const importantNotes = schedule.notes && isImportantNote(schedule.notes);

	return (
		<Card
			variant="outlined"
			sx={{
				borderRadius: 3,
				borderLeft: 4,
				borderLeftColor: statusCfg.borderColor,
				...sx,
			}}
		>
			<CardContent>
				{/* ヘッダー: ステータス + 時間 */}
				<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
					<Chip
						label={urgencyMessage}
						color={statusCfg.chipColor}
						size="small"
						variant="filled"
					/>
					<Typography variant="caption" color="text.secondary">
						{formatTimeRange(schedule.start, schedule.end)}
					</Typography>
				</Box>

				{/* 予定内容 */}
				<Box sx={{ mb: 2.5 }}>
					<Typography variant="h6" fontWeight="bold" gutterBottom>
						{schedule.title}
					</Typography>
					{schedule.location && (
						<Stack direction="row" spacing={0.5} alignItems="center">
							<PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
							<Typography variant="body2" color="text.secondary">
								{schedule.location}
							</Typography>
						</Stack>
					)}
					{importantNotes && (
						<Alert
							severity="error"
							icon={<WarningAmberIcon fontSize="small" />}
							sx={{ mt: 1.5, py: 0 }}
						>
							<Typography variant="caption" fontWeight="bold">
								重要注意事項あり
							</Typography>
						</Alert>
					)}
				</Box>

				{/* アクションボタン */}
				<Stack spacing={1.5}>
					<Button
						variant="contained"
						color={actionCfg.color}
						fullWidth
						startIcon={actionCfg.icon}
						onClick={() => onPrimaryAction?.(currentSchedule)}
						sx={{
							py: 1.25,
							borderRadius: 2,
							fontWeight: 'bold',
							textTransform: 'none',
						}}
					>
						{actionCfg.text}
					</Button>

					<Stack direction="row" spacing={1}>
						<Button
							variant="outlined"
							size="small"
							fullWidth
							onClick={() => onViewDetail?.(currentSchedule)}
							sx={{ textTransform: 'none' }}
						>
							詳細
						</Button>
						<Button
							variant="outlined"
							size="small"
							fullWidth
							onClick={() => onEmergencyContact?.(currentSchedule)}
							sx={{ textTransform: 'none' }}
						>
							緊急連絡
						</Button>
						<Button
							variant="outlined"
							size="small"
							fullWidth
							onClick={() => onReportIssue?.(currentSchedule)}
							sx={{ textTransform: 'none' }}
						>
							問題報告
						</Button>
					</Stack>
				</Stack>
			</CardContent>
		</Card>
	);
};

export default NextActionCard;
