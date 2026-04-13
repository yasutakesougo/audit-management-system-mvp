import { buildIcebergPdcaUrl } from '@/app/links/navigationLinks';
import { generateDailyReport, getScheduleKey, toBipOptions } from '@/features/daily';
import { useInterventionStore } from '@/features/analysis/stores/interventionStore';
import { FullScreenDailyDialogPage } from '@/features/daily/components/pages/FullScreenDailyDialogPage';
import { MonitoringCountdown } from '@/features/daily/components/sections/MonitoringCountdown';
import { ProcedureEditor } from '@/features/daily/components/procedure/ProcedureEditor';
import { RecentRecordsDialog } from '@/features/daily/components/split-stream/RecentRecordsDialog';
import { PlanSelectionStep } from '@/features/daily/components/wizard/PlanSelectionStep';
import { RecordInputStep } from '@/features/daily/components/wizard/RecordInputStep';
import { UserSelectionStep } from '@/features/daily/components/wizard/UserSelectionStep';
import { useBehaviorData } from '@/features/daily/hooks/legacy/useBehaviorData';
import { useDailySupportUserFilter } from '@/features/daily/hooks/legacy/useDailySupportUserFilter';
import { useExecutionData } from '@/features/daily/hooks/legacy/useExecutionData';
import { useProcedureData } from '@/features/daily/hooks/legacy/useProcedureData';
import { useSupportWizard } from '@/features/daily/hooks/legacy/useSupportWizard';
import type { ProcedureItem } from '@/features/daily/hooks/legacy-stores/procedureStore';
import { useUsers } from '@/features/users/useUsers';
import { useIbdPageGuard } from '@/features/daily/hooks/useIbdPageGuard';
import { useSupportRecordSubmit } from '@/pages/hooks/useSupportRecordSubmit';
import { useTimeBasedSupportRecordPage } from '@/pages/hooks/useTimeBasedSupportRecordPage';
import { usePlanningSheetToProcedureBridge } from '@/features/planning-sheet/hooks/usePlanningSheetToProcedureBridge';
import { CircularProgress } from '@mui/material';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const TimeBasedSupportRecordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const initialSearchParams = useRef(new URLSearchParams(location.search)).current;
  const initialDateParam = initialSearchParams.get('date');
  const initialRecordDate =
    initialDateParam && /^\d{4}-\d{2}-\d{2}$/.test(initialDateParam)
      ? new Date(`${initialDateParam}T00:00:00`)
      : new Date();
  const initialParams = useRef({
    userId: initialSearchParams.get('userId') ?? initialSearchParams.get('user') ?? undefined,
    stepKey: initialSearchParams.get('step') ?? undefined,
    unfilledOnly: initialSearchParams.get('unfilled') === '1',
    /** 支援計画シートから遷移した場合の planningSheetId（Phase E 導線） */
    planningSheetId: initialSearchParams.get('planningSheetId') ?? undefined,
  }).current;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [recentRecordsOpen, setRecentRecordsOpen] = useState(false);
  const recordDate = useMemo(() => initialRecordDate, [initialRecordDate]);
  const targetDate = useMemo(() => recordDate.toISOString().slice(0, 10), [recordDate]);

  // ── Data hooks (same as before) ──
  const procedureRepo = useProcedureData();
  const { repo: behaviorRepo, data: behaviorRecords, error: behaviorError, clearError } = useBehaviorData();
  const { data: users, status: usersStatus } = useUsers();

  // ── IBD ページガード: 非対象利用者を /daily/table へリダイレクト ──
  const ibdGuard = useIbdPageGuard(
    initialParams.userId,
    users,
    usersStatus === 'success',
  );

  const { filter, updateFilter, resetFilter, filteredUsers, hasActiveFilter } = useDailySupportUserFilter(users);
  const interventionStore = useInterventionStore();
  const executionStore = useExecutionData();

  // ── Wizard state ──
  const wizard = useSupportWizard(initialParams.userId, initialParams.stepKey);

  // ── Phase E: 支援計画シートからの手順取得 ──
  const { 
    schedule: overrideSchedule, 
    isLoading: isSheetLoading,
    error: sheetError,
    bridgeSource
  } = usePlanningSheetToProcedureBridge(initialParams.planningSheetId);

  // ── Core record page hook (uses wizard's userId) ──
  const {
    targetUserId,
    handleUserChange,
    schedule,
    filledStepIds,
    recentObservations,
    isAcknowledged,
    setIsAcknowledged,
    selectedStepId: _selectedStepId,
    setSelectedStepId,
    scrollToStepId: _scrollToStepId,
    showUnfilledOnly,
    setShowUnfilledOnly,
    recordLockState,
    totalSteps,
    unfilledStepsCount,
    selectableStateByStepId,
    hiddenStepOrders,
    handleAfterSubmit,
    verifySaveConflict,
  } = useTimeBasedSupportRecordPage({
    procedureRepo,
    behaviorRepo,
    behaviorRecords,
    initialUserId: wizard.wizardUserId || initialParams.userId,
    initialStepKey: wizard.wizardSlotId || initialParams.stepKey,
    initialUnfilledOnly: initialParams.unfilledOnly,
    overrideSchedule,
  });

  // ── Submit logic ──
  const {
    snackbarOpen,
    snackbarMessage,
    submitError,
    retryPersist,
    handleRecordSubmit,
    handleRetryPersist,
    handleSnackbarClose,
    setSubmitError,
  } = useSupportRecordSubmit({
    behaviorRepo,
    executionStore,
    targetUserId: wizard.wizardUserId || targetUserId,
    targetDate,
    totalSteps,
    unfilledStepsCount,
  });

  // ── Derived data ──
  const selectedUser = useMemo(
    () => users.find((user) => user.UserID === (wizard.wizardUserId || targetUserId)),
    [users, wizard.wizardUserId, targetUserId],
  );

  const userInterventionPlans = useMemo(
    () => {
      const uid = wizard.wizardUserId || targetUserId;
      return uid ? interventionStore.getByUserId(uid) : [];
    },
    [interventionStore, wizard.wizardUserId, targetUserId],
  );

  const bipOptions = useMemo(() => toBipOptions(userInterventionPlans), [userInterventionPlans]);


  // Error display
  const rawError = submitError ?? behaviorError;
  const displayedError = useMemo(() => {
    if (!rawError) return null;
    if (String(rawError).includes('DailyActivityRecords')) return null;
    return rawError;
  }, [rawError]);

  // ── Wizard event handlers ──

  const handleWizardSelectUser = useCallback((userId: string) => {
    wizard.selectUserAndProceed(userId);
    handleUserChange(userId);
  }, [wizard, handleUserChange]);

  const handleWizardSelectSlot = useCallback((stepId: string) => {
    wizard.selectPlanAndProceed(stepId);
    setSelectedStepId(stepId);
    setIsAcknowledged(true);
  }, [wizard, setSelectedStepId, setIsAcknowledged]);

  const handleWizardAfterSubmit = useCallback((slotKey: string | null) => {
    handleAfterSubmit(slotKey);
    wizard.returnToPlanAfterSave();
  }, [handleAfterSubmit, wizard]);

  /** Plan → User: wizard + core の両方の userId をクリア */
  const handleWizardBackToUser = useCallback(() => {
    wizard.goToStep('user');
    handleUserChange('');  // core フックの targetUserId もクリア
  }, [wizard, handleUserChange]);

  /** Record → Plan: wizard の slotId をクリア（userId は維持） */
  const handleWizardBackToPlan = useCallback(() => {
    wizard.goToStep('plan');
  }, [wizard]);

  const handleRecordSubmitWrapper = useCallback(
    async (data: Parameters<typeof handleRecordSubmit>[0]) => {
      // ── 保存前ガードレール ──
      const ok = await verifySaveConflict();
      if (!ok) return;

      await handleRecordSubmit(data);
    },
    [handleRecordSubmit, verifySaveConflict],
  );

  const handleProcedureSave = useCallback((items: ProcedureItem[]) => {
    const uid = wizard.wizardUserId || targetUserId;
    if (!uid) return;
    procedureRepo.save(uid, items);
  }, [procedureRepo, wizard.wizardUserId, targetUserId]);

  const handleErrorClose = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('daily-support-submit-error');
    }
    clearError();
    setSubmitError(null);
  }, [clearError, setSubmitError]);

  const _handleCopyReport = useCallback(async () => {
    const uid = wizard.wizardUserId || targetUserId;
    if (!uid || !selectedUser) return;
    const records = await executionStore.getRecords(targetDate, uid);
    const report = generateDailyReport({
      date: targetDate,
      userName: selectedUser.FullName,
      schedule,
      records,
      observations: (() => {
        const m = new Map<string, string>();
        recentObservations.forEach((o) => {
          if (o.planSlotKey && o.actualObservation) m.set(o.planSlotKey, o.actualObservation);
        });
        return m;
      })(),
    });

    try {
      await navigator.clipboard.writeText(report);
    } catch {
      // Fallback handled by snackbar
    }
  }, [executionStore, schedule, selectedUser, targetDate, wizard.wizardUserId, targetUserId, recentObservations]);

  // URL sync
  React.useEffect(() => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      const uid = wizard.wizardUserId || targetUserId;
      if (uid) {
        nextParams.set('user', uid);
        nextParams.set('userId', uid);
      } else {
        nextParams.delete('user');
        nextParams.delete('userId');
      }
      if (wizard.wizardSlotId) {
        nextParams.set('step', wizard.wizardSlotId);
      } else {
        nextParams.delete('step');
      }
      nextParams.set('wizard', wizard.step);
      if (nextParams.toString() === prev.toString()) return prev;
      return nextParams;
    }, { replace: true });
  }, [wizard.step, wizard.wizardUserId, wizard.wizardSlotId, targetUserId, setSearchParams]);

  // IBDガード: リダイレクト中はレンダリングしない
  if (ibdGuard === 'redirecting') return null;

  // シート情報読み込み待ち（Phase E 導線時のみ）
  if (initialParams.planningSheetId && isSheetLoading) {
    return (
      <FullScreenDailyDialogPage title="支援手順の読み込み中..." backTo="/today">
        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </FullScreenDailyDialogPage>
    );
  }

  const renderPlanningError = () => {
    // 1. 取得エラー時
    if (sheetError) {
      return (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="warning" sx={{ mb: 0 }}>
            支援計画シート「{initialParams.planningSheetId}」の取得に失敗しました。
            既定の手順を表示します。（エラー: {sheetError}）
          </Alert>
        </Box>
      );
    }

    // 2. 計画書は取得できたが、手順が空の場合（未設計など）
    if (initialParams.planningSheetId && bridgeSource === 'empty') {
      return (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="info" sx={{ mb: 0 }}>
            指定された支援計画シートに実施手順が設定されていません。
            既定の手順（リポジトリ）を表示します。
          </Alert>
        </Box>
      );
    }

    return null;
  };

  return (
    <FullScreenDailyDialogPage
      title="支援手順の実施（行動観察）"
      backTo="/today"
      testId="daily-support-page"
      headerActions={
        <React.Fragment>
          <MonitoringCountdown
            userName={selectedUser?.FullName}
            lastAssessmentDate={selectedUser?.LastAssessmentDate}
          />
          {initialParams.planningSheetId && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate(`/support-planning-sheet/${initialParams.planningSheetId}`)}
              sx={{ ml: 1, whiteSpace: 'nowrap' }}
            >
              元シートへ
            </Button>
          )}
        </React.Fragment>
      }
    >
      <Container
        maxWidth="xl"
        disableGutters
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
        }}
        data-testid="iceberg-time-based-support-record-page"
      >
        {/* Error Alert */}
        {displayedError ? (
          <Box
            sx={{
              position: 'fixed',
              top: 12,
              left: 12,
              right: 12,
              zIndex: (theme) => theme.zIndex.modal + 3,
            }}
          >
            <Alert severity="error" onClose={handleErrorClose}>
              {String(displayedError)}
            </Alert>
          </Box>
        ) : null}

        {/* ── Stepper (Record ステップでは非表示 → 入力スペース確保) ── */}
        {wizard.step !== 'record' && (
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Stepper activeStep={wizard.stepIndex} alternativeLabel>
              {wizard.stepLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* ── Step Content ── */}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {renderPlanningError()}
          {wizard.step === 'user' && (
            <UserSelectionStep
              filteredUsers={filteredUsers}
              allUsersCount={users.length}
              filter={filter}
              hasActiveFilter={hasActiveFilter}
              onUpdateFilter={updateFilter}
              onResetFilter={resetFilter}
              onSelectUser={handleWizardSelectUser}
            />
          )}

          {wizard.step === 'plan' && (
            <PlanSelectionStep
              userName={selectedUser?.FullName ?? ''}
              schedule={schedule}
              filledStepIds={filledStepIds}
              showUnfilledOnly={showUnfilledOnly}
              onToggleUnfilledOnly={() => setShowUnfilledOnly((prev) => !prev)}
              unfilledCount={unfilledStepsCount}
              totalCount={totalSteps}
              interventionPlans={userInterventionPlans}
              onSelectSlot={handleWizardSelectSlot}
              onBack={handleWizardBackToUser}
              onIcebergAnalysis={
                (wizard.wizardUserId || targetUserId)
                  ? () => navigate(buildIcebergPdcaUrl(wizard.wizardUserId || targetUserId))
                  : undefined
              }
              userId={wizard.wizardUserId || targetUserId}
              lastAssessmentDate={selectedUser?.LastAssessmentDate}
              selectableStateByStepId={selectableStateByStepId}
              hiddenStepOrders={hiddenStepOrders}
              onAbcRecord={
                (wizard.wizardUserId || targetUserId)
                  ? () => {
                      const uid = wizard.wizardUserId || targetUserId;
                      const params = new URLSearchParams({
                        userId: uid,
                        source: 'daily-support',
                        date: recordDate.toISOString().slice(0, 10),
                      });
                      if (wizard.wizardSlotId) {
                        params.set('slotId', wizard.wizardSlotId);
                      }
                      // returnUrl: ABC記録後に支援手順の同じ位置へ戻れるようにする
                      const returnUrl = `/daily/support?wizard=plan&user=${encodeURIComponent(uid)}&userId=${encodeURIComponent(uid)}`;
                      params.set('returnUrl', returnUrl);
                      navigate(`/abc-record?${params.toString()}`);
                    }
                  : undefined
              }
            />
          )}

          {wizard.step === 'record' && (
            <RecordInputStep
              userName={selectedUser?.FullName ?? ''}
              selectedSlotKey={wizard.wizardSlotId}
              lockState={recordLockState}
              onSubmit={handleRecordSubmitWrapper}
              schedule={schedule}
              recordDate={recordDate}
              onSlotChange={handleWizardSelectSlot}
              onAfterSubmit={() => handleWizardAfterSubmit(wizard.wizardSlotId || null)}
              onBack={handleWizardBackToPlan}
              userId={wizard.wizardUserId || targetUserId}
              onAbcRecord={
                (wizard.wizardUserId || targetUserId)
                  ? () => {
                      const uid = wizard.wizardUserId || targetUserId;
                      const currentSlotId = wizard.wizardSlotId || '';
                      const params = new URLSearchParams({
                        userId: uid,
                        source: 'daily-support',
                        date: recordDate.toISOString().slice(0, 10),
                      });
                      if (currentSlotId) {
                        params.set('slotId', currentSlotId);
                      }
                      // returnUrl: Step 3 の同じスロットへ正確に戻る
                      const returnUrl = `/daily/support?wizard=record&user=${encodeURIComponent(uid)}&userId=${encodeURIComponent(uid)}&step=${encodeURIComponent(currentSlotId)}`;
                      params.set('returnUrl', returnUrl);

                      // MVP-5: スロットの活動名を ABC 記録の behavior 下書きとして渡す
                      const slotItem = schedule.find(s => getScheduleKey(s.time, s.activity) === currentSlotId);
                      const draftBehavior = slotItem
                        ? `${slotItem.time} ${slotItem.activity}の時間帯に問題行動あり`
                        : undefined;

                      navigate(`/abc-record?${params.toString()}`, {
                        state: { draftBehavior, draftSlotId: currentSlotId },
                      });
                    }
                  : undefined
              }
            />
          )}
        </Box>

        {/* Dialogs */}
        <RecentRecordsDialog
          open={recentRecordsOpen}
          onClose={() => setRecentRecordsOpen(false)}
          observations={recentObservations}
          userName={selectedUser?.FullName}
        />

        <ProcedureEditor
          open={isEditOpen}
          initialItems={schedule}
          onClose={() => setIsEditOpen(false)}
          onSave={handleProcedureSave}
          availablePlans={bipOptions}
        />

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
        <Snackbar
          open={Boolean(displayedError)}
          autoHideDuration={null}
          onClose={handleErrorClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
        >
          <Alert
            onClose={handleErrorClose}
            severity="error"
            sx={{ width: '100%' }}
            action={retryPersist ? (
              <Button color="inherit" size="small" onClick={handleRetryPersist}>
                再送
              </Button>
            ) : undefined}
          >
            {String(displayedError ?? '')}
          </Alert>
        </Snackbar>
      </Container>
    </FullScreenDailyDialogPage>
  );
};

export default TimeBasedSupportRecordPage;
