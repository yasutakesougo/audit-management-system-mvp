import { motionTokens } from '@/app/theme';
import {
    useAnalysisDashboardViewModel
} from '@/features/analysis/hooks/useAnalysisDashboardViewModel';
import { useBehaviorAnalytics } from '@/features/analysis/hooks/useBehaviorAnalytics';
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import { useAttendanceStore } from '@/features/attendance/store';
import { useExecutionData } from '@/features/daily/hooks/legacy/useExecutionData';
import { seedDemoBehaviors, useBehaviorStore } from '@/features/daily/hooks/legacy-stores/behaviorStore';
import { useProcedureStore } from '@/features/daily/hooks/legacy-stores/procedureStore';
import { AttendanceSummaryCard } from '@/features/dashboard/components/AttendanceSummaryCard';
import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { useUsers } from '@/features/users/useUsers';
import { createUserNameResolver } from '@/domain/user';
import { isDemoModeEnabled } from '@/lib/env';
import { toLocalDateISO } from '@/utils/getNow';
import { useNavigate } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_DAYS_OPTIONS = [
  { value: 30, label: '過去30日' },
  { value: 60, label: '過去60日' },
  { value: 90, label: '過去90日' },
] as const;



// ---------------------------------------------------------------------------
// Sub-components (MUI-only, no external charts)
// ---------------------------------------------------------------------------

import { CssBarChart, CssHeatmap, EventTimeline, KpiStatCard, SvgDonutChart } from './AnalysisDashboardWidgets';



// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const AnalysisDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: users, status: usersStatus, error: usersError, update: updateUser } = useUsers();
  const { analysisData, fetchForAnalysis } = useBehaviorStore();
  const demoModeEnabled = isDemoModeEnabled();
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [analysisDays, setAnalysisDays] = useState<number>(30);
  const autoSeededRef = useRef<Set<string>>(new Set());

  // 行動分析対象者のみに絞り込み
  const ibdUsers = useMemo(
    () => users.filter((u) => u.IsSupportProcedureTarget === true),
    [users],
  );
  const ibdUserCodes = useMemo(
    () => new Set(ibdUsers.map((u) => u.UserID)),
    [ibdUsers],
  );

  const { dailyStats } = useBehaviorAnalytics(analysisData);
  const resolveUserName = useMemo(
    () => createUserNameResolver(users),
    [users],
  );
  const selectedUserName = useMemo(
    () => (targetUserId ? resolveUserName(targetUserId) : ''),
    [targetUserId, resolveUserName],
  );

  // --- Execution stats ---
  const executionStore = useExecutionData();
  const procedureStore = useProcedureStore();
  const interventionStore = useInterventionStore();

  const [executionStats, setExecutionStats] = useState({ completed: 0, triggered: 0, skipped: 0, total: 0 });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!targetUserId) {
        if (active) setExecutionStats({ completed: 0, triggered: 0, skipped: 0, total: 0 });
        return;
      }
      const today = toLocalDateISO();
      const procedures = procedureStore.getByUser(targetUserId);
      const records = await executionStore.getRecords(today, targetUserId);
      
      if (!active) return;
      const completed = records.filter((r) => r.status === 'completed').length;
      const triggered = records.filter((r) => r.status === 'triggered').length;
      const skipped = records.filter((r) => r.status === 'skipped').length;
      setExecutionStats({ completed, triggered, skipped, total: procedures.length });
    };
    void load();
    return () => { active = false; };
  }, [targetUserId, executionStore, procedureStore]);

  const activeBipCount = useMemo(() => {
    if (!targetUserId) return 0;
    return interventionStore.getByUserId(targetUserId).length;
  }, [targetUserId, interventionStore]);

  // --- ViewModel ---
  const { visits: attendanceVisits } = useAttendanceStore();
  const vm = useAnalysisDashboardViewModel(analysisData, dailyStats, executionStats, activeBipCount, attendanceVisits, ibdUserCodes);


  // Fetch analysis data when user or period changes
  useEffect(() => {
    if (targetUserId) {
      void fetchForAnalysis(targetUserId, analysisDays);
    }
  }, [fetchForAnalysis, targetUserId, analysisDays]);

  // Demo mode: auto-seed
  useEffect(() => {
    if (!demoModeEnabled || !targetUserId) return;
    if (analysisData.length > 0) {
      autoSeededRef.current.add(targetUserId);
      return;
    }
    if (autoSeededRef.current.has(targetUserId)) return;
    const seededCount = seedDemoBehaviors(targetUserId, analysisDays);
    if (seededCount > 0) {
      autoSeededRef.current.add(targetUserId);
      void fetchForAnalysis(targetUserId, analysisDays);
    }
  }, [demoModeEnabled, fetchForAnalysis, analysisData.length, targetUserId, analysisDays]);

  const handleSeedData = useCallback(() => {
    if (!targetUserId) return;
    seedDemoBehaviors(targetUserId, analysisDays);
    void fetchForAnalysis(targetUserId, analysisDays);
  }, [targetUserId, analysisDays, fetchForAnalysis]);

  // --- Bar chart data from dailyStats ---
  const barChartData = useMemo(
    () =>
      dailyStats.slice(-10).map((d) => ({
        label: d.dateLabel,
        value: d.count,
        color: '#5B8C5A',
      })),
    [dailyStats],
  );

  if (usersStatus === 'loading') {
    return (
      <Container maxWidth="xl" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">利用データを読み込み中...</Typography>
      </Container>
    );
  }

  if (usersStatus === 'error') {
    return (
      <Container maxWidth="xl" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>利用データの取得に失敗しました</Typography>
        <Typography variant="body2" color="text.secondary">
          {String(usersError)}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3, minHeight: '100vh' }} data-testid="analysis-dashboard-page">
      <IBDPageHeader
        title="行動分析ダッシュボード"
        subtitle={
          selectedUserName
            ? `${selectedUserName} の${analysisDays}日間分析`
            : '記録データを即座に可視化してフィードバック'
        }
        icon={<AssessmentIcon />}
        actions={
          <>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="analysis-target-user-label">分析対象者</InputLabel>
              <Select
                labelId="analysis-target-user-label"
                label="分析対象者"
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                disabled={ibdUsers.length === 0}
              >
                <MenuItem value="">
                  <em>選択してください</em>
                </MenuItem>
                {ibdUsers.map((user) => (
                  <MenuItem key={user.UserID} value={user.UserID}>
                    {user.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel id="analysis-days-label">分析期間</InputLabel>
              <Select
                labelId="analysis-days-label"
                label="分析期間"
                value={analysisDays}
                onChange={(event) => setAnalysisDays(Number(event.target.value))}
              >
                {ANALYSIS_DAYS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {targetUserId && demoModeEnabled && (
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleSeedData} size="small">
                デモデータ生成
              </Button>
            )}

            {(demoModeEnabled || process.env.NODE_ENV === 'development') && users.length > 0 && ibdUsers.length === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                <Tooltip title="全利用者を分析対象としてマークします（開発用の一括設定）">
                  <Button 
                    variant="contained" 
                    color="warning" 
                    size="small"
                    onClick={async () => {
                      if (!window.confirm('【開発用】全利用者の「分析対象」フラグを有効にしますか？\n（本番環境ではマスタから個別設定を推奨します）')) return;
                      for (const user of users) {
                        if (user.IsActive) {
                          try {
                            await updateUser(user.Id, { IsSupportProcedureTarget: true });
                          } catch (e) {
                            console.error('Failed to update user', user.UserID, e);
                          }
                        }
                      }
                      window.location.reload();
                    }}
                  >
                    データ修復（全員対象）
                  </Button>
                </Tooltip>
                <Typography variant="caption" color="warning.main" sx={{ fontSize: '10px' }}>
                  ※ 開発・検証用の強制フラグON
                </Typography>
              </Box>
            )}
          </>
        }
      />

      {/* Attendance Summary — 行動分析対象者のみの出欠サマリー */}
      {vm.attendanceSummary && (
        <Box sx={{ mt: 2 }}>
          <AttendanceSummaryCard
            data={vm.attendanceSummary}
            title="📋 行動分析対象者の出欠・稼働サマリー"
          />
        </Box>
      )}

      {targetUserId ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            mt: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(4, 1fr)',
            },
            gridAutoRows: 'minmax(120px, auto)',
          }}
        >
          {/* Row 1: KPI Cards (4 tiles) */}
          {vm.kpis.map((kpi) => (
            <KpiStatCard key={kpi.label} kpi={kpi} />
          ))}

          {/* Row 2: Bar Chart (span 2) + Donut (span 1) + Heatmap (span 1) */}
          <Box sx={{ gridColumn: { xs: '1', md: 'span 2' }, gridRow: { md: 'span 2' } }}>
            <CssBarChart data={barChartData} />
          </Box>

          <Box sx={{ gridColumn: { xs: '1', sm: 'span 1' } }}>
            <SvgDonutChart segments={vm.donut} />
          </Box>

          <Box sx={{ gridColumn: { xs: '1', sm: 'span 1' } }}>
            <CssHeatmap cells={vm.heatmap} />
          </Box>

          {/* Row 3: Timeline (span 2) + Intensity trend mini bar (span 2) */}
          <Box sx={{ gridColumn: { xs: '1', md: 'span 2' }, gridRow: { md: 'span 2' } }}>
            <EventTimeline events={vm.recentEvents} />
          </Box>

          <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
            <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                強度トレンド（{analysisDays}日間）
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 120, mt: 1 }}>
                {dailyStats.slice(-20).map((d) => {
                  const heightPct = d.maxIntensity > 0 ? (d.maxIntensity / 5) * 100 : 2;
                  return (
                    <Tooltip key={d.dateKey} title={`${d.dateLabel}: 最大Lv.${d.maxIntensity} / ${d.count}件`} arrow>
                      <Box
                        sx={{
                          flex: 1,
                          maxWidth: 16,
                          height: `${heightPct}%`,
                          bgcolor: d.maxIntensity >= 4 ? '#d32f2f' : d.maxIntensity >= 2 ? '#FF9800' : '#5B8C5A',
                          borderRadius: 0.5,
                          transition: `height ${motionTokens.duration.slow} ${motionTokens.easing.decel}`,
                          minHeight: 2,
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {dailyStats.length > 20 ? dailyStats.slice(-20)[0]?.dateLabel : dailyStats[0]?.dateLabel ?? ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {dailyStats[dailyStats.length - 1]?.dateLabel ?? ''}
                </Typography>
              </Box>
            </Card>
          </Box>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', mt: 10 }}>
          {ibdUsers.length > 0 ? (
            <Typography variant="h6" color="text.secondary">
              対象者を選択して分析を開始してください
            </Typography>
          ) : (
            <Box sx={{ maxWidth: 600, mx: 'auto', p: 5, bgcolor: 'action.hover', borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom fontWeight={800} color="primary.main">
                行動分析の対象者が未設定です
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                分析を開始するには、まず「利用者マスタ」で対象の方の分析フラグを有効にする必要があります。
              </Typography>

              <Button 
                variant="contained" 
                startIcon={<OpenInNewIcon />}
                onClick={() => navigate('/users')}
                sx={{ 
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  boxShadow: 3,
                  fontWeight: 'bold'
                }}
              >
                利用者マスタを開いて設定する
              </Button>

              <Typography variant="body2" sx={{ mt: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary', opacity: 0.8 }}>
                <AnalyticsIcon fontSize="small" />
                対象者を設定すると、ここに活動傾向や強度の推移が可視化されます。
              </Typography>

              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" component="div" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                  🛠 開発者・管理者向けヒント: <br />
                  マスターデータの `IsSupportProcedureTarget` 列を true にするか、<br />
                  URLに <code>?demo=1</code> を追加して強制的にデモデータを生成してください。
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default AnalysisDashboardPage;
