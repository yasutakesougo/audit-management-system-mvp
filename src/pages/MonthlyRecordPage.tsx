import AnalyticsIcon from '@mui/icons-material/Analytics';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableViewIcon from '@mui/icons-material/TableView';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MonthlySummaryTable } from '../features/records/monthly/MonthlySummaryTable';
import { UserKpiCards } from '../features/records/monthly/UserKpiCards';
import { UserProgressChart } from '../features/records/monthly/UserProgressChart';
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

const DEFAULT_MONTH: YearMonth = mockMonthlySummaries[0]?.yearMonth ?? getCurrentYearMonth();

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

  const [selectedMonth, setSelectedMonth] = React.useState<YearMonth>(DEFAULT_MONTH);
  const [keyword, setKeyword] = React.useState('');

  const monthOptions = React.useMemo<YearMonth[]>(
    () => Array.from(new Set(summaries.map((s) => s.yearMonth))) as YearMonth[],
    [summaries],
  );

  const filteredSummaries = React.useMemo(
    () =>
      summaries.filter((s) => {
        if (s.yearMonth !== selectedMonth) return false;
        if (!keyword.trim()) return true;
        const lower = keyword.toLowerCase();
        return (
          s.displayName.toLowerCase().includes(lower) ||
          s.userId.toLowerCase().includes(lower)
        );
      }),
    [summaries, selectedMonth, keyword],
  );

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
    if (filteredSummaries.length === 0) {
      return {
        totalUsers: 0,
        avgCompletionRate: 0,
        highPerformers: 0,
        needsAttention: 0,
      };
    }

    return {
      totalUsers: filteredSummaries.length,
      avgCompletionRate:
        Math.round(
          (filteredSummaries.reduce((sum, s) => sum + s.completionRate, 0) /
            filteredSummaries.length) *
            100,
        ) / 100,
      highPerformers: filteredSummaries.filter((s) => s.completionRate >= 90).length,
      needsAttention: filteredSummaries.filter((s) => s.completionRate < 70).length,
    };
  }, [filteredSummaries]);

  const handleReaggregate = async (userId: string, yearMonth: YearMonth) => {
    console.log(`再集計開始: ${userId} - ${yearMonth}`);
    // TODO: API呼び出し実装
    await new Promise(resolve => setTimeout(resolve, 1000)); // モック遅延
    console.log(`再集計完了: ${userId} - ${yearMonth}`);
  };

  const handleUserSelect = (userId: string, yearMonth: YearMonth) => {
    // 選択されたユーザーの月に合わせてフィルタを調整
    setSelectedMonth(yearMonth);

    // タブを user-detail に切り替え、URLパラメータにユーザー情報を設定
    const newParams = new URLSearchParams(params);
    newParams.set('tab', 'user-detail');
    newParams.set('user', userId);
    newParams.set('month', yearMonth);
    setParams(newParams);
  };

  const handleGenerateMonthlyPdf = async () => {
    console.log(`PDF生成開始: ${selectedMonth} - 対象利用者数: ${filteredSummaries.length}`);
    // TODO: Power Automate API呼び出し実装
    // - 選択月のデータを準備
    // - フィルター条件を含めたリクエスト作成
    // - Power Automate フローをトリガー
    await new Promise(resolve => setTimeout(resolve, 2000)); // モック遅延
    console.log(`PDF生成完了: ${selectedMonth}`);
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

        {/* フィルターバー */}
        <Box sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <TextField
              select
              size="small"
              label="対象月"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value as YearMonth)}
              helperText="集計対象の月を選択"
              sx={{ minWidth: 180 }}
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </TextField>
            <TextField
              size="small"
              label="利用者名 / コードで絞り込み"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例: 田中 / I001"
              sx={{ minWidth: 220 }}
            />
          </Stack>
        </Box>

        {/* 統計サマリー */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <Typography variant="h6" gutterBottom>
            今月の全体状況 ({selectedMonth})
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
              summaries={filteredSummaries}
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
          <Box
            component="section"
            aria-label="利用者別詳細表示"
            data-testid={TESTIDS['monthly-detail-records-table']}
          >
            <Typography component="p" sx={srOnly}>
              選択した利用者の月次記録詳細とKPIカードを表示します。
            </Typography>

            {(() => {
              const selectedUserId = params.get('user');
              const selectedUserMonth = params.get('month') as YearMonth | null;

              if (!selectedUserId || !selectedUserMonth) {
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" gutterBottom>
                        利用者別詳細
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        組織サマリーから利用者を選択してください
                      </Typography>
                    </Box>
                  </Box>
                );
              }

              // filteredSummaries から該当ユーザーを検索
              const selectedUserSummary = filteredSummaries.find(
                summary => summary.userId === selectedUserId && summary.yearMonth === selectedUserMonth
              );

              if (!selectedUserSummary) {
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" gutterBottom>
                        利用者が見つかりません
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        選択した利用者 ({selectedUserId}) の {selectedUserMonth} のデータが見つかりませんでした。
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        フィルター条件を確認してください。
                      </Typography>
                    </Box>
                  </Box>
                );
              }

              return (
                <Stack spacing={3}>
                  {/* KPIカード表示 */}
                  <UserKpiCards
                    summary={selectedUserSummary}
                    avgCompletionRate={stats.avgCompletionRate}
                  />

                  {/* プログレスチャート表示 */}
                  <UserProgressChart summary={selectedUserSummary} />
                </Stack>
              );
            })()}
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

            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <Stack spacing={3}>
                {/* PDF出力情報カード */}
                <Card>
                  <CardContent>
                    <Stack spacing={2}>
                      <Typography variant="h6" gutterBottom>
                        月次記録PDF出力
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        選択した条件に基づいて月次記録のPDFレポートを生成します。
                      </Typography>

                      {/* 出力条件サマリー */}
                      <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          出力対象
                        </Typography>

                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">対象月:</Typography>
                            <Typography variant="body2" color="primary.main">
                              {selectedMonth}
                            </Typography>
                          </Stack>

                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">対象利用者数:</Typography>
                            <Typography variant="body2" color="primary.main">
                              {filteredSummaries.length}名
                            </Typography>
                          </Stack>

                          {keyword && (
                            <Stack direction="row" justifyContent="space-between">
                              <Typography variant="body2">絞り込み条件:</Typography>
                              <Typography variant="body2" color="primary.main">
                                "{keyword}"
                              </Typography>
                            </Stack>
                          )}

                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">平均完了率:</Typography>
                            <Typography variant="body2" color="info.main">
                              {stats.avgCompletionRate}%
                            </Typography>
                          </Stack>
                        </Stack>
                      </Box>

                      {/* PDF生成ボタン */}
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<CloudDownloadIcon />}
                        onClick={handleGenerateMonthlyPdf}
                        disabled={filteredSummaries.length === 0}
                        data-testid={TESTIDS['monthly-pdf-generate-btn']}
                        sx={{ mt: 2 }}
                      >
                        月次PDFレポートを生成
                      </Button>

                      {filteredSummaries.length === 0 && (
                        <Typography variant="caption" color="warning.main" textAlign="center">
                          対象データがありません。フィルター条件を確認してください。
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Power Automate 連携情報 */}
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2" color="text.secondary">
                        🔧 Power Automate 連携
                      </Typography>

                      <Typography variant="body2" color="text.secondary">
                        PDFレポート生成は Power Automate ワークフローを通じて処理されます。
                        生成が完了すると、メール通知またはダウンロードリンクが提供されます。
                      </Typography>

                      <Typography variant="caption" color="text.secondary">
                        ※ 現在は開発中のため、実際のPDF生成は行われません
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}