import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Paper, 
  Typography, 
  Breadcrumbs, 
  Link,
  CircularProgress,
  Alert
} from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { MonitoringMeetingForm } from '@/features/monitoring/components/MonitoringMeetingForm';
import { useMonitoringMeetingForm } from '@/features/monitoring/hooks/useMonitoringMeetingForm';
import { useMonitoringMeetingRepository } from '@/features/monitoring/data/useMonitoringMeetingRepository';
import { usePlanningSheetList } from '@/features/monitoring/hooks/usePlanningSheetList';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import { usePlanPatchRepository } from '@/features/planning-sheet/hooks/usePlanPatchRepository';
import { useImprovementOutcomeRepository } from '@/features/monitoring/data/useImprovementOutcomeRepository';
import { useAuth } from '@/auth/useAuth';
import { useUser } from '@/features/users/useUsers';
import { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';
import { generatePlanPatch } from '@/domain/isp/planPatch';
import { DEFAULT_METRIC_DEFINITIONS, getMetricDefinition } from '@/domain/isp/metricDefinition';
import { evaluateImprovement } from '@/domain/isp/improvementOutcome';
import { safeRandomUUID } from '@/lib/uuid';
import type { ImprovementInput } from '@/features/monitoring/components/MonitoringMeetingForm';

export default function MonitoringMeetingRecordPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const repository = useMonitoringMeetingRepository();
  const planningSheetRepository = usePlanningSheetRepositories();
  const planPatchRepository = usePlanPatchRepository();
  const improvementOutcomeRepository = useImprovementOutcomeRepository();
  const { account } = useAuth();
  
  // 利用主情報の取得
  const { data: userMaster, status: userStatus } = useUser(userId);
  
  // 支援計画シートの取得 (L2 計画シート一覧)
  const { records: planningSheets, isLoading: isLoadingSheets } = usePlanningSheetList(userId || '');
  
  // フォームフック
  const { draft, update } = useMonitoringMeetingForm({
    userId: userId || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patchOptions, setPatchOptions] = useState<{ id: string; label: string }[]>([]);
  const [improvementInput, setImprovementInput] = useState<ImprovementInput>({
    patchId: '',
    metricId: '',
    beforeValue: '',
    afterValue: '',
    confidence: 'medium',
  });

  // 初回ロード時に利用者名をセット
  useEffect(() => {
    if (userMaster?.FullName && !draft.userName) {
      update({ userName: userMaster.FullName });
    }
  }, [userMaster, draft.userName, update]);

  useEffect(() => {
    const planningSheetId = draft.planningSheetId;
    if (!planningSheetId) {
      setPatchOptions([]);
      setImprovementInput((prev) => ({ ...prev, patchId: '' }));
      return;
    }

    let active = true;
    void planPatchRepository.findByPlanningSheetId(planningSheetId).then((patches) => {
      if (!active) return;
      const options = patches
        .filter((patch) => patch.status === 'confirmed')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((patch) => ({
          id: patch.id,
          label: `${patch.target === 'plan' ? '計画' : '手順'} / ${patch.updatedAt.slice(0, 10)} / ${patch.reason.split('\n')[0]}`,
        }));
      setPatchOptions(options);
      setImprovementInput((prev) => (
        options.some((option) => option.id === prev.patchId)
          ? prev
          : { ...prev, patchId: '' }
      ));
    });

    return () => {
      active = false;
    };
  }, [draft.planningSheetId, planPatchRepository]);

  // 利用者名の表示用
  const dispUserName = userMaster?.FullName || `利用者 ${userId}` || '未選択'; 

  const isImprovementInputEmpty =
    !improvementInput.patchId &&
    !improvementInput.metricId &&
    improvementInput.beforeValue === '' &&
    improvementInput.afterValue === '';

  const isImprovementInputComplete =
    !!improvementInput.patchId &&
    !!improvementInput.metricId &&
    improvementInput.beforeValue !== '' &&
    improvementInput.afterValue !== '';

  const handleSave = async (isFinalizing: boolean = false) => {
    if (!draft.discussionSummary) {
      setError('会議での検討内容は必須項目です。');
      return;
    }

    if (isFinalizing && !window.confirm('会議記録を確定します。確定後は編集できません。よろしいですか？')) {
      return;
    }

    if (!isImprovementInputEmpty && !isImprovementInputComplete) {
      setError('改善評価を入力する場合は、対象更新案・対象指標・before・after をすべて入力してください。');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let dataToSave = { ...draft };
      if (isFinalizing) {
        dataToSave = {
          ...dataToSave,
          status: 'finalized',
          finalizedAt: new Date().toISOString(),
          finalizedBy: account?.name ?? '不明',
        };
      }
      
      // 保存時に最新の利用者名を念のためセット
      if (userMaster?.FullName) {
        dataToSave.userName = userMaster.FullName;
      }
      
      const savedMeeting = await repository.save(dataToSave as unknown as MonitoringMeetingRecord);

      if (isFinalizing && isImprovementInputComplete && savedMeeting.planningSheetId) {
        const metric = getMetricDefinition(improvementInput.metricId);
        if (!metric) {
          throw new Error('改善評価の対象指標が不正です。');
        }

        const result = evaluateImprovement({
          before: Number(improvementInput.beforeValue),
          after: Number(improvementInput.afterValue),
          direction: metric.direction,
        });

        await improvementOutcomeRepository.save({
          id: `outcome-${safeRandomUUID()}`,
          planningSheetId: savedMeeting.planningSheetId,
          patchId: improvementInput.patchId,
          observedAt: savedMeeting.meetingDate,
          targetMetric: metric.id,
          source: 'manual_kpi',
          metricDefinitionId: metric.id,
          beforeValue: Number(improvementInput.beforeValue),
          afterValue: Number(improvementInput.afterValue),
          changeRate: result.changeRate,
          isImproved: result.isImproved,
          confidence: improvementInput.confidence,
          createdAt: new Date().toISOString(),
        });
      }

      if (
        isFinalizing &&
        savedMeeting.planningSheetId &&
        savedMeeting.planChangeDecision !== 'no_change'
      ) {
        const currentPlan = await planningSheetRepository.getById(savedMeeting.planningSheetId);
        if (currentPlan) {
          const patch = generatePlanPatch(savedMeeting, currentPlan);
          if (patch) {
            await planPatchRepository.save(patch);
          }
        }
      }

      navigate(-1);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSheets || userStatus === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
          <Link underline="hover" color="inherit" onClick={() => navigate('/support-plan-guide')} sx={{ cursor: 'pointer' }}>
            個別支援計画記録
          </Link>
          <Typography color="text.primary">モニタリング会議記録</Typography>
        </Breadcrumbs>
        <Typography variant="h4" sx={{ mt: 2, fontWeight: 'bold' }}>
          モニタリング会議記録：{dispUserName}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper elevation={0} sx={{ p: 0, bgcolor: 'transparent' }}>
        <MonitoringMeetingForm
          draft={draft}
          onUpdate={update}
          onSave={() => handleSave(false)}
          onFinalize={() => handleSave(true)}
          onCancel={() => navigate(-1)}
          isSaving={isSaving}
          planningSheets={planningSheets.map(s => ({ 
            id: s.id, 
            title: `${s.title} (${s.reviewedAt || '日付不明'})` 
          }))}
          patchOptions={patchOptions}
          metricDefinitions={DEFAULT_METRIC_DEFINITIONS}
          improvementInput={improvementInput}
          onImprovementInputChange={(patch) => setImprovementInput((prev) => ({ ...prev, ...patch }))}
        />
      </Paper>
    </Container>
  );
}
