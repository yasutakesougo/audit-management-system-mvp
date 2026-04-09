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
  buildCommonQuickActions,
  buildIbdQuickActions,
  buildSummaryStats,
  buildRecentRecordPreview,
  buildRecentHandoffPreview,
  buildTodayUserSnapshot,
  buildPlanHighlights,
  type RecordPreviewItem,
  type HandoffPreviewItem,
  type TodayUserSnapshot,
  type PlanHighlight,
} from '@/features/users/domain/userDetailHubLogic';
import {
  buildUnifiedRecommendation,
} from '@/features/recommendation/domain/unifiedRecommendation';
import { useUserHubDataSources } from '@/features/users/hooks/useUserHubDataSources';
import {
  useTagAnalytics,
  TagAnalyticsSection,
  presetToDateRange,
  type PeriodPreset,
} from '@/features/tag-analytics';

import { QuickActionCard } from '@/features/users/components/hub/QuickActionCard';
import { SummaryStatCard } from '@/features/users/components/hub/SummaryStatCard';
import { TodaySnapshotSection } from '@/features/users/components/hub/TodaySnapshotSection';
import { RecordPreviewCard } from '@/features/users/components/hub/RecordPreviewCard';
import { HandoffPreviewCard } from '@/features/users/components/hub/HandoffPreviewCard';
import { PlanHighlightCard } from '@/features/users/components/hub/PlanHighlightCard';
import { RecommendationBanner } from '@/features/users/components/hub/RecommendationBanner';

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

  // ── クイックアクション（共通 / IBD専用に分離）──
  const isIbdTarget = user?.IsHighIntensitySupportTarget ?? false;
  const commonActions = useMemo(
    () => (userId ? buildCommonQuickActions(userId) : []),
    [userId],
  );
  const ibdActions = useMemo(
    () => (userId && isIbdTarget ? buildIbdQuickActions(userId) : []),
    [userId, isIbdTarget],
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
            Section 2: Quick Actions（共通 + IBD専用の2セクション）
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
            {commonActions.map((action) => (
              <QuickActionCard
                key={action.key}
                action={action}
                onClick={() => navigate(action.path)}
              />
            ))}
          </Box>

          {/* IBD対象者のみ: 強度行動障害支援導線 */}
          {isIbdTarget && ibdActions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
                強度行動障害支援
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1.5,
                }}
              >
                {ibdActions.map((action) => (
                  <QuickActionCard
                    key={action.key}
                    action={action}
                    onClick={() => navigate(action.path)}
                  />
                ))}
              </Box>
            </Box>
          )}
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

export default UserDetailPage;
