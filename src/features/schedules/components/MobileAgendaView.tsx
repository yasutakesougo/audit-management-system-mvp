import { tid } from '@/testids';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import React from 'react';
import { useSchedulesToday, type MiniSchedule } from '../hooks/useSchedulesToday';

type ScheduleConflict = {
	id?: string | number;
	[key: string]: unknown;
};

interface MobileAgendaViewProps {
	/** 表示する日付（省略時は今日） */
	date?: Date;
	/** 特定ユーザーの予定のみ表示する場合のユーザーID */
	userId?: string;
	/** 最大表示件数 */
	maxItems?: number;
	/** 衝突検知インデックス */
	conflictIndex?: Record<string, ScheduleConflict[]>;
}

/**
 * モバイル・タブレット向けの今日のタスク一覧（アジェンダビュー）
 *
 * 現場職員がスマートフォンで「今日自分は何をすべきか」をすぐに確認できる
 * シンプルで直感的な時系列リスト表示
 */
const MobileAgendaView: React.FC<MobileAgendaViewProps> = ({
	date = new Date(),
	userId,
	maxItems = 10,
	conflictIndex,
}) => {
	const { data: schedules, loading, error } = useSchedulesToday(maxItems);

	// 日付ヘッダーの表示
	const dateLabel = format(date, 'M月d日（E）', { locale: ja });
	const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

	// schedules が undefined の場合のガード（フェッチ失敗後のリトライ途中など）
	const rawSchedules = schedules ?? [];

	// ユーザーフィルタリング（指定された場合）
	// MiniScheduleには担当者情報がないため、現状は全ての予定を表示
	// 将来的にはtitle内の担当者名での部分マッチングなどを検討
	const filteredSchedules = userId
		? rawSchedules.filter((schedule: MiniSchedule) =>
				schedule.title.includes(userId) // タイトルに担当者名が含まれる場合
			)
		: rawSchedules;

	// ローディング状態
	if (loading) {
		return (
			<Box
				display="flex"
				justifyContent="center"
				alignItems="center"
				minHeight="200px"
				flexDirection="column"
				gap={2}
				{...tid('mobile-agenda-loading')}
			>
				<CircularProgress size={40} />
				<Typography variant="body2" color="text.secondary">
					今日の予定を読み込んでいます...
				</Typography>
			</Box>
		);
	}

	// エラー状態
	if (error) {
		return (
			<Alert
				severity="warning"
				sx={{ mx: 2, mt: 2 }}
				{...tid('mobile-agenda-error')}
			>
				予定の読み込みに失敗しました。ネットワークを確認してください。
			</Alert>
		);
	}

	// 空の状態
	if (filteredSchedules.length === 0) {
		return (
			<Box
				sx={{ p: 3, textAlign: 'center' }}
				{...tid('mobile-agenda-empty')}
			>
				<Typography variant="h6" gutterBottom>
					{isToday ? '今日' : dateLabel}の予定
				</Typography>
				<Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
					{userId ? 'あなたの予定はありません' : '予定が登録されていません'}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					お疲れ様です！
				</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ p: 2 }} {...tid('mobile-agenda-container')}>
			{/* ヘッダー */}
			<Box sx={{ mb: 3, textAlign: 'center' }}>
				<Typography variant="h5" component="h1" fontWeight="bold" gutterBottom>
					{isToday ? '今日' : dateLabel}の予定
				</Typography>
				{isToday && (
					<Chip
						label="TODAY"
						size="small"
						color="primary"
						variant="filled"
						sx={{ fontWeight: 'bold' }}
					/>
				)}
			</Box>

			{/* 予定リスト */}
			<Stack spacing={2}>
				{filteredSchedules.map((schedule, index) => (
					<AgendaCard
						key={schedule.id || index}
						schedule={schedule}
						conflictIndex={conflictIndex}
					/>
				))}
			</Stack>

			{/* フッター情報 */}
			{filteredSchedules.length > 0 && (
				<Box sx={{ mt: 3, textAlign: 'center' }}>
					<Typography variant="caption" color="text.secondary">
						全{filteredSchedules.length}件の予定
					</Typography>
				</Box>
			)}
		</Box>
	);
};

interface AgendaCardProps {
	schedule: MiniSchedule;
	conflictIndex?: Record<string, ScheduleConflict[]>;
}

const AgendaCard: React.FC<AgendaCardProps> = ({ schedule, conflictIndex }) => {
	const getStatusColor = (status?: string) => {
		switch (status) {
			case '確定':
			case 'confirmed':
				return 'success';
			case '予定':
			case 'planned':
				return 'primary';
			case '欠勤':
			case 'absent':
				return 'error';
			case '休暇':
			case 'holiday':
				return 'warning';
			default:
				return 'default';
		}
	};

	const getStatusLabel = (status?: string) => {
		switch (status) {
			case 'confirmed':
				return '確定';
			case 'planned':
				return '予定';
			case 'absent':
				return '欠勤';
			case 'holiday':
				return '休暇';
			default:
				return status || '予定';
		}
	};

	// Check for conflicts - Boolean()でキャストして型安全性を向上
	// conflictIndex は undefined の可能性があるため、適切なガードを追加
	const conflicted = Boolean(
		schedule.id && conflictIndex?.[String(schedule.id)]?.length
	);

	return (
		<Card
			variant="outlined"
			{...tid(
				conflicted
					? 'mobile-agenda-schedule-conflict'
					: 'mobile-agenda-schedule-item',
			)}
			data-schedule-id={schedule.id}
			sx={{
				borderRadius: 2,
				borderLeft: conflicted ? '4px solid' : undefined,
				borderLeftColor: conflicted ? 'error.main' : undefined,
				backgroundColor: conflicted ? 'error.light' : undefined,
				'&:hover': {
					boxShadow: 2,
					transform: 'translateY(-1px)',
					transition: 'all 0.2s ease-in-out',
				}
			}}
		>
			<CardContent sx={{ pb: 2 }}>
				<Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
					{/* 時刻表示 */}
					<Box
						sx={{
							minWidth: 60,
							textAlign: 'center',
							p: 1,
							borderRadius: 1,
							backgroundColor: 'grey.100',
						}}
					>
						<Typography variant="caption" color="text.secondary">
							{schedule.startText || '時刻未定'}
						</Typography>
					</Box>

					{/* 予定内容 */}
					<Box sx={{ flex: 1 }}>
						<Typography variant="subtitle1" fontWeight="bold" gutterBottom>
							{schedule.title || 'タイトル未設定'}
						</Typography>
						<Stack direction="row" spacing={1} alignItems="center">
							<Chip
								label={getStatusLabel(schedule.status)}
								size="small"
								color={getStatusColor(schedule.status)}
								variant="outlined"
							/>
							{schedule.allDay && (
								<Chip
									label="終日"
									size="small"
									variant="outlined"
									color="info"
								/>
							)}
						</Stack>
					</Box>
				</Box>
			</CardContent>
		</Card>
	);
};

export default MobileAgendaView;
