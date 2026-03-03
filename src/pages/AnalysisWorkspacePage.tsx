import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { AnalysisKpiStrip, type KpiItem } from '@/features/ibd/analysis/components/AnalysisKpiStrip';
import { useAnalysisUserFilter } from '@/features/ibd/analysis/hooks/useAnalysisUserFilter';
import {
    getDailySubmissionMetrics,
    getStoredDailySubmissionEvents,
    getWeeklyMetrics
} from '@/features/ibd/analysis/pdca/dailyMetricsAdapter';

// ---------------------------------------------------------------------------
// Lazy-loaded tab panels
// ---------------------------------------------------------------------------
const AnalysisDashboardPanel = React.lazy(() => import('@/pages/AnalysisDashboardPage'));
const IcebergCanvasPanel = React.lazy(() => import('@/pages/IcebergAnalysisPage'));
const PdcaPanel = React.lazy(() => import('@/pages/IcebergPdcaPage'));

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TAB_KEYS = ['dashboard', 'iceberg', 'pdca'] as const;
type TabKey = typeof TAB_KEYS[number];

const TAB_LABELS: Record<TabKey, string> = {
  dashboard: 'ダッシュボード',
  iceberg: '氷山モデル',
  pdca: 'PDCA',
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export const AnalysisWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    userOptions,
    usersStatus,
    selectedUserId: _selectedUserId,
    selectedOption,
    handleUserChange,
    targetUserIds,
  } = useAnalysisUserFilter();

  // Tab state from URL
  const tabParam = (searchParams.get('tab') ?? 'dashboard') as TabKey;
  const activeTab = TAB_KEYS.includes(tabParam) ? tabParam : 'dashboard';

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', newValue);
    setSearchParams(next, { replace: true });
  };

  // Shared KPI data
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dailyMetrics = React.useMemo(
    () => getDailySubmissionMetrics({ recordDate: today, targetUserIds }),
    [today, targetUserIds],
  );
  const allEvents = React.useMemo(() => getStoredDailySubmissionEvents(), []);
  const weeklyMetrics = React.useMemo(
    () => getWeeklyMetrics({ events: allEvents, targetUserIds, referenceDate: new Date(today) }),
    [allEvents, targetUserIds, today],
  );

  const kpiItems: KpiItem[] = React.useMemo(() => [
    {
      label: '当日入力完了率',
      value: `${Math.round(dailyMetrics.completionRate * 100)}%`,
      sub: `${dailyMetrics.submittedCount}/${dailyMetrics.targetCount} 名`,
    },
    {
      label: 'リードタイム(平均)',
      value: `${dailyMetrics.averageLeadTimeMinutes}分`,
    },
    {
      label: '週次完了率',
      value: `${Math.round(weeklyMetrics.current.completionRate * 100)}%`,
      sub: weeklyMetrics.completionTrend === 'up' ? '↑ 改善' :
            weeklyMetrics.completionTrend === 'down' ? '↓ 悪化' : '→ 横ばい',
    },
  ], [dailyMetrics, weeklyMetrics]);

  return (
    <Box data-testid="analysis-workspace-page">
      <PageHeader
        title="行動分析ワークスペース"
        actions={
          <Autocomplete
            options={userOptions}
            value={selectedOption}
            loading={usersStatus === 'idle' || usersStatus === 'loading'}
            onChange={handleUserChange}
            getOptionLabel={(opt) => opt.label}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            size="small"
            sx={{ minWidth: 240 }}
            renderInput={(params) => (
              <TextField {...params} label="利用者" placeholder="選択" size="small" />
            )}
          />
        }
      />

      {/* KPIバー */}
      <AnalysisKpiStrip items={kpiItems} />

      {/* タブ */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {TAB_KEYS.map((key) => (
            <Tab key={key} value={key} label={TAB_LABELS[key]} />
          ))}
        </Tabs>
      </Box>

      {/* タブパネル */}
      <React.Suspense
        fallback={
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">読み込み中…</Typography>
          </Box>
        }
      >
        {activeTab === 'dashboard' && <AnalysisDashboardPanel />}
        {activeTab === 'iceberg' && <IcebergCanvasPanel />}
        {activeTab === 'pdca' && <PdcaPanel />}
      </React.Suspense>
    </Box>
  );
};

export default AnalysisWorkspacePage;
