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
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ── MUI ──
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import Alert from '@mui/material/Alert';
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
import {
  buildQuickActions,
  buildSummaryStats,
  buildRecentRecordPreview,
  buildRecentHandoffPreview,
  buildTodayUserSnapshot,
  buildPlanHighlights,
  type QuickAction,
  type SummaryStat,
  type RecordPreviewItem,
  type HandoffPreviewItem,
  type TodayUserSnapshot,
  type PlanHighlight,
} from '@/features/users/domain/userDetailHubLogic';
import {
  buildUnifiedRecommendation,
  type UnifiedRecommendation,
} from '@/features/recommendation/domain/unifiedRecommendation';
import { useUserHubDataSources } from '@/features/users/hooks/useUserHubDataSources';
import {
  useTagAnalytics,
  TagAnalyticsSection,
  presetToDateRange,
  type PeriodPreset,
} from '@/features/tag-analytics';

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

  // Sprint-1 Phase B: 実データ接続
  const hubData = useUserHubDataSources(userId);

  // ── Phase F1.5: 行動タグ分析（期間プリセット切替） ──
  const [tagPeriod, setTagPeriod] = useState<PeriodPreset>('30d');
  const tagRange = useMemo(() => presetToDateRange(tagPeriod), [tagPeriod]);
  const tagAnalytics = useTagAnalytics(userId, tagRange);

  // ── サマリー統計 ──
  const summaryStats = useMemo(() => {
    if (!user) return [];
    return buildSummaryStats({
      todayRecordExists: hubData.hasRecordToday,
      latestDailyRecord: hubData.latestDailyRecord,
      handoffInfo: hubData.handoffInfo,
      isHighIntensity: user.IsHighIntensitySupportTarget ?? false,
    });
  }, [user, hubData]);

  // ── MVP-010: Hub 深化データ生成 ──
  const todaySnapshot = useMemo<TodayUserSnapshot | null>(() => {
    if (!userId || !user) return null;
    return buildTodayUserSnapshot({
      userId,
      hasRecordToday: hubData.hasRecordToday,
      hasCriticalHandoff: hubData.hasCriticalHandoff,
      hasPlan: hubData.hasPlan,
    });
  }, [userId, user, hubData]);

  const recentRecords = useMemo<RecordPreviewItem[]>(() => {
    return buildRecentRecordPreview(hubData.recentRecordsForUser);
  }, [hubData.recentRecordsForUser]);

  const recentHandoffs = useMemo<HandoffPreviewItem[]>(() => {
    return buildRecentHandoffPreview(hubData.recentHandoffs);
  }, [hubData.recentHandoffs]);

  const planHighlights = useMemo<PlanHighlight[]>(() => {
    // Phase 3: ISPの目標データを接続する
    return buildPlanHighlights([]);
  }, [user]);

  // ── MVP-013: 統合推奨 ──
  const recommendation = useMemo(() => {
    if (!userId || !user) return null;
    return buildUnifiedRecommendation({
      userId,
      contextAlerts: [],          // Phase 3: ContextPanelのアラートと接続
      todaySnapshot: todaySnapshot,
      hasRecordToday: hubData.hasRecordToday,
      criticalHandoffCount: hubData.criticalHandoffCount,
      hasPlan: hubData.hasPlan,
      isHighIntensity: user.IsHighIntensitySupportTarget ?? false,
    });
  }, [userId, user, hubData, todaySnapshot]);

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
      {/* ── Hub データソース エラー/ローディング 通知 ── */}
      {hubData.status === 'error' && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="user-hub-data-error">
          一部のデータ取得に失敗しました: {hubData.error}
        </Alert>
      )}
      {hubData.status === 'loading' && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="user-hub-data-loading">
          記録・申し送りデータを読み込み中...
        </Alert>
      )}
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
            Section 1.5: 統合推奨バナー (MVP-013)
           ════════════════════════════════════════════════════════════ */}
        {recommendation && recommendation.primaryFactor !== 'no-issues' && (
          <RecommendationBanner rec={recommendation} onAction={navigate} />
        )}

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

        {/* ════════════════════════════════════════════════════════════
            Section 4: 今日のスナップショット (MVP-010)
           ════════════════════════════════════════════════════════════ */}
        {todaySnapshot && (
          <TodaySnapshotSection snapshot={todaySnapshot} onAction={(path) => navigate(path)} />
        )}

        {/* ════════════════════════════════════════════════════════════
            Section 5: 直近記録プレビュー (MVP-010)
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-recent-records">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>📋 直近の記録</Typography>
          {recentRecords.length > 0 ? (
            <Stack spacing={1}>
              {recentRecords.map((r, i) => (
                <RecordPreviewCard key={i} item={r} />
              ))}
            </Stack>
          ) : (
            <EmptyStateAction
              icon="📝"
              title="直近の記録はありません"
              description="今日から記録を開始しましょう。"
              variant="info"
              minHeight="6vh"
              testId="user-detail-no-records"
            />
          )}
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Section 6: 直近申し送りプレビュー (MVP-010)
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-recent-handoffs">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>📨 直近の申し送り</Typography>
          {recentHandoffs.length > 0 ? (
            <Stack spacing={1}>
              {recentHandoffs.map((h) => (
                <HandoffPreviewCard key={h.id} item={h} />
              ))}
            </Stack>
          ) : (
            <EmptyStateAction
              icon="📨"
              title="直近の申し送りはありません"
              description="申し送り事項があれば記録してください。"
              variant="info"
              minHeight="6vh"
              testId="user-detail-no-handoffs"
            />
          )}
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Section 7: 支援計画ハイライト (MVP-010)
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-plan-highlights">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>🎯 支援計画 要点</Typography>
          {planHighlights.length > 0 ? (
            <Stack spacing={1}>
              {planHighlights.map((p, i) => (
                <PlanHighlightCard key={i} item={p} />
              ))}
            </Stack>
          ) : (
            <EmptyStateAction
              icon="📋"
              title="支援計画が未作成です"
              description="個別支援計画書を作成すると、ここに要点が表示されます。"
              actionLabel="計画を作成する"
              onAction={() => navigate(`/users?tab=list&selected=${encodeURIComponent(userId ?? '')}`)}
              variant="warning"
              minHeight="6vh"
              testId="user-detail-no-plan"
            />
          )}
        </Box>

        {/* ════════════════════════════════════════════════════════════
            Section 8: 行動タグ分析 (Phase F1)
           ════════════════════════════════════════════════════════════ */}
        <Box data-testid="user-detail-tag-analytics">
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>🏷️ 行動タグ分析</Typography>
          <TagAnalyticsSection
            analytics={tagAnalytics}
            periodPreset={tagPeriod}
            onPeriodChange={setTagPeriod}
          />
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

