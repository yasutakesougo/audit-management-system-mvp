// ---------------------------------------------------------------------------
// A層: TimeFlow ページ – hook を呼んで View へ props を渡すだけ
// ---------------------------------------------------------------------------
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

import { useTimeFlowState } from './hooks/useTimeFlowState';
import DailyInsightsPanel from './views/DailyInsightsPanel';
import MonitoringInfo from './views/MonitoringInfo';
import PlanDeploymentSummary from './views/PlanDeploymentSummary';
import QuickActionToolbar from './views/QuickActionToolbar';
import RecordSummaryCard from './views/RecordSummaryCard';
import SupportPlanQuickView from './views/SupportPlanQuickView';
import SupportRecordReviewList from './views/SupportRecordReviewList';
import SupportUserPicker from './views/SupportUserPicker';
import TimeFlowSupportRecordList from './views/TimeFlowSupportRecordList';

const TimeFlowPage: React.FC = () => {
  const s = useTimeFlowState();

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* ヘッダー */}
        <Paper elevation={3} sx={{ p: 4, mb: 4, bgcolor: 'gradient.primary', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          {/* 戻るボタン */}
          {s.returnMode && (
            <Box mb={2}>
              <Button
                variant="outlined"
                onClick={s.handleBack}
                startIcon={<ArrowBackIcon />}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                data-testid="support-back"
              >
                {s.returnMode === 'morning'
                  ? '朝会ダッシュボードに戻る'
                  : s.returnMode === 'evening'
                    ? '夕会ダッシュボードに戻る'
                    : s.returnMode === 'detail'
                      ? '利用者詳細に戻る'
                      : '日次メニューに戻る'}
              </Button>
            </Box>
          )}

          <Box display="flex" alignItems="center" gap={3} mb={3}>
            <Box sx={{
              bgcolor: 'white',
              p: 2,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ScheduleIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            </Box>
            <Box>
              <Typography variant="h3" fontWeight="bold" color="white" gutterBottom>
                支援手順兼記録
              </Typography>
              <Typography variant="h6" color="white" sx={{ opacity: 0.9 }}>
                一日の流れに沿った直感的な支援手順兼記録システム
              </Typography>
              <Typography variant="subtitle1" color="white" sx={{ opacity: 0.8 }}>
                開所時間 9:30-16:00 → 本人のやること・職員のやることをカードで管理
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Chip
              icon={<PersonIcon />}
              label={`対象者: ${s.getActiveUsersCount()}名`}
              sx={{ bgcolor: 'white', color: 'primary.main' }}
            />
            <Chip
              icon={<AccessTimeIcon />}
              label="具体的時間表示"
              sx={{ bgcolor: 'white', color: 'secondary.main' }}
            />
            <Chip
              icon={<AutoAwesomeIcon />}
              label="直感的カード表示"
              sx={{ bgcolor: 'white', color: 'success.main' }}
            />
            <Chip
              icon={<TrendingUpIcon />}
              label="強度行動障害支援"
              sx={{ bgcolor: 'white', color: 'warning.main' }}
            />
          </Stack>
        </Paper>

        {/* フィルター・検索 */}
        <Card sx={{ mb: 4 }} elevation={2}>
          <CardContent>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
              <SearchIcon color="primary" />
              記録対象選択
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
              <TextField
                label="利用者名で検索"
                value={s.searchTerm}
                onChange={(e) => s.setSearchTerm(e.target.value)}
                sx={{ minWidth: 200 }}
                size="small"
              />

              <TextField
                label="記録日"
                type="date"
                value={s.selectedDate}
                onChange={(e) => s.setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
                size="small"
              />

              {s.selectedUser && (
                <Button
                  onClick={s.generateAutoSchedule}
                  startIcon={<AutoAwesomeIcon />}
                  variant="outlined"
                  color="secondary"
                >
                  サンプル生成
                </Button>
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              利用者カードをクリックすると対象者が選択されます。検索条件やプラン種別フィルタを切り替えると一覧がリアルタイムに絞り込まれます。
            </Typography>

            <Collapse in={s.selectionClearedNotice}>
              <Alert severity="info" sx={{ mt: 2 }} onClose={() => s.setSelectionClearedNotice(false)}>
                絞り込み条件により選択中の利用者が一覧から外れたため、選択を解除しました。
              </Alert>
            </Collapse>

            <SupportUserPicker
              users={s.filteredUsers}
              selectedUserId={s.selectedUser}
              planTypeOptions={s.planTypeOptions}
              selectedPlanType={s.selectedPlanType}
              totalAvailableCount={s.searchMatchedUsers.length}
              onPlanTypeSelect={s.setSelectedPlanType}
              onSelect={s.handleUserSelect}
            />

            {s.selectedUser && (
              <PlanDeploymentSummary
                deployment={s.supportDeployment}
                activities={s.supportActivities}
              />
            )}
          </CardContent>
        </Card>

        {/* メイン記録エリア */}
        {s.selectedUser && s.currentDailyRecord ? (
          <Box ref={s.recordSectionRef}>
            <QuickActionToolbar
              pendingCount={s.pendingCount}
              onGenerateSample={s.generateAutoSchedule}
              onMarkComplete={s.handleMarkComplete}
              isComplete={Boolean(s.isComplete)}
            />

            <MonitoringInfo
              personName={s.currentDailyRecord.personName}
              currentDate={s.selectedDate}
            />

            <Paper elevation={1} sx={{ mb: 4 }}>
              <Tabs
                value={s.activeTab}
                onChange={s.handleTabChange}
                variant="fullWidth"
                aria-label="支援手順兼記録タブ"
              >
                <Tab value="input" label="記録入力" />
                <Tab value="review" label="記録閲覧" />
              </Tabs>

              <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <RecordSummaryCard record={s.currentDailyRecord} date={s.selectedDate} />

                {s.activeTab === 'input' ? (
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
                    <Box sx={{ flexGrow: 1 }}>
                      <TimeFlowSupportRecordList
                        activities={s.supportActivities}
                        dailyRecord={s.currentDailyRecord}
                        onAddRecord={s.handleAddRecord}
                        onUpdateRecord={s.handleUpdateRecord}
                      />
                    </Box>
                    <Stack spacing={3} sx={{ flexBasis: { lg: '32%' }, flexGrow: 1 }}>
                      <DailyInsightsPanel dailyRecord={s.currentDailyRecord} />
                      <SupportPlanQuickView dailyRecord={s.currentDailyRecord} activities={s.supportActivities} />
                    </Stack>
                  </Stack>
                ) : (
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="stretch">
                    <Box sx={{ flexGrow: 1 }}>
                      <SupportRecordReviewList dailyRecord={s.currentDailyRecord} />
                    </Box>
                    <Stack spacing={3} sx={{ flexBasis: { lg: '32%' }, flexGrow: 1 }}>
                      <DailyInsightsPanel dailyRecord={s.currentDailyRecord} />
                      <SupportPlanQuickView dailyRecord={s.currentDailyRecord} activities={s.supportActivities} />
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Paper>
          </Box>
        ) : (
          <Alert severity="info" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              支援手順兼記録を開始
            </Typography>
            <Typography>
              利用者と記録日を選択して、支援手順兼記録を開始してください。<br />
              <strong>開所時間 9:30-16:00</strong>の具体的な時間と活動内容がカードで表示されます。<br />
              各カードには「本人のやること」「職員のやること」が明確に示され、直感的に記録できます。<br />
              モニタリング周期は<strong>三ヶ月ごと</strong>に設定されています。
            </Typography>
          </Alert>
        )}
      </Box>
    </Container>
  );
};

export default TimeFlowPage;
