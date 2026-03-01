import {
    useAnalysisDashboardViewModel,
    type DonutSegment,
    type HeatmapCell,
    type KpiCard,
    type RecentEvent,
} from '@/features/analysis/hooks/useAnalysisDashboardViewModel';
import { useBehaviorAnalytics } from '@/features/analysis/hooks/useBehaviorAnalytics';
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import { seedDemoBehaviors, useBehaviorStore } from '@/features/daily/stores/behaviorStore';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { IBDPageHeader } from '@/features/ibd/components/IBDPageHeader';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { isDemoModeEnabled } from '@/lib/env';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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

const HOUR_LABELS = ['0', '3', '6', '9', '12', '15', '18', '21'];

// ---------------------------------------------------------------------------
// Sub-components (MUI-only, no external charts)
// ---------------------------------------------------------------------------

/** KPI Stat Card */
const KpiStatCard: React.FC<{ kpi: KpiCard }> = ({ kpi }) => {
  const TrendIcon =
    kpi.trend === 'up' ? TrendingUpIcon : kpi.trend === 'down' ? TrendingDownIcon : TrendingFlatIcon;

  return (
    <Card
      variant="outlined"
      sx={{
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        borderLeft: `4px solid ${kpi.color}`,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 0.5 }}>
        {kpi.label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 1 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: kpi.color, lineHeight: 1 }}>
          {kpi.value}
        </Typography>
        {kpi.unit && (
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {kpi.unit}
          </Typography>
        )}
      </Box>
      {kpi.trend && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <TrendIcon sx={{ fontSize: 16, color: kpi.trend === 'up' ? '#d32f2f' : kpi.trend === 'down' ? '#5B8C5A' : '#9E9E9E' }} />
          <Typography variant="caption" color="text.secondary">
            {kpi.trend === 'up' ? '増加傾向' : kpi.trend === 'down' ? '減少傾向' : '横ばい'}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

/** Pure CSS Horizontal Bar Chart */
const CssBarChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        日別発生件数
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        {data.slice(-10).map((d) => (
          <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right', color: 'text.secondary' }}>
              {d.label}
            </Typography>
            <Box sx={{ flex: 1, position: 'relative', height: 18, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${(d.value / max) * 100}%`,
                  bgcolor: d.color,
                  borderRadius: 1,
                  transition: 'width 0.4s ease-out',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  color: d.value / max > 0.5 ? '#fff' : 'text.primary',
                }}
              >
                {d.value}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

/** SVG Donut Chart */
const SvgDonutChart: React.FC<{ segments: DonutSegment[] }> = ({ segments }) => {
  const size = 140;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = 0;

  return (
    <Card variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ alignSelf: 'flex-start' }}>
        実施ステータス
      </Typography>
      <Box sx={{ position: 'relative', width: size, height: size, my: 1 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth={stroke}
          />
          {/* Data segments */}
          {total > 0 &&
            segments.map((seg) => {
              const dashLen = (seg.value / total) * circumference;
              const dashOffset = -offset;
              offset += dashLen;
              return (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: 'stroke-dasharray 0.5s ease-out',
                  }}
                />
              );
            })}
        </svg>
        {/* Center label */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}
        >
          <Typography variant="h6" fontWeight={800} lineHeight={1}>
            {total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            件
          </Typography>
        </Box>
      </Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', mt: 1 }}>
        {segments.map((seg) => (
          <Box key={seg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: seg.color }} />
            <Typography variant="caption" color="text.secondary">
              {seg.label} {seg.percentage}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

/** CSS Heatmap (24 hours) */
const CssHeatmap: React.FC<{ cells: HeatmapCell[] }> = ({ cells }) => (
  <Card variant="outlined" sx={{ p: 2.5, height: '100%' }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      時間帯別発生ヒートマップ
    </Typography>
    <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
      {cells.map((cell) => (
        <Tooltip key={cell.hour} title={`${cell.hour}時台: ${cell.count}件`} arrow>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 0.5,
              bgcolor: `rgba(237, 108, 2, ${Math.max(cell.intensity, 0.06)})`,
              border: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              transition: 'background-color 0.3s',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: cell.intensity > 0.5 ? '#fff' : 'text.secondary' }}>
              {cell.count > 0 ? cell.count : ''}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
    {/* Hour axis labels */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, px: 0.5 }}>
      {HOUR_LABELS.map((label) => (
        <Typography key={label} variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
          {label}時
        </Typography>
      ))}
    </Box>
  </Card>
);

/** Recent Events Timeline */
const EventTimeline: React.FC<{ events: RecentEvent[] }> = ({ events }) => (
  <Card variant="outlined" sx={{ p: 2.5, height: '100%', overflow: 'auto' }}>
    <Typography variant="subtitle2" fontWeight={700} gutterBottom>
      最近の行動記録
    </Typography>
    {events.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
        データがありません
      </Typography>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
        {events.map((ev) => (
          <Box
            key={ev.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.5,
              py: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              borderLeft: `3px solid ${ev.intensity >= 4 ? '#d32f2f' : ev.intensity >= 2 ? '#FF9800' : '#5B8C5A'}`,
            }}
          >
            {/* Intensity badge */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: ev.intensity >= 4 ? '#d32f2f' : ev.intensity >= 2 ? '#FF9800' : '#5B8C5A',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
                flexShrink: 0,
              }}
            >
              {ev.intensity}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {ev.behavior}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ev.time}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    )}
  </Card>
);

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

const AnalysisDashboardPage: React.FC = () => {
  const { data: users } = useUsersDemo();
  const { analysisData, fetchForAnalysis } = useBehaviorStore();
  const demoModeEnabled = isDemoModeEnabled();
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [analysisDays, setAnalysisDays] = useState<number>(30);
  const autoSeededRef = useRef<Set<string>>(new Set());

  const { dailyStats } = useBehaviorAnalytics(analysisData);
  const selectedUserName = useMemo(
    () => users.find((u) => u.UserID === targetUserId)?.FullName ?? '',
    [targetUserId, users],
  );

  // --- Execution stats ---
  const executionStore = useExecutionStore();
  const procedureStore = useProcedureStore();
  const interventionStore = useInterventionStore();

  const executionStats = useMemo(() => {
    if (!targetUserId) return { completed: 0, triggered: 0, skipped: 0, total: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const procedures = procedureStore.getByUser(targetUserId);
    const records = executionStore.getRecords(today, targetUserId);
    const completed = records.filter((r) => r.status === 'completed').length;
    const triggered = records.filter((r) => r.status === 'triggered').length;
    const skipped = records.filter((r) => r.status === 'skipped').length;
    return { completed, triggered, skipped, total: procedures.length };
  }, [targetUserId, executionStore, procedureStore]);

  const activeBipCount = useMemo(() => {
    if (!targetUserId) return 0;
    return interventionStore.getByUserId(targetUserId).length;
  }, [targetUserId, interventionStore]);

  // --- ViewModel ---
  const vm = useAnalysisDashboardViewModel(analysisData, dailyStats, executionStats, activeBipCount);

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
              >
                <MenuItem value="">
                  <em>選択してください</em>
                </MenuItem>
                {users.map((user) => (
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
          </>
        }
      />

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
                          transition: 'height 0.4s ease-out',
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
          <Typography variant="h6" color="text.secondary">
            対象者を選択して分析を開始してください
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default AnalysisDashboardPage;
