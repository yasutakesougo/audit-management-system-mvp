import { dailyPaths } from '@/app/links/dailyLinks';
import { buildTodayReturnUrl, parseNavQuery } from '@/app/links/navigationLinks';
import { motionTokens } from '@/app/theme';
import { useAttendanceStore } from '@/features/attendance/store';
import { CommandBar } from '@/features/dashboard/components/CommandBar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AttendanceIcon from '@mui/icons-material/AssignmentInd';
import SupportIcon from '@mui/icons-material/AssignmentTurnedIn';
import GroupIcon from '@mui/icons-material/Group';
import PeopleIcon from '@mui/icons-material/People';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { IUserMaster } from '../features/users/types';
import { useUsers } from '../features/users/useUsers';

type DailyHubSummary = {
  activity: {
    pending: number;
    inProgress: number;
  };
  support: {
    total: number;
    incomplete: number;
  };
  attendance: {
    absence: number;
    lateOrEarly: number;
  };
};

const getUserSeed = (userId: string | number | null | undefined, fallback: number) => {
  const raw = String(userId ?? fallback);
  const digits = raw.replace(/\D/g, '');
  const seed = Number(digits);
  return Number.isNaN(seed) || seed === 0 ? fallback : seed;
};

const useDailyHubSummary = (users: IUserMaster[]) => {
  const { visits } = useAttendanceStore();

  return useMemo<DailyHubSummary>(() => {
    const activity = users.reduce(
      (acc, user, index) => {
        const seed = getUserSeed(user.UserID ?? user.Id, index + 1);
        if (seed % 11 === 0) {
          acc.pending += 1;
        } else if (seed % 5 === 0) {
          acc.inProgress += 1;
        }
        return acc;
      },
      { pending: 0, inProgress: 0 },
    );

    const supportTargets = users.filter((user) => Boolean(user.IsSupportProcedureTarget));
    const support = supportTargets.reduce(
      (acc, user, index) => {
        const seed = getUserSeed(user.UserID ?? user.Id, index + 1);
        if (seed % 7 === 0 || seed % 5 === 0) {
          acc.incomplete += 1;
        }
        return acc;
      },
      { total: supportTargets.length, incomplete: 0 },
    );

    const visitList = Object.values(visits ?? {});
    const attendance = visitList.reduce(
      (acc, visit) => {
        if (visit.status === '当日欠席' || visit.status === '事前欠席') {
          acc.absence += 1;
        }
        if (visit.isEarlyLeave) {
          acc.lateOrEarly += 1;
        }
        return acc;
      },
      { absence: 0, lateOrEarly: 0 },
    );

    return { activity, support, attendance };
  }, [users, visits]);
};

const DailyRecordMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { from: navFrom, date: navDate } = parseNavQuery(searchParams);
  const fromToday = navFrom === 'today';
  const { data: usersRaw } = useUsers();
  const users = usersRaw ?? []; // ← 常に配列にしておく
  const dailyHubSummary = useDailyHubSummary(users);

  // 統計計算（安全ガード付き）
  const totalUsers = users.length;
  const intensiveSupportUsers = users.filter(user => user.IsSupportProcedureTarget).length;

  const activityCaption = useMemo(() => {
    const { pending, inProgress } = dailyHubSummary.activity;
    if (pending === 0 && inProgress === 0) return null;
    return `未入力 ${pending} / 入力中 ${inProgress}`;
  }, [dailyHubSummary.activity]);

  const supportCaption = useMemo(() => {
    const { total, incomplete } = dailyHubSummary.support;
    if (total === 0 && incomplete === 0) return null;
    return `今日 ${total}件 / 未完了 ${incomplete}`;
  }, [dailyHubSummary.support]);

  const attendanceCaption = useMemo(() => {
    const { absence, lateOrEarly } = dailyHubSummary.attendance;
    if (absence === 0 && lateOrEarly === 0) return null;
    return `欠席 ${absence} / 遅刻・早退 ${lateOrEarly}`;
  }, [dailyHubSummary.attendance]);

  const activityCaptionColor = dailyHubSummary.activity.pending > 0 ? 'warning.main' : 'text.secondary';
  const supportCaptionColor = dailyHubSummary.support.incomplete > 0 ? 'warning.main' : 'text.secondary';
  const attendanceCaptionColor =
    dailyHubSummary.attendance.absence > 0 || dailyHubSummary.attendance.lateOrEarly > 0
      ? 'warning.main'
      : 'text.secondary';

  // ── CommandBar KPI 算出 ──
  const attendanceIssues = dailyHubSummary.attendance.absence + dailyHubSummary.attendance.lateOrEarly;
  const activityDone = totalUsers - dailyHubSummary.activity.pending - dailyHubSummary.activity.inProgress;

  // CommandBar チップクリック → 該当カードへスクロール
  const handleChipClick = useCallback((section: string) => {
    const idMap: Record<string, string> = {
      pending: 'daily-card-table-activity',
      critical: 'daily-card-attendance',
      attendance: 'daily-card-attendance',
      daily: 'daily-card-table-activity',
    };
    const targetId = idMap[section];
    if (targetId) {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // 日付ラベル
  const dateLabel = useMemo(() => {
    const d = navDate ? new Date(navDate) : new Date();
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;
  }, [navDate]);

  return (
    <Container maxWidth="lg" data-testid="daily-record-menu">
      <Box data-testid="daily-hub-root" sx={{ py: 3 }}>
        {/* ── コンパクトヘッダー + CommandBar ── */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {fromToday && (
                <Button
                  data-testid="daily-hub-return-today"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate(buildTodayReturnUrl(navDate))}
                  size="small"
                >
                  今日の運用へ
                </Button>
              )}
              <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
                日々の記録
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dateLabel}
              </Typography>
            </Box>
          </Box>

          {/* KPI CommandBar — ファーストビュー最上部 */}
          <CommandBar
            pendingHandoffs={dailyHubSummary.activity.pending}
            criticalAlerts={attendanceIssues}
            attendanceRatio={{ present: totalUsers - dailyHubSummary.attendance.absence, total: totalUsers }}
            dailyRecordRatio={{ done: activityDone > 0 ? activityDone : 0, total: totalUsers }}
            onChipClick={handleChipClick}
          />
        </Box>

        {/* メニューカード */}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={4}
          sx={{ mb: 4, flexWrap: 'wrap' }}
        >
          {/* 一覧形式の日々の記録 IMPROVED */}
          <Card
            data-testid="daily-card-table-activity"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              transition: motionTokens.transition.hoverElevation,
              border: '2px solid',
              borderColor: 'primary.main',
              '&:hover': {
                transform: 'translateY(-4px)',
                elevation: 8
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GroupIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                <Typography variant="h5" component="h2">
                  一覧形式の日々の記録
                </Typography>
                <Chip
                  label="IMPROVED"
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              </Box>

              {activityCaption && (
                <Typography
                  variant="caption"
                  color={activityCaptionColor}
                  noWrap
                  sx={{ display: 'block', mb: 1 }}
                >
                  {activityCaption}
                </Typography>
              )}

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                利用者を行として表形式で並べて効率的に記録できます
              </Typography>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    対象：選択した複数利用者
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  📋 利用者＝行、項目＝列の表形式
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ⚡ AM活動・PM活動・昼食・問題行動を横並び
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  🎯 タブ移動でサクサク入力
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  🔍 検索・フィルタで利用者選択
                </Typography>
              </Stack>
            </CardContent>

            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => navigate(dailyPaths.table)}
                startIcon={<GroupIcon />}
                data-testid="btn-open-table-activity"
              >
                一覧形式の日々の記録を開く
              </Button>
            </CardActions>
          </Card>

          {/* 通所管理 */}
          <Card
            data-testid="daily-card-attendance"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              transition: motionTokens.transition.hoverElevation,
              '&:hover': {
                transform: 'translateY(-4px)',
                elevation: 8
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttendanceIcon sx={{ fontSize: 32, color: 'info.main', mr: 2 }} />
                <Typography variant="h5" component="h2">
                  通所管理
                </Typography>
              </Box>

              {attendanceCaption && (
                <Typography
                  variant="caption"
                  color={attendanceCaptionColor}
                  noWrap
                  sx={{ display: 'block', mb: 1 }}
                >
                  {attendanceCaption}
                </Typography>
              )}

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                通所・退所・欠席加算など、当日の通所状況を一元管理します
              </Typography>

              <Stack spacing={1}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    対象：日次通所者（{totalUsers}名）
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  • 通所・退所のワンタップ操作
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 欠席連絡・夕方確認の記録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 送迎状況や欠席加算の管理
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 実提供時間と算定時間の乖離チェック
                </Typography>
              </Stack>
            </CardContent>

            <CardActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                color="info"
                onClick={() => navigate(dailyPaths.attendance)}
                startIcon={<AttendanceIcon />}
                data-testid="btn-open-attendance"
              >
                通所管理を開く
              </Button>
            </CardActions>
          </Card>

          {/* 支援手順の実施 */}
          <Card
            data-testid="daily-card-support"
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              transition: motionTokens.transition.hoverElevation,
              '&:hover': {
                transform: 'translateY(-4px)',
                elevation: 8
              }
            }}
          >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SupportIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />
                <Typography variant="h5" component="h2">
                  支援手順の実施
                </Typography>
              </Box>

              {supportCaption && (
                <Typography
                  variant="caption"
                  color={supportCaptionColor}
                  noWrap
                  sx={{ display: 'block', mb: 1 }}
                >
                  {supportCaption}
                </Typography>
              )}

              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                個別支援計画に基づく支援手順の実施状況を記録します
              </Typography>

                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      対象：強度行動障害支援対象者（{intensiveSupportUsers}名）
                    </Typography>
                    <Chip
                      label="⚑ 特別支援"
                      size="small"
                      color="warning"
                      sx={{ fontSize: '0.6rem' }}
                    />
                  </Box>
                <Typography variant="body2" color="text.secondary">
                  • 個別支援計画テンプレート
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 1日19行の支援手順展開
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 本人の様子・反応記録
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 支援効果の観察・評価
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • 手順変更・改善点の記録
                </Typography>
              </Stack>
            </CardContent>

            <CardActions sx={{ p: 3, pt: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                color="secondary"
                onClick={() => navigate(dailyPaths.support)}
                startIcon={<SupportIcon />}
                data-testid="btn-open-support"
              >
                支援手順の実施を開く
              </Button>

              <Button
                variant="text"
                size="small"
                color="inherit"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  textDecoration: 'underline',
                  '&:hover': { backgroundColor: 'transparent', color: 'text.primary' }
                }}
                onClick={() => navigate(dailyPaths.timeBased)}
              >
                ※時間帯ごとに記録する画面はこちら
              </Button>

              <Button
                variant="text"
                size="small"
                color="inherit"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.75rem',
                  textDecoration: 'underline',
                  '&:hover': { backgroundColor: 'transparent', color: 'text.primary' }
                }}
                onClick={() => navigate(dailyPaths.supportChecklist)}
              >
                ※従来のチェックリスト形式はこちら
              </Button>
            </CardActions>
          </Card>
        </Stack>

      </Box>
    </Container>
  );
};

export default DailyRecordMenuPage;
