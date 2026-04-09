import { ScheduleLanesWidget } from '@/features/dashboard/components/ScheduleLanesWidget';
import HandoffSummaryForMeeting from '@/features/handoff/HandoffSummaryForMeeting';
import type { HandoffDayScope } from '@/features/handoff/handoffTypes';
import type { IUserMaster } from '@/sharepoint/fields';
import {
    Alert,
    Avatar,
    Card,
    CardContent,
    CardHeader,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { ScheduleLanes } from './ScheduleSection';

export interface StaffOnlySectionProps {
  /** Morning time flag (8:00-12:00) */
  isMorningTime: boolean;
  /** Evening time flag (17:00-19:00) */
  isEveningTime: boolean;
  /** Daily status cards data */
  dailyStatusCards: Array<{
    label: string;
    value: string | number;
    helper: string;
    color?: string;
    emphasize?: boolean;
  }>;
  /** Prioritized users for morning briefing */
  prioritizedUsers: IUserMaster[];
  /** Schedule lanes for today */
  scheduleLanesToday: ScheduleLanes;
  /** Schedule lanes for tomorrow */
  scheduleLanesTomorrow: ScheduleLanes;
  /** Stats data */
  stats: {
    seizureCount: number;
    problemBehaviorStats: {
      selfHarm: number;
      otherInjury: number;
      loudVoice: number;
      pica: number;
      other: number;
    };
  };
  /** Handler to open timeline */
  onOpenTimeline: (scope: HandoffDayScope) => void;
}

export function StaffOnlySection({
  isMorningTime,
  isEveningTime,
  dailyStatusCards,
  prioritizedUsers,
  scheduleLanesToday,
  scheduleLanesTomorrow,
  stats,
  onOpenTimeline,
}: StaffOnlySectionProps) {
  return (
    <Stack spacing={3} data-testid="dashboard-section-staffOnly">
      {/* 🌅 朝会カード */}
      <Card
        elevation={3}
        sx={{
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: isMorningTime ? 'primary.main' : 'divider',
        }}
      >
        <CardHeader
          title="🌅 朝会情報（9:00）"
          titleTypographyProps={{ variant: 'h5', fontWeight: 600 }}
          sx={{
            bgcolor: (theme) =>
              isMorningTime
                ? alpha(theme.palette.primary.main, 0.08)
                : 'transparent',
          }}
        />
        <CardContent sx={{ py: 1.25, px: 1.5 }}>
          <Stack spacing={3}>
            <HandoffSummaryForMeeting
              dayScope="yesterday"
              title="前日からの申し送り引き継ぎ"
              description="朝会では前日までの申し送りを確認し、優先対応が必要な案件をタイムラインからピックアップします。"
              actionLabel="タイムラインを開く"
              onOpenTimeline={() => onOpenTimeline('yesterday')}
            />

            <Card>
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Typography variant="h6" gutterBottom>
                  重点フォロー利用者
                </Typography>
                {prioritizedUsers.length > 0 ? (
                  <List dense>
                    {prioritizedUsers.map((user) => (
                      <ListItem key={user.Id} disableGutters>
                        <ListItemAvatar>
                          <Avatar>{user.FullName?.charAt(0) ?? '利'}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={user.FullName ?? '利用者'}
                          secondary="支援手順の実施の確認をお願いします"
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="success">
                    現在フォロー対象の利用者はありません。
                  </Alert>
                )}
              </CardContent>
            </Card>

            <ScheduleLanesWidget title="今日の予定" lanes={scheduleLanesToday} />
          </Stack>
        </CardContent>
      </Card>

      {/* 🌆 夕会カード */}
      <Card
        elevation={3}
        sx={{
          borderWidth: 2,
          borderStyle: 'solid',
          borderColor: isEveningTime ? 'secondary.main' : 'divider',
        }}
      >
        <CardHeader
          title="🌆 夕会情報（17:15）"
          titleTypographyProps={{ variant: 'h5', fontWeight: 600 }}
          sx={{
            bgcolor: (theme) =>
              isEveningTime
                ? alpha(theme.palette.secondary.main, 0.08)
                : 'transparent',
          }}
        />
        <CardContent sx={{ py: 1.25, px: 1.5 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Typography variant="h6" gutterBottom>
                  本日の振り返り
                </Typography>
                <Stack spacing={2}>
                  {dailyStatusCards.map(({ label, value, helper, color, emphasize }) => (
                    <Paper key={label} variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {label}
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: emphasize ? 800 : 700,
                          color,
                          mt: 0.5,
                        }}
                      >
                        {value}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {helper}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ py: 1.25, px: 1.5 }}>
                <Typography variant="h6" gutterBottom>
                  健康・行動トピック
                </Typography>
                <Stack spacing={2}>
                  {stats.seizureCount > 0 ? (
                    <Alert severity="warning">
                      本日 {stats.seizureCount} 件の発作対応がありました。詳細記録を確認してください。
                    </Alert>
                  ) : (
                    <Alert severity="success">
                      発作対応はありませんでした。
                    </Alert>
                  )}
                  {Object.values(stats.problemBehaviorStats).some(
                    (count) => count > 0,
                  ) ? (
                    <Alert severity="error">
                      問題行動が記録されています。対応履歴と支援手順の見直しを検討してください。
                    </Alert>
                  ) : (
                    <Alert severity="info">
                      問題行動の記録はありません。
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <HandoffSummaryForMeeting
              dayScope="today"
              title="明日への申し送り候補"
              description="夕会では今日の申し送りを最終確認し、重要なトピックをタイムラインに集約して明日へ引き継ぎます。"
              actionLabel="タイムラインで確認"
              onOpenTimeline={() => onOpenTimeline('today')}
            />

            <ScheduleLanesWidget title="明日の予定" lanes={scheduleLanesTomorrow} />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
