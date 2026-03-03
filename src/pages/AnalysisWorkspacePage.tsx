import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import * as React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
const TAB_KEYS = ['dashboard', 'iceberg', 'pdca'] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TAB_LABELS: Record<TabKey, string> = {
  dashboard: 'ダッシュボード',
  iceberg: '氷山モデル',
  pdca: 'PDCA',
};

// ---------------------------------------------------------------------------
// Lazy-loaded tab panels — 各パネルは既存ページをそのまま使う
// ---------------------------------------------------------------------------
const AnalysisDashboardPanel = React.lazy(
  () => import('@/pages/AnalysisDashboardPage'),
);
const PdcaPanel = React.lazy(() => import('@/pages/IcebergPdcaPage'));

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export const AnalysisWorkspacePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state from URL
  const tabParam = (searchParams.get('tab') ?? 'dashboard') as TabKey;
  const activeTab = TAB_KEYS.includes(tabParam) ? tabParam : 'dashboard';

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', newValue);
    setSearchParams(next, { replace: true });
  };

  // 氷山モデルタブはfull-page Canvas操作なので専用ページへリダイレクト
  if (activeTab === 'iceberg') {
    return <Navigate to="/analysis/iceberg-standalone" replace />;
  }

  return (
    <Box data-testid="analysis-workspace-page">
      {/* タブ */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
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
          <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
            読み込み中…
          </Box>
        }
      >
        {activeTab === 'dashboard' && <AnalysisDashboardPanel />}
        {activeTab === 'pdca' && <PdcaPanel />}
      </React.Suspense>
    </Box>
  );
};

export default AnalysisWorkspacePage;