// ── MVP-010: 今日のスナップショット ──

const URGENCY_COLORS: Record<TodayUserSnapshot['urgency'], string> = {
  high: '#d32f2f',
  medium: '#ed6c02',
  low: '#388e3c',
};

const TodaySnapshotSection: React.FC<{ snapshot: TodayUserSnapshot; onAction: (path: string) => void }> = ({ snapshot, onAction }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      borderRadius: 2,
      borderLeft: 4,
      borderLeftColor: URGENCY_COLORS[snapshot.urgency],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
    }}
    data-testid="user-detail-today-snapshot"
  >
    <Box flex={1}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        今日の次アクション
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.25, color: URGENCY_COLORS[snapshot.urgency] }}>
        {snapshot.nextAction}
      </Typography>
    </Box>
    <Button
      variant="contained"
      size="small"
      onClick={() => onAction(snapshot.nextActionPath)}
      sx={{ bgcolor: URGENCY_COLORS[snapshot.urgency], '&:hover': { bgcolor: URGENCY_COLORS[snapshot.urgency], filter: 'brightness(0.9)' }, whiteSpace: 'nowrap', flexShrink: 0 }}
      data-testid="user-detail-snapshot-action"
    >
      移動する
    </Button>
  </Paper>
);

// ── MVP-010: 直近記録カード ──

