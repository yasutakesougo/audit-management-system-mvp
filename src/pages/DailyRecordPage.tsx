/**
 * DailyRecordPage — Thin Orchestrator
 *
 * Composes:
 *   - dailyRecordMockData: mock data, generators, factory
 *   - useDailyRecordViewModel: state, handlers, filtering
 *   - DailyRecordStatsPanel: statistics cards
 *   - DailyRecordFilterPanel: search/status/date filters
 *   - DailyRecordBulkActions: bulk operation buttons
 *
 * 639 → ~220 lines (composition only)
 */

import { PageHeader } from '@/components/PageHeader';
import { PersonDaily } from '@/domain/daily/types';
import { saveDailyRecord, validateDailyRecord } from '@/features/daily/domain/dailyRecordLogic';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import { LandscapeFab } from '../components/ui/LandscapeFab';
import { FullScreenDailyDialogPage } from '../features/daily/components/FullScreenDailyDialogPage';
import { DailyRecordForm } from '../features/daily/forms/DailyRecordForm';
import { DailyRecordList } from '../features/daily/lists/DailyRecordList';
import { useDailyRecordViewModel } from '../features/daily/lists/useDailyRecordViewModel';
import { useHandoffSummary } from '../features/handoff/useHandoffSummary';
import { useUsersDemo } from '../features/users/usersStoreDemo';
import { useSchedules } from '../stores/useSchedules';
import { calculateAttendanceRate, getExpectedAttendeeCount } from '../utils/attendanceUtils';
import { DailyRecordBulkActions } from './DailyRecordBulkActions';
import { DailyRecordFilterPanel } from './DailyRecordFilterPanel';
import {
    createMissingRecord,
    generateTodayRecords,
    mockRecords,
    mockUsers,
} from './dailyRecordMockData';
import { DailyRecordStatsPanel } from './DailyRecordStatsPanel';

