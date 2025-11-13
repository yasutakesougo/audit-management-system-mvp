import AnalyticsIcon from '@mui/icons-material/Analytics';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MonthlySummaryTable } from '../features/records/monthly/MonthlySummaryTable';
import { getCurrentYearMonth } from '../features/records/monthly/map';
import type { MonthlySummary, YearMonth } from '../features/records/monthly/types';
import { TESTIDS } from '../testids';

// モックデータ（後でAPIから取得）
const mockMonthlySummaries: MonthlySummary[] = [
  {
    userId: 'I001',
    yearMonth: '2025-11' as YearMonth,
    displayName: '田中太郎',
    lastUpdatedUtc: '2024-11-06T10:30:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418, // 22日 × 19行/日
      completedRows: 380,
      inProgressRows: 25,
      emptyRows: 13,
      specialNotes: 8,
      incidents: 2,
    },
    completionRate: 90.91,
    firstEntryDate: '2024-11-01',
    lastEntryDate: '2024-11-05',
  },
  {
    userId: 'I002',
    yearMonth: '2025-11' as YearMonth,
    displayName: '佐藤花子',
    lastUpdatedUtc: '2024-11-06T09:15:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418,
      completedRows: 295,
      inProgressRows: 48,
      emptyRows: 75,
      specialNotes: 12,
      incidents: 0,
    },
    completionRate: 70.57,
    firstEntryDate: '2024-11-01',
    lastEntryDate: '2024-11-05',
  },
  {
    userId: 'I003',
    yearMonth: '2025-11' as YearMonth,
    displayName: '鈴木次郎',
    lastUpdatedUtc: '2024-11-06T11:45:00Z',
    kpi: {
      totalDays: 22,
      plannedRows: 418,
      completedRows: 201,
      inProgressRows: 82,
      emptyRows: 135,
      specialNotes: 5,
      incidents: 1,
    },
    completionRate: 48.09,
    firstEntryDate: '2024-11-02',
    lastEntryDate: '2024-11-05',
  },
];

const srOnly = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  width: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  position: 'absolute' as const,
  whiteSpace: 'nowrap' as const,
};

type TabKey = 'summary' | 'user-detail' | 'pdf';

export default function MonthlyRecordPage() {
  const [params, setParams] = useSearchParams();
  const [summaries] = React.useState<MonthlySummary[]>(mockMonthlySummaries);
  const [loading] = React.useState(false);

  // URLパラメータからタブを決定
  const tab = (params.get('tab') as TabKey) || 'summary';
  const allowedTabs: TabKey[] = ['summary', 'user-detail', 'pdf'];

  const setTab = (newTab: TabKey) => {
    if (!allowedTabs.includes(newTab) || newTab === tab) return;

    const newParams = new URLSearchParams(params);
    newParams.set('tab', newTab);
    setParams(newParams);
  };

  // 統計情報
  const stats = React.useMemo(() => {
    const currentMonth = getCurrentYearMonth();
    const currentMonthSummaries = summaries.filter(s => s.yearMonth === currentMonth);

    return {
      totalUsers: currentMonthSummaries.length,
      avgCompletionRate: currentMonthSummaries.length > 0
        ? Math.round(currentMonthSummaries.reduce((sum, s) => sum + s.completionRate, 0) / currentMonthSummaries.length * 100) / 100
        : 0,
      highPerformers: currentMonthSummaries.filter(s => s.completionRate >= 90).length,
      needsAttention: currentMonthSummaries.filter(s => s.completionRate < 70).length,
    };
  }, [summaries]);

  const handleReaggregate = async (userId: string, yearMonth: YearMonth) => {
    console.log(`再集計開始: ${userId} - ${yearMonth}`);
    // TODO: API呼び出し実装
    await new Promise(resolve => setTimeout(resolve, 1000)); // モック遅延
    console.log(`再集計完了: ${userId} - ${yearMonth}`);
  };

  const handleUserSelect = (userId: string, yearMonth: YearMonth) => {
    const newParams = new URLSearchParams(params);
    newParams.set('tab', 'user-detail');
    newParams.set('user', userId);
    newParams.set('month', yearMonth);
    setParams(newParams);
  };

  return (
    <Container maxWidth="xl" data-testid={TESTIDS['monthly-page']}>
      <Box sx={{ py: 3 }}>
        {/* ヘッダー */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1">
            月次記録
          </Typography>
          <Typography variant="body1" color="text.secondary">
            利用者の月次活動記録を集計・分析し、完了率や進捗状況を管理します
          </Typography>
        </Box>

        {/* 統計サマリー */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            今月の全体状況 ({getCurrentYearMonth()})
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h5" color="primary.main">
                {stats.totalUsers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                対象利用者数
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" color="info.main">
                {stats.avgCompletionRate}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                平均完了率
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" color="success.main">
                {stats.highPerformers}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                高完了率者 (90%+)
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" color="error.main">
                {stats.needsAttention}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                要注意者 (&lt;70%)
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* タブナビゲーション */}
        <Tabs
          value={tab}
          onChange={(_, value: TabKey) => setTab(value)}
          aria-label="月次記録ワークスペースタブ"
          data-testid="monthly-workspace-tabs"
          sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, mb: 2 }}
        >
          <Tab
            value="summary"
            label="組織サマリー"
            id="monthly-tab-summary"
            aria-controls="monthly-tabpanel-summary"
            data-testid={TESTIDS['monthly-tab-summary']}
            icon={<TableViewIcon />}
            iconPosition="start"
          />
          <Tab
            value="user-detail"
            label="利用者別詳細"
            id="monthly-tab-user-detail"
            aria-controls="monthly-tabpanel-user-detail"
            data-testid={TESTIDS['monthly-tab-detail']}
            icon={<AnalyticsIcon />}
            iconPosition="start"
          />
          <Tab
            value="pdf"
            label="月次PDF"
            id="monthly-tab-pdf"
            aria-controls="monthly-tabpanel-pdf"
            data-testid={TESTIDS['monthly-tab-pdf']}
            icon={<PictureAsPdfIcon />}
            iconPosition="start"
          />
        </Tabs>

        {/* 組織サマリータブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'summary'}
          id="monthly-tabpanel-summary"
          aria-labelledby="monthly-tab-summary"
        >
          <Box component="section" aria-label="組織サマリー表示">
            <Typography component="p" sx={srOnly}>
              全利用者の月次記録完了状況を一覧表示し、再集計や詳細確認ができます。
            </Typography>
            <MonthlySummaryTable
              summaries={summaries}
              loading={loading}
              onReaggregate={handleReaggregate}
              onUserSelect={handleUserSelect}
            />
          </Box>
        </Box>

        {/* 利用者別詳細タブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'user-detail'}
          id="monthly-tabpanel-user-detail"
          aria-labelledby="monthly-tab-user-detail"
        >
          <Box component="section" aria-label="利用者別詳細表示">
            <Typography component="p" sx={srOnly}>
              選択した利用者の月次記録詳細とKPIカードを表示します。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  利用者別詳細
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  組織サマリーから利用者を選択してください
                </Typography>
                {params.get('user') && (
                  <Typography variant="body1">
                    選択中: {params.get('user')} ({params.get('month')})
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* 月次PDFタブ */}
        <Box
          role="tabpanel"
          hidden={tab !== 'pdf'}
          id="monthly-tabpanel-pdf"
          aria-labelledby="monthly-tab-pdf"
        >
          <Box component="section" aria-label="月次PDF出力">
            <Typography component="p" sx={srOnly}>
              月次記録をPDF形式で出力・ダウンロードできます。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  月次PDF出力
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  この機能は将来実装予定です
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}