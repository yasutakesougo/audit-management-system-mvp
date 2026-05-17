import { useTransportAssignmentPage } from './transport-assignment/hooks/useTransportAssignmentPage';
import { resolveTransportVehicleName } from '@/features/today/transport/transportVehicleNames';
import { emitTelemetry } from '@/lib/telemetry';
import type { ConcurrencyConflictInsight } from '@/features/transport-assignments/application/transportAssignmentApplication';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DirectionsBusRoundedIcon from '@mui/icons-material/DirectionsBusRounded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { TransportAssignmentControlSection } from './transport-assignment/TransportAssignmentControlSection';
import { TransportAssignmentVehicleSection } from './transport-assignment/TransportAssignmentVehicleSection';
import { TransportConcurrencyInsightBanner } from './transport-assignment/TransportConcurrencyInsightBanner';

export default function TransportAssignmentPage() {
  const {
    targetDate,
    direction,
    setDirection,
    setTargetDate,
    weekRangeLabel,
    weekDateOptions,
    hasWeekdayDefaultSuggestion,
    saveStatus,
    dirty,
    lastSavedAt,
    effectivePayloadCount,
    canSave,
    onTargetDateChange,
    onChangeWeek,
    onApplyWeekdayDefault,
    onApplyWeekBulkDefault,
    onRefresh,
    onSave,
    weekBulkApplyState,
    weekBulkSummaryLabel,
    coordinationInsights,
    saveError,
    isLoading,
    currentDraft,
    persistedAssignments,
    concurrencyConflicts,
    allowConcurrencyBypass,
    setAllowConcurrencyBypass,
    setPersistedSnapshot,
    refetchSchedules,
    refetchAssignments,
    assignmentDiffs,
    vehicleNameOverrides,
    userNameById,
    staffOptions,
    pendingAssignByVehicle,
    vehicleNameDraftByVehicle,
    onVehicleNameDraftChange,
    onVehicleNameCommit,
    onCourseChange,
    onDriverChange,
    onAttendantChange,
    onPendingAssignChange,
    onAssignUser,
    onRemoveUser,
  } = useTransportAssignmentPage();

  return (
    <Container maxWidth="lg" sx={{ py: 3 }} data-testid="transport-assignment-page">
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <DirectionsBusRoundedIcon color="primary" />
          <Typography variant="h4" component="h1">
            送迎配車表
          </Typography>
        </Stack>
        <Button
          component={RouterLink}
          to="/today"
          startIcon={<ArrowBackRoundedIcon />}
          variant="outlined"
          data-testid="transport-assignment-back-today"
        >
          今日の業務へ戻る
        </Button>
      </Stack>
      
      <TransportConcurrencyInsightBanner />

      <TransportAssignmentControlSection
        targetDate={targetDate}
        direction={direction}
        weekRangeLabel={weekRangeLabel}
        weekDateOptions={weekDateOptions}
        hasWeekdayDefaultSuggestion={hasWeekdayDefaultSuggestion}
        saveStatus={saveStatus}
        dirty={dirty}
        lastSavedAt={lastSavedAt}
        effectivePayloadCount={effectivePayloadCount}
        canSave={canSave}
        onTargetDateChange={onTargetDateChange}
        onChangeWeek={onChangeWeek}
        onDirectionChange={setDirection}
        onWeekdayChange={setTargetDate}
        onApplyWeekdayDefault={onApplyWeekdayDefault}
        onApplyWeekBulkDefault={onApplyWeekBulkDefault}
        onRefresh={onRefresh}
        onSave={onSave}
      />

      {weekBulkApplyState ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="transport-assignment-week-bulk-summary">
          今週一括適用の結果: {weekBulkSummaryLabel}
        </Alert>
      ) : null}

      {saveStatus === 'success' ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="transport-assignment-save-success">
          配車設定を保存しました。
        </Alert>
      ) : null}

      {saveStatus === 'error' ? (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="transport-assignment-save-error">
          配車設定の保存に失敗しました。時間をおいて再試行してください。
          {saveError instanceof Error ? ` (${saveError.message})` : ''}
        </Alert>
      ) : null}

      {coordinationInsights.map((insight, idx) => (
        <Alert 
          key={idx} 
          severity={insight.severity} 
          sx={{ mb: 2 }} 
          data-testid={`transport-assignment-insight-${insight.type}`}
        >
          {insight.message}
        </Alert>
      ))}

      {isLoading ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              配車データを読み込み中...
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {currentDraft.users.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          対象日・方向に該当する送迎予定がありません。
        </Alert>
      ) : null}

      {/* Proof of Wiring: Show count of persisted assignments from the repository path */}
      {!isLoading && persistedAssignments.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, textAlign: 'right' }}>
          同期済みドメイン情報: {persistedAssignments.length} 件の割り当てを読込中 (Repository経由)
        </Typography>
      )}

      {/* Concurrency Conflict Warning */}
      {concurrencyConflicts.length > 0 && (
        <Alert 
          severity="error" 
          variant="filled"
          sx={{ mb: 2 }}
          data-testid="concurrency-conflict-alert"
          action={
            <Button color="inherit" size="small" data-testid="concurrency-reload-button" onClick={() => {
              emitTelemetry('assignment:refetch_after_conflict', {
                targetDate,
                direction,
                conflictCount: concurrencyConflicts.length,
              });
              setPersistedSnapshot(null); // Clear snapshot to reset warning
              refetchSchedules();
              refetchAssignments();
            }}>
              最新を読み込む
            </Button>
          }
        >
          <Typography variant="subtitle2">注意: 外部でデータが更新されました</Typography>
          次の車両の情報が他のユーザーによって変更された可能性があります: 
          {concurrencyConflicts.map((c: ConcurrencyConflictInsight) => c.vehicleName).join(', ')}
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Checkbox 
                  size="small" 
                  checked={allowConcurrencyBypass}
                  onChange={(e) => setAllowConcurrencyBypass(e.target.checked)}
                  data-testid="concurrency-bypass-checkbox"
                />
              }
              label={<Typography variant="caption">リスクを理解した上で、このまま保存することを許可する</Typography>}
            />
          </Box>
        </Alert>
      )}

      {/* Changes Summary Section */}
      {dirty && assignmentDiffs.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>未保存の変更内容:</Typography>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {assignmentDiffs.map((diff) => (
              <li key={diff.vehicleId}>
                <strong>{resolveTransportVehicleName(diff.vehicleId, vehicleNameOverrides)}</strong>: 
                {diff.type === 'added' && ' 新規追加'}
                {diff.type === 'removed' && ' 削除'}
                {diff.type === 'modified' && (
                  <>
                    変更あり 
                    {diff.userChanges && (
                      <span style={{ fontSize: '0.85em', marginLeft: '8px' }}>
                        ({diff.userChanges.added.length}名追加 / {diff.userChanges.removed.length}名解除)
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <TransportAssignmentVehicleSection
        currentDraft={currentDraft}
        saveStatus={saveStatus}
        userNameById={userNameById}
        staffOptions={staffOptions}
        pendingAssignByVehicle={pendingAssignByVehicle}
        vehicleNameOverrides={vehicleNameOverrides}
        vehicleNameDraftByVehicle={vehicleNameDraftByVehicle}
        onVehicleNameDraftChange={onVehicleNameDraftChange}
        onVehicleNameCommit={onVehicleNameCommit}
        onCourseChange={onCourseChange}
        onDriverChange={onDriverChange}
        onAttendantChange={onAttendantChange}
        onPendingAssignChange={onPendingAssignChange}
        onAssignUser={onAssignUser}
        onRemoveUser={onRemoveUser}
      />
    </Container>
  );
}