export default function DailyRecordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();

  const { data: usersData } = useUsersDemo();
  const { data: schedulesData } = useSchedules();

  const [records, setRecords] = useState<PersonDaily[]>(mockRecords);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PersonDaily | undefined>();
  const vm = useDailyRecordViewModel<PersonDaily>({
    locationState: location.state,
    searchParams,
    records,
    setRecords,
    editingRecord,
    setEditingRecord,
    setFormOpen,
    navigate,
    validateDailyRecord,
    saveDailyRecord,
    generateTodayRecords,
    mockUsers,
    createMissingRecord,
  });

  const {
    highlightUserId,
    highlightDate,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    filteredRecords,
    handleOpenForm,
    handleEditRecord,
    handleCloseForm,
    handleOpenAttendance,
    handleSaveRecord,
    handleDeleteRecord,
    handleGenerateTodayRecords,
    handleBulkCreateMissing,
    handleBulkComplete,
  } = vm;

  // Phase 1A: handoff summary
  const {
    total: handoffTotal,
    criticalCount: handoffCritical,
  } = useHandoffSummary({ dayScope: 'today' });

  // Phase 2-1: highlight state (auto-dismiss after 1.5s)
  const [activeHighlightUserId, setActiveHighlightUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightUserId) return;
    const timer = setTimeout(() => {
      const element = document.querySelector(`[data-person-id="${highlightUserId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveHighlightUserId(highlightUserId);
        setTimeout(() => setActiveHighlightUserId(null), 1500);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightUserId, records]);

  // Attendance calculation
  const todayAttendanceInfo = useMemo(() => {
    const today = new Date();
    if (!usersData || !schedulesData) {
      return { expectedCount: 32, attendanceRate: 0 };
    }

    const adaptedUsers = usersData.map((user) => ({
      Id: user.Id,
      UserID: user.UserID,
      FullName: user.FullName,
      AttendanceDays: user.AttendanceDays || [],
      ServiceStartDate: user.ServiceStartDate || undefined,
      ServiceEndDate: user.ServiceEndDate || undefined,
    }));

    const adaptedSchedules = schedulesData.map((schedule) => ({
      id: schedule.id,
      userId: schedule.userId?.toString() || schedule.personId?.toString(),
      title: schedule.title || '',
      startLocal: schedule.startLocal || undefined,
      startUtc: schedule.startUtc || undefined,
      status: schedule.status,
      category: schedule.category || undefined,
    }));

    const { expectedCount, absentUserIds } = getExpectedAttendeeCount(
      adaptedUsers,
      adaptedSchedules,
      today,
    );

    const todayRecords = records.filter((r) => r.date === today.toISOString().split('T')[0]);
    const actualCount = todayRecords.filter((r) => r.status === '完了').length;
    const attendanceRate = calculateAttendanceRate(actualCount, expectedCount);

    return { expectedCount, attendanceRate, actualCount, absentUserIds };
  }, [usersData, schedulesData, records]);

  return (
    <FullScreenDailyDialogPage
      title="支援記録（ケース記録）"
      backTo="/daily/menu"
      testId="daily-activity-page"
    >
      <Container maxWidth="lg" data-testid="records-daily-root">
        <Box sx={{ py: 3 }}>
          <PageHeader
            title="支援記録（ケース記録）"
            subtitle="利用者全員の日々の活動状況、問題行動、発作記録を管理します"
          />

          {/* Handoff summary banner */}
          {handoffTotal > 0 && (
            <Card
              sx={{
                mb: 2,
                bgcolor: handoffCritical > 0 ? 'error.50' : 'info.50',
                border: '1px solid',
                borderColor: handoffCritical > 0 ? 'error.200' : 'info.200',
              }}
              data-testid="daily-handoff-summary"
            >
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={2}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <AccessTimeIcon
                      color={handoffCritical > 0 ? 'error' : 'primary'}
                      sx={{ fontSize: 32 }}
                    />
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        本日の申し送り: {handoffTotal}件
                      </Typography>
                      {handoffCritical > 0 && (
                        <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                          ⚠️ 重要 {handoffCritical}件 - 要確認
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Button
                    variant="contained"
                    size="medium"
                    startIcon={<AccessTimeIcon />}
                    onClick={() =>
                      navigate(buildHandoffTimelineUrl(), {
                        state: { dayScope: 'today', timeFilter: 'all' },
                      })
                    }
                    sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                    data-testid="daily-handoff-summary-cta"
                  >
                    タイムラインで確認
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}

          <DailyRecordStatsPanel
            records={records}
            expectedCount={todayAttendanceInfo.expectedCount}
            attendanceRate={todayAttendanceInfo.attendanceRate}
            absentUserIds={todayAttendanceInfo.absentUserIds}
          />

          <DailyRecordFilterPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onClear={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setDateFilter('');
            }}
          />

          <DailyRecordBulkActions
            onGenerateTodayRecords={handleGenerateTodayRecords}
            onBulkCreateMissing={handleBulkCreateMissing}
            onBulkComplete={handleBulkComplete}
          />

          <DailyRecordList
            records={filteredRecords}
            onEdit={handleEditRecord}
            onDelete={handleDeleteRecord}
            onOpenAttendance={handleOpenAttendance}
            highlightUserId={highlightUserId}
            highlightDate={highlightDate}
            activeHighlightUserId={activeHighlightUserId}
            data-testid="daily-record-list"
          />

          <DailyRecordForm
            open={formOpen}
            onClose={handleCloseForm}
            record={editingRecord}
            onSave={handleSaveRecord}
            data-testid="daily-record-form"
          />

          <LandscapeFab
            icon={<AddIcon />}
            ariaLabel="新規記録作成"
            onClick={handleOpenForm}
            testId="add-record-fab"
          />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: theme.palette.grey[800],
                color: theme.palette.common.white,
              },
              success: {
                iconTheme: {
                  primary: theme.palette.success.main,
                  secondary: theme.palette.common.white,
                },
              },
              error: {
                iconTheme: {
                  primary: theme.palette.error.main,
                  secondary: theme.palette.common.white,
                },
              },
            }}
          />
        </Box>
      </Container>
    </FullScreenDailyDialogPage>
  );
}
