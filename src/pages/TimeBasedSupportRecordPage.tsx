import { ProcedureEditor } from '@/features/daily/components/procedure/ProcedureEditor';
import { ProcedurePanel } from '@/features/daily/components/split-stream/ProcedurePanel';
import { RecordPanel, type RecordPanelLockState } from '@/features/daily/components/split-stream/RecordPanel';
import { SplitStreamLayout } from '@/features/daily/components/split-stream/SplitStreamLayout';
import type { BehaviorObservation } from '@/features/daily/domain/daily/types';
import { useBehaviorStore } from '@/features/daily/stores/behaviorStore';
import { useProcedureStore, type ProcedureItem } from '@/features/daily/stores/procedureStore';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FullScreenDailyDialogPage } from '@/features/daily/components/FullScreenDailyDialogPage';

const TimeBasedSupportRecordPage: React.FC = () => {
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { add, data: behaviorRecords, fetchByUser } = useBehaviorStore();
  const { getByUser, save } = useProcedureStore();
  const { data: users } = useUsersDemo();
  const selectedUser = useMemo(() => users.find((user) => user.UserID === targetUserId), [users, targetUserId]);
  const recentObservations = useMemo(
    () => behaviorRecords.filter((behavior) => behavior.userId === targetUserId),
    [behaviorRecords, targetUserId],
  );
  const schedule = useMemo(() => {
    if (!targetUserId) return [];
    return getByUser(targetUserId);
  }, [getByUser, targetUserId]);
  const recordLockState = useMemo<RecordPanelLockState>(() => {
    if (!targetUserId) return 'no-user';
    return isAcknowledged ? 'unlocked' : 'unconfirmed';
  }, [targetUserId, isAcknowledged]);

  useEffect(() => {
    if (!targetUserId) return;
    fetchByUser(targetUserId);
  }, [fetchByUser, targetUserId]);

  const handleRecordSubmit = useCallback(async (payload: Omit<BehaviorObservation, 'id' | 'userId'>) => {
    if (!targetUserId) return;
    await add({
      ...payload,
      userId: targetUserId,
    });
    setSnackbarOpen(true);
  }, [add, targetUserId]);

  const handleUserChange = useCallback((event: SelectChangeEvent<string>) => {
    setTargetUserId(event.target.value);
    setIsAcknowledged(false);
  }, []);

  const handleSnackbarClose = useCallback(() => {
    setSnackbarOpen(false);
  }, []);

  const handleProcedureSave = useCallback((items: ProcedureItem[]) => {
    if (!targetUserId) return;
    save(targetUserId, items);
    setIsAcknowledged(false);
  }, [save, targetUserId]);

  const handleEditorOpen = useCallback(() => {
    setIsEditOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setIsEditOpen(false);
  }, []);

  return (
    <FullScreenDailyDialogPage
      title="支援（サポート記録）"
      backTo="/daily/menu"
      testId="daily-support-page"
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.100' }}
        data-testid="iceberg-time-based-support-record-page"
      >
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          borderRadius: 0
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <AccessTimeIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Iceberg-PDCA: 統合型タイムラインビュー
            </Typography>
            <Typography variant="body2" color="text.secondary">
              FR-B01 (Plan確認) / FR-B02 (クイック行動記録)
            </Typography>
          </Box>
        </Stack>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="iceberg-user-select-label">支援対象者</InputLabel>
          <Select
            labelId="iceberg-user-select-label"
            value={targetUserId}
            label="支援対象者"
            onChange={handleUserChange}
            startAdornment={<PersonIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
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
      </Paper>

      <Box sx={{ flex: 1, minHeight: 0, p: 2 }}>
        <SplitStreamLayout
          plan={targetUserId ? (
            <ProcedurePanel
              title={selectedUser ? `${selectedUser.FullName} 様 (Plan)` : '支援手順 (Plan)'}
              schedule={schedule}
              isAcknowledged={isAcknowledged}
              onAcknowledged={() => setIsAcknowledged(true)}
              onEdit={handleEditorOpen}
            />
          ) : (
            <ProcedurePanel title="支援手順 (Plan)">
              <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 320, textAlign: 'center' }}>
                <Typography variant="body1" fontWeight="bold">
                  支援対象者を選択して時間割を表示
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  左列には ProcedureStore から読み込んだ時間ごとのスケジュールが表示されます。
                  対象者を選ぶとスクロールで Plan を確認できます。
                </Typography>
              </Stack>
            </ProcedurePanel>
          )}
          record={
            <RecordPanel
              title="行動記録 (Do)"
              lockState={recordLockState}
              onSubmit={handleRecordSubmit}
              schedule={schedule}
            />
          }
        />
      </Box>

      {targetUserId && (
        <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'common.white' }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              直近の行動記録
            </Typography>
            <Chip label={`${recentObservations.length}件`} size="small" />
            {selectedUser && (
              <Typography variant="body2" color="text.secondary">
                {selectedUser.FullName}
              </Typography>
            )}
          </Box>
          {recentObservations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              記録はまだありません。Planを確認してから記録を開始してください。
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {recentObservations.slice(0, 5).map((observation) => (
                <Box key={observation.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>
                    {new Date(observation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  <Chip
                    label={`${observation.behavior} / Lv.${observation.intensity}`}
                    color={observation.intensity >= 4 ? 'error' : observation.intensity >= 3 ? 'warning' : 'success'}
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    A: {observation.antecedent ?? '―'} / C: {observation.consequence ?? '―'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <ProcedureEditor
        open={isEditOpen}
        initialItems={schedule}
        onClose={handleEditorClose}
        onSave={handleProcedureSave}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          行動記録を保存しました
        </Alert>
      </Snackbar>
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default TimeBasedSupportRecordPage;
