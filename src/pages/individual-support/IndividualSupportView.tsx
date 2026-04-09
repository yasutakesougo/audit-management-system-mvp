import React from 'react';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SupportIcon from '@mui/icons-material/Support';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { IBDPageHeader } from '@/features/ibd/core/components/IBDPageHeader';
import { UserSelectionGrid } from '@/features/users/components/UserSelectionGrid';
import { DailyRecordsTab } from '@/features/ibd/procedures/daily-records/components/DailyRecordsTab';
import { MonitoringRevisionDialog } from '@/features/ibd/procedures/daily-records/components/MonitoringRevisionDialog';
import { SupportPlanTab } from '@/features/ibd/procedures/daily-records/components/SupportPlanTab';
import { PdcaCyclePanel } from '@/features/ibd/analysis/pdca/components/PdcaCyclePanel';

import { type IndividualSupportViewProps } from './types';

/**
 * 個別支援管理画面の受動的ビュー (Passive View)。
 * 描画ロジックと Mui コンポーネントの配置に専念する。
 */
export const IndividualSupportView: React.FC<IndividualSupportViewProps> = ({
  viewModel,
  handlers,
}) => {
  if (!viewModel) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  const {
    userCode,
    selectedUser,
    ibdUsers,
    activeTab,
    isTemplatesLoading,
    slots,
    recordedCount,
    formState,
    timeline,
    showOnlyUnrecorded,
    pdcaState,
    isPdcaLoading,
    pdcaError,
    monitoringDialogOpen,
    activeSPS,
    activeSPSHistory,
    snackbar,
    templates,
  } = viewModel;

  // -----------------------------------------------------------------------
  // Render: 利用者未選択
  // -----------------------------------------------------------------------
  if (!userCode || !selectedUser) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <IBDPageHeader
          title="個別支援手順管理"
          subtitle="利用者を選択して、支援計画と日々の記録を管理します。"
          icon={<SupportIcon />}
        />
        <Paper elevation={1}>
          <UserSelectionGrid
            users={ibdUsers}
            onSelect={handlers.onUserSelect}
            title="対象利用者を選択してください"
            subtitle="強度行動障害支援の対象となる利用者の個別支援手順を管理します。行動分析対象者は優先表示されています。"
          />
        </Paper>
      </Box>
    );
  }

  // -----------------------------------------------------------------------
  // Render: 利用者選択済み
  // -----------------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <IBDPageHeader
        title={`${selectedUser.FullName} の支援手順の実施`}
        subtitle={`支援計画の確認と日々の記録をワンページで管理できます。記録済み ${recordedCount}/${slots.length}`}
        icon={<SupportIcon />}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditNoteIcon />}
              onClick={handlers.onOpenMonitoring}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              📝 モニタリング更新
            </Button>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="user-select-label">利用者</InputLabel>
              <Select
                labelId="user-select-label"
                value={userCode}
                label="利用者"
                onChange={handlers.onUserChange}
              >
                {ibdUsers.map((u) => (
                  <MenuItem key={u.UserID} value={u.UserID}>
                    {u.FullName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        }
      />

      {isTemplatesLoading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Paper elevation={1}>
        <Tabs
          value={activeTab}
          onChange={handlers.onTabChange}
          aria-label="支援計画と日々の記録タブ"
          variant="fullWidth"
        >
          <Tab value="plan" label="支援計画書" icon={<FavoriteIcon fontSize="small" />} iconPosition="start" />
          <Tab value="records" label="日々の記録" icon={<ScheduleIcon fontSize="small" />} iconPosition="start" />
          <Tab value="pdca" label="PDCAサイクル" icon={<AutorenewRoundedIcon fontSize="small" />} iconPosition="start" />
        </Tabs>

        {activeTab === 'plan' && (
          <SupportPlanTab templates={templates} isLoading={isTemplatesLoading} />
        )}

        {activeTab === 'records' && (
          <DailyRecordsTab
            slots={slots}
            formState={formState}
            timeline={timeline}
            showOnlyUnrecorded={showOnlyUnrecorded}
            onMoodSelect={handlers.onMoodSelect}
            onNoteChange={handlers.onNoteChange}
            onToggleABC={handlers.onToggleABC}
            onABCSelect={handlers.onABCSelect}
            onRecord={handlers.onRecord}
            onToggleUnrecorded={handlers.onToggleUnrecorded}
          />
        )}

        {activeTab === 'pdca' && (
          <Box sx={{ p: 2 }}>
            <PdcaCyclePanel
              state={pdcaState}
              loading={isPdcaLoading}
              error={pdcaError as Error}
            />
          </Box>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handlers.onCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handlers.onCloseSnackbar} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>

      <MonitoringRevisionDialog
        open={monitoringDialogOpen}
        onClose={handlers.onCloseMonitoring}
        currentSPS={activeSPS}
        history={activeSPSHistory}
        onRevise={handlers.onReviseSPS}
        userName={selectedUser.FullName}
      />
    </Box>
  );
};
