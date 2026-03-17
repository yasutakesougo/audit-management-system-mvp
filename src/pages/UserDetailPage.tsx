/**
 * UserDetailPage — 利用者起点ハブ
 *
 * MVP-003: リダイレクト専用ページから「利用者の操作起点」へ変換。
 *
 * ## 責務
 * - 利用者プロフィール概要表示
 * - Quick Actions: Today/Daily/Handoff/Planning への1タップ遷移
 * - Summary Cards: 未入力件数、最新記録日、注意事項
 * - Empty State: 利用者が見つからない場合のフォールバック
 *
 * ## 設計方針
 * - "詳細閲覧ページ"ではなく"操作ハブ"として設計
 * - 情報量より「次にどこへ行くか」を優先
 * - EmptyStateAction (MVP-001) を空状態に再利用
 */
import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ── MUI ──
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ── App ──
import { EmptyStateAction } from '@/components/ui/EmptyStateAction';
import { useUsers } from '@/features/users/useUsers';
import { buildQuickActions, buildSummaryStats, type QuickAction, type SummaryStat } from '@/features/users/domain/userDetailHubLogic';

// ─── Component ────────────────────────────────────────────────

const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  // ── 利用者データ取得 ──
  const { data: users, status } = useUsers();
  const user = useMemo(() => {
    if (!userId || !users.length) return null;
    return (
      users.find((u) => u.UserID === userId) ??
      users.find((u) => String(u.Id) === userId) ??
      null
    );
  }, [users, userId]);

  // ── クイックアクション ──
  const quickActions = useMemo(
    () => (userId ? buildQuickActions(userId) : []),
    [userId],
  );

  // ── サマリー統計 ──
  const summaryStats = useMemo(() => {
    if (!user) return [];
    return buildSummaryStats({
      todayRecordExists: false,       // Phase 2: 実データ接続
      latestDailyRecord: null,        // Phase 2: 実データ接続
      handoffInfo: null,              // Phase 2: 実データ接続
      isHighIntensity: user.IsHighIntensitySupportTarget ?? false,
    });
  }, [user]);

  // ── Loading ──
  if (status === 'loading') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ minHeight: '40vh' }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">利用者情報を読み込み中...</Typography>
        </Stack>
      </Container>
    );
  }

  // ── User Not Found ──
  if (!user) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate('/users')}
          sx={{ mb: 2 }}
        >
          利用者一覧に戻る
        </Button>
        <EmptyStateAction
          icon="🔍"
          title="利用者が見つかりません"
          description={`ID「${userId ?? ''}」に一致する利用者が見つかりませんでした。利用者一覧から再度選択してください。`}
          actionLabel="利用者一覧を開く"
          onAction={() => navigate('/users')}
          variant="warning"
          testId="user-detail-not-found"
        />
      </Container>
    );
  }

  // ── 利用者情報の計算 ──
  const displayName = user.FullName || '氏名未登録';
  const userCode = user.UserID || String(user.Id);
  const isActive = user.IsActive !== false;
  const attendanceDays = user.AttendanceDays?.length ? user.AttendanceDays.join('・') : '—';

  return (
    <Container maxWidth="md" sx={{ py: 3 }} data-testid="user-detail-hub">
      {/* ── Back Navigation ── */}
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate('/users')}
        sx={{ mb: 2 }}
        data-testid="user-detail-back"
      >
        利用者一覧に戻る
      </Button>

      <Stack spacing={3}>
        {/* ════════════════════════════════════════════════════════════
            Section 1: Profile Header
           ════════════════════════════════════════════════════════════ */}
        <Paper sx={{ p: 3, borderRadius: 3 }} elevation={1} data-testid="user-detail-header">
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', color: '#fff', width: 56, height: 56 }}>
              <PeopleAltRoundedIcon />
            </Avatar>
            <Box flex={1}>
              <Typography variant="overline" color="text.secondary">利用者ハブ</Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {displayName}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                <Chip label={`ID: ${userCode}`} size="small" />
                <Chip label={isActive ? '在籍' : '退所'} color={isActive ? 'success' : 'default'} size="small" />
                {user.IsHighIntensitySupportTarget && (
                  <Chip label="強度行動障害" color="warning" size="small" />
                )}
                {user.IsSupportProcedureTarget && (
                  <Chip label="支援手順対象" color="secondary" size="small" />
                )}
              </Stack>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewRoundedIcon />}
              onClick={() => navigate(`/users?tab=list&selected=${encodeURIComponent(userCode)}`)}
              data-testid="user-detail-open-full"
            >
              詳細を開く
            </Button>
          </Stack>
          {/* Attendance info */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            通所予定日: {attendanceDays}
          </Typography>
        </Paper>

        {/* ════════════════════════════════════════════════════════════
            Section 2: Quick Actions
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-quick-actions">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            クイックアクション
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.key}
                action={action}
                onClick={() => navigate(action.path)}
              />
            ))}
          </Box>
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Section 3: Summary Stats
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-summary">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
            現在の状況
          </Typography>
          {summaryStats.length > 0 ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' },
                gap: 1.5,
              }}
            >
              {summaryStats.map((stat) => (
                <SummaryStatCard key={stat.key} stat={stat} />
              ))}
            </Box>
          ) : (
            <EmptyStateAction
              icon="📊"
              title="サマリー情報なし"
              description="利用者の記録データがまだ作成されていません。"
              variant="info"
              minHeight="8vh"
              testId="user-detail-summary-empty"
            />
          )}
        </Box>
      </Stack>
    </Container>
  );
};

// ─── Sub Components ──────────────────────────────────────────

type QuickActionCardProps = {
  action: QuickAction;
  onClick: () => void;
};

const QuickActionCard: React.FC<QuickActionCardProps> = ({ action, onClick }) => (
  <Card
    variant="outlined"
    sx={{ borderRadius: 2, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: 3 } }}
    data-testid={`quick-action-${action.key}`}
  >
    <CardActionArea
      onClick={onClick}
      sx={{ p: 2 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ fontSize: 28, lineHeight: 1 }}>{action.icon}</Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {action.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {action.description}
          </Typography>
        </Box>
      </Stack>
    </CardActionArea>
  </Card>
);

type SummaryStatCardProps = {
  stat: SummaryStat;
};

const SummaryStatCard: React.FC<SummaryStatCardProps> = ({ stat }) => {
  const borderColor = stat.severity === 'attention'
    ? 'warning.main'
    : stat.severity === 'good'
      ? 'success.main'
      : 'divider';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        borderLeft: 3,
        borderLeftColor: borderColor,
        textAlign: 'center',
      }}
      data-testid={`summary-stat-${stat.key}`}
    >
      <Box sx={{ fontSize: 20, mb: 0.5 }}>{stat.icon}</Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {stat.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {stat.value}
      </Typography>
    </Paper>
  );
};

export default UserDetailPage;