const RecordPreviewCard: React.FC<{ item: RecordPreviewItem }> = ({ item }) => (
  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }} data-testid={`record-preview-${item.date}`}>
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 85 }}>{item.date}</Typography>
      <Chip
        label={item.status}
        size="small"
        color={item.status === '完了' ? 'success' : 'default'}
        sx={{ height: 20, fontSize: '0.65rem' }}
      />
      {item.hasSpecialNote && (
        <Chip label="特記あり" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
      )}
    </Stack>
    {item.noteExcerpt && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: '0.78rem' }}>
        📝 {item.noteExcerpt}
      </Typography>
    )}
  </Paper>
);

// ── MVP-010: 申し送りプレビューカード ──

const HandoffPreviewCard: React.FC<{ item: HandoffPreviewItem }> = ({ item }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.5,
      borderRadius: 2,
      borderLeft: 3,
      borderLeftColor: item.severity === '重要' ? 'error.main' : 'divider',
    }}
    data-testid={`handoff-preview-${item.id}`}
  >
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
      {item.severity === '重要' && <Chip label="重要" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />}
      <Chip label={item.status} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
      <Typography variant="caption" color="text.secondary">{item.createdAt}</Typography>
    </Stack>
    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{item.message}</Typography>
  </Paper>
);

// ── MVP-010: 支援計画ハイライトカード ──

const PLAN_TYPE_COLORS: Record<string, string> = {
  long: '#1e88e5',
  short: '#43a047',
  support: '#f4511e',
};
const PLAN_TYPE_LABELS: Record<string, string> = {
  long: '長期',
  short: '短期',
  support: '支援',
};

const PlanHighlightCard: React.FC<{ item: PlanHighlight }> = ({ item }) => (
  <Paper
    variant="outlined"
    sx={{ p: 1.5, borderRadius: 2, borderLeft: 3, borderLeftColor: PLAN_TYPE_COLORS[item.type] ?? '#757575' }}
    data-testid={`plan-highlight-${item.type}`}
  >
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
      <Chip
        label={PLAN_TYPE_LABELS[item.type] ?? item.type}
        size="small"
        sx={{ bgcolor: PLAN_TYPE_COLORS[item.type] ?? '#757575', color: '#fff', height: 20, fontSize: '0.65rem' }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.label}</Typography>
    </Stack>
    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>{item.excerpt}</Typography>
  </Paper>
);

// ── MVP-013: 統合推奨バナー ──────────────────────────────────────

const URGENCY_PALETTE = {
  critical: { border: '#d32f2f', bg: '#fff5f5', text: '#b71c1c', icon: '🔴' },
  high:     { border: '#ed6c02', bg: '#fff8f0', text: '#e65100', icon: '🟠' },
  medium:   { border: '#1976d2', bg: '#f0f7ff', text: '#0d47a1', icon: '🔵' },
  low:      { border: '#388e3c', bg: '#f0fff4', text: '#1b5e20', icon: '✅' },
} as const;

const RecommendationBanner: React.FC<{
  rec: UnifiedRecommendation;
  onAction: (route: string) => void;
}> = ({ rec, onAction }) => {
  const p = URGENCY_PALETTE[rec.urgency];
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderLeft: 4,
        borderColor: p.border,
        bgcolor: p.bg,
      }}
      data-testid="user-detail-recommendation-banner"
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box flex={1}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: p.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {p.icon} 今日の推奨
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: p.text, mt: 0.25 }}>
            {rec.headline}
          </Typography>
          {rec.secondaryNotes.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
              {rec.secondaryNotes.map((note, i) => (
                <Chip key={i} label={note} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, borderColor: p.border, color: p.text }} />
              ))}
            </Stack>
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={() => onAction(rec.actionRoute)}
          sx={{ bgcolor: p.border, '&:hover': { bgcolor: p.border, filter: 'brightness(0.9)' }, whiteSpace: 'nowrap', flexShrink: 0 }}
          data-testid="user-detail-recommendation-action"
        >
          {rec.suggestedAction}
        </Button>
      </Stack>
    </Paper>
  );
};

export default UserDetailPage;
