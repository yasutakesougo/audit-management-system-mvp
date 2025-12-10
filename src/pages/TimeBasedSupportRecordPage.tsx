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
import type { ChipProps } from '@mui/material/Chip';
import Container from '@mui/material/Container';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Snackbar from '@mui/material/Snackbar';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const TimeBasedSupportRecordPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [selectedRecordDate, setSelectedRecordDate] = useState<string>(() => {
    const fromQuery = searchParams.get('recordDate');
    const parsed = fromQuery ? new Date(fromQuery) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [targetUserId, setTargetUserId] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const pdcaTitle = searchParams.get('pdcaTitle') ?? '';
  const pdcaPhase = searchParams.get('pdcaPhase') ?? '';
  const pdcaPhaseLabel = useMemo(() => {
    if (!pdcaPhase) return '';
    const labelMap: Record<string, string> = {
      PLAN: 'PLAN（計画）',
      DO: 'DO（実行）',
      CHECK: 'CHECK（評価）',
      ACT: 'ACT（改善）',
    };
    return labelMap[pdcaPhase] ?? pdcaPhase;
  }, [pdcaPhase]);
  const pdcaPhaseChipColor = useMemo<ChipProps['color']>(() => {
    const colorMap: Record<string, ChipProps['color']> = {
      PLAN: 'primary',
      DO: 'success',
      CHECK: 'warning',
      ACT: 'secondary',
    };
    return colorMap[pdcaPhase] ?? 'default';
  }, [pdcaPhase]);
  const { add, data: behaviorRecords, fetchByUser } = useBehaviorStore();
  const { getByUser, save } = useProcedureStore();
  const { data: users } = useUsersDemo();
  const selectedUser = useMemo(() => users.find((user) => user.UserID === targetUserId), [users, targetUserId]);
  const schedule = useMemo(() => {
    if (!targetUserId) return [];
    return getByUser(targetUserId);
  }, [getByUser, targetUserId]);
  const recordLockState = useMemo<RecordPanelLockState>(() => {
    if (!targetUserId) return 'no-user';
    return isAcknowledged ? 'unlocked' : 'unconfirmed';
  }, [targetUserId, isAcknowledged]);

  const recordDateLabel = useMemo(() => {
    if (!selectedRecordDate) return '';
    const parsed = new Date(selectedRecordDate);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });
  }, [selectedRecordDate]);

  const selectedRecordDateObj = useMemo(() => {
    if (!selectedRecordDate) return null;
    const parsed = new Date(selectedRecordDate);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }, [selectedRecordDate]);

  const isSameDay = useCallback((timestamp: string | Date) => {
    if (!selectedRecordDateObj) return true;
    const d = timestamp instanceof Date ? new Date(timestamp) : new Date(timestamp);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() === selectedRecordDateObj.getTime();
  }, [selectedRecordDateObj]);

  const recentObservations = useMemo(
    () => behaviorRecords.filter((behavior) => behavior.userId === targetUserId && isSameDay(behavior.timestamp)),
    [behaviorRecords, targetUserId, isSameDay],
  );

  useEffect(() => {
    if (!targetUserId) return;
    fetchByUser(targetUserId, selectedRecordDate);
  }, [fetchByUser, targetUserId, selectedRecordDate]);

  const handleRecordSubmit = useCallback(async (payload: Omit<BehaviorObservation, 'id' | 'userId'>) => {
    if (!targetUserId) return;
    const now = new Date();
    const baseTime = payload.timestamp ? new Date(payload.timestamp as unknown as string) : now;

    let merged = baseTime;
    if (selectedRecordDate) {
      const dateBase = new Date(selectedRecordDate);
      if (!Number.isNaN(dateBase.getTime())) {
        merged = new Date(dateBase);
        merged.setHours(
          baseTime.getHours(),
          baseTime.getMinutes(),
          baseTime.getSeconds(),
          baseTime.getMilliseconds(),
        );
      }
    }

    await add({
      ...payload,
      userId: targetUserId,
      timestamp: merged.toISOString(),
    });
    setSnackbarOpen(true);
  }, [add, targetUserId, selectedRecordDate]);

  const handleUserChange = useCallback((event: SelectChangeEvent<string>) => {
    const nextUserId = event.target.value;
    setTargetUserId(nextUserId);
    const nextParams = new URLSearchParams(searchParams);
    if (nextUserId) {
      nextParams.set('user', nextUserId);
    } else {
      nextParams.delete('user');
    }
    setSearchParams(nextParams, { replace: true });
    setIsAcknowledged(false);
  }, [searchParams, setSearchParams]);

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

  const handleRecordDateChange = useCallback((nextValue: string) => {
    const parsed = nextValue ? new Date(nextValue) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return;
    const normalized = parsed.toISOString().slice(0, 10);
    setSelectedRecordDate(normalized);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('recordDate', normalized);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const userFromQuery = searchParams.get('user');
    if (userFromQuery && userFromQuery !== targetUserId) {
      setTargetUserId(userFromQuery);
      setIsAcknowledged(false);
    }
  }, [searchParams, targetUserId]);

  useEffect(() => {
    const recordDateFromQuery = searchParams.get('recordDate');
    if (!recordDateFromQuery) return;
    const parsed = new Date(recordDateFromQuery);
    if (Number.isNaN(parsed.getTime())) return;
    const normalized = parsed.toISOString().slice(0, 10);
    if (normalized !== selectedRecordDate) {
      setSelectedRecordDate(normalized);
    }
  }, [searchParams, selectedRecordDate]);

  return (
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

        <Stack direction="row" spacing={1.5} alignItems="center">
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

          <TextField
            label="記録日"
            type="date"
            size="small"
            value={selectedRecordDate}
            onChange={(e) => handleRecordDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'data-testid': 'iceberg-support-record-date' }}
          />
        </Stack>
      </Paper>

      {(targetUserId || recordDateLabel) && (
        <Paper
          elevation={1}
          sx={{
            mx: 2,
            mb: 1,
            px: 2,
            py: 1.5,
            borderLeft: (theme) => `4px solid ${theme.palette.info.main}`,
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(33, 150, 243, 0.08)'
                : 'rgba(33, 150, 243, 0.04)',
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              今見ているコンテキスト
            </Typography>
            <Typography variant="body2">
              {targetUserId && <>{selectedUser?.FullName ?? '利用者'} さん</>}
              {targetUserId && recordDateLabel && ' ／ '}
              {recordDateLabel && <>{recordDateLabel} の日次支援手順記録</>}
            </Typography>
            {(pdcaTitle || pdcaPhaseLabel) && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip label="PDCA連携" size="small" color="info" variant="outlined" data-testid="pdca-context-chip" />
                {pdcaTitle && (
                  <Chip
                    label={pdcaTitle}
                    size="small"
                    color="primary"
                    variant="outlined"
                    data-testid="pdca-title-chip"
                  />
                )}
                {pdcaPhaseLabel && (
                  <Chip
                    label={`フェーズ: ${pdcaPhaseLabel}`}
                    size="small"
                    color={pdcaPhaseChipColor}
                    variant="filled"
                    data-testid="pdca-phase-chip"
                  />
                )}
              </Stack>
            )}
            <Typography variant="caption" color="text.secondary">
              ※ 氷山 PDCA からの遷移時に文脈を保持します
            </Typography>
          </Stack>
        </Paper>
      )}

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
              {recentObservations.slice(0, 5).map((observation: BehaviorObservation) => (
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
  );
};

export default TimeBasedSupportRecordPage;
