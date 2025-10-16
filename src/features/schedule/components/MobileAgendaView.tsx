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
import { useSchedulesToday, type MiniSchedule } from '../useSchedulesToday';

interface MobileAgendaViewProps {
  /** 表示する日付（省略時は今日） */
  date?: Date;
  /** 特定ユーザーの予定のみ表示する場合のユーザーID */
  userId?: string;
  /** 最大表示件数 */
  maxItems?: number;
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
}) => {
  const { data: schedules, loading, error } = useSchedulesToday(maxItems);

  // 日付ヘッダーの表示
  const dateLabel = format(date, 'M月d日（E）', { locale: ja });
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // ユーザーフィルタリング（指定された場合）
  // MiniScheduleには担当者情報がないため、現状は全ての予定を表示
  // 将来的にはtitle内の担当者名での部分マッチングなどを検討
  const filteredSchedules = userId
    ? schedules.filter((schedule: MiniSchedule) =>
        schedule.title.includes(userId) // タイトルに担当者名が含まれる場合
      )
    : schedules;

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
      <Alert severity="warning" sx={{ mx: 2, mt: 2 }}>
        予定の読み込みに失敗しました。ネットワークを確認してください。
      </Alert>
    );
  }

  // 空の状態
  if (filteredSchedules.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
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
    <Box sx={{ p: 2 }}>
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
}

const AgendaCard: React.FC<AgendaCardProps> = ({ schedule }) => {
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

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
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
          <Box sx={{ minWidth: 80, textAlign: 'center' }}>
            {schedule.allDay ? (
              <Typography variant="body2" color="primary" fontWeight="bold">
                終日
              </Typography>
            ) : (
              <Typography variant="body1" color="primary" fontWeight="bold">
                {schedule.startText || '時間未設定'}
              </Typography>
            )}
          </Box>

          {/* 予定内容 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              component="h3"
              fontWeight="bold"
              sx={{ mb: 1, wordBreak: 'break-word' }}
            >
              {schedule.title}
            </Typography>

            {schedule.status && (
              <Chip
                label={getStatusLabel(schedule.status)}
                size="small"
                color={getStatusColor(schedule.status)}
                variant="outlined"
              />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MobileAgendaView;