import React from 'react';
import { useNavigate } from 'react-router-dom';

import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import type { MonitoringToPlanningResult } from '@/features/planning-sheet/monitoringToPlanningBridge';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { useUsers } from '@/features/users/useUsers';
import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { tokuseiToPlanningBridge, type TokuseiBridgeResult } from '@/features/planning-sheet/tokuseiToPlanningBridge';
import { buildImportPreview } from '@/features/planning-sheet/buildImportPreview';
import type { ImportPreviewResult } from '@/features/planning-sheet/buildImportPreview';
import { useLatestBehaviorMonitoring } from '@/features/planning-sheet/hooks/useLatestBehaviorMonitoring';
import { useMonitoringMeetingRepository } from '@/features/monitoring/data/useMonitoringMeetingRepository';
import { useIcebergRepository } from '@/features/ibd/analysis/iceberg/SharePointIcebergRepository';
import { icebergToInterventionDrafts } from '@/features/ibd/analysis/iceberg/icebergToIntervention';
import { buildIcebergImportResult, type IcebergImportResult } from '@/features/planning-sheet/icebergToPlanningBridge';
import { useImportAuditStore } from '@/features/planning-sheet/stores/importAuditStore';
import { buildTokuseiImportAuditPayload } from '@/features/planning-sheet/tokuseiImportAuditBuilder';
import type { IcebergSession } from '@/features/ibd/analysis/iceberg/icebergTypes';
import { useMonitoringAbcEvidence } from '@/features/monitoring/hooks/useMonitoringAbcEvidence';

import type { NewPlanningSheetFormProps, UserOption, FormState } from '../types';
import { INITIAL_FORM, SAMPLE_FORM } from '../constants';
import { buildCreateInput } from '../helpers';

export const useNewPlanningSheetForm = (props: NewPlanningSheetFormProps) => {
  const {
    planningSheetRepo,
    ispRepo,
    initialUserId,
    initialSource,
    diffSummary,
  } = props;

  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { account } = useAuth();
  const { role } = useUserAuthz();
  const isAdmin = role === 'admin';

  // ── User selection state ──
  const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null);
  const [ispId, setIspId] = React.useState<string | null>(null);
  const [ispLoading, setIspLoading] = React.useState(false);
  const [ispWarning, setIspWarning] = React.useState<string | null>(null);

  // ── Form state ──
  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [activeStep, setActiveStep] = React.useState(0);

  // ── Save state ──
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // ── 特性アンケート読込 ──
  const { 
    responses: tokuseiResponses, 
    status: tokuseiStatus,
    refresh: refreshTokusei
  } = useTokuseiSurveyResponses();
  const [selectedTokusei, setSelectedTokusei] = React.useState<TokuseiSurveyResponse | null>(null);
  const [tokuseiImported, setTokuseiImported] = React.useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [tokuseiBridgeResult, setTokuseiBridgeResult] = React.useState<TokuseiBridgeResult | null>(null);
  const [lastBridgeResult, setLastBridgeResult] = React.useState<{ formPatches: Record<string, string> } | null>(null);
  const [tokuseiProvenance] = React.useState<Map<string, { name: string; relation?: string; fillDate?: string }>>(new Map());
  const [importPreview, setImportPreview] = React.useState<ImportPreviewResult | null>(null);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' }>({
    open: false, message: '', severity: 'success',
  });

  // ── 氷山分析読込 ──
  const icebergRepo = useIcebergRepository();
  const [icebergImported, setIcebergImported] = React.useState(false);
  const [icebergImportResult, setIcebergImportResult] = React.useState<IcebergImportResult | null>(null);
  const [isIcebergLoading, setIsIcebergLoading] = React.useState(false);
  const [importSource, setImportSource] = React.useState<'tokusei' | 'iceberg' | null>(null);
  const autoIcebergHandledRef = React.useRef(false);

  // ── モニタリング読込 ──
  const monitoringRepo = useMonitoringMeetingRepository();
  const {
    record: latestMonitoringRecord,
    isLoading: isMonitoringLoading,
  } = useLatestBehaviorMonitoring(selectedUser?.id ?? null, {
    repository: monitoringRepo,
    planningSheetId: 'new',
  });
  const [monitoringDialogOpen, setMonitoringDialogOpen] = React.useState(false);
  const [monitoringImported, setMonitoringImported] = React.useState(false);

  // ── Dedicated ABC エビデンス取得 ──
  const {
    records: abcEvidenceRecords,
    loading: abcEvidenceLoading,
    error: abcEvidenceError,
    period: abcEvidencePeriod,
  } = useMonitoringAbcEvidence(
    selectedUser?.id,
    form.supportStartDate,
    form.monitoringCycleDays,
  );

  // ── Helpers ──
  const userOptions = React.useMemo<UserOption[]>(
    () => filterActiveUsers(users).map(u => ({ id: u.UserID, label: `${u.FullName} (${u.UserID})` })),
    [users],
  );

  const updateField = React.useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // ── User selection handler ──
  const handleUserSelect = React.useCallback(
    async (_event: React.SyntheticEvent | null, value: UserOption | null) => {
      setSelectedUser(value);
      setIspId(null);
      setIspWarning(null);
      setSaveError(null);
      if (!value) return;

      setIspLoading(true);
      try {
        const currentIsp = await ispRepo.getCurrentByUser(value.id);
        if (currentIsp) {
          setIspId(currentIsp.id);
        } else {
          setIspId(`draft-isp-${value.id}-${Date.now()}`);
          setIspWarning(`利用者「${value.label}」の現行個別支援計画が見つかりません。仮の紐付けで続行します。`);
        }
      } catch {
        setIspId(`draft-isp-${value.id}-${Date.now()}`);
        setIspWarning('個別支援計画の取得に失敗しました。仮の紐付けで続行します。');
      } finally {
        setIspLoading(false);
      }
    },
    [ispRepo],
  );

  // ── Auto select initial user ──
  React.useEffect(() => {
    if (initialUserId && users && users.length > 0 && !selectedUser && !ispLoading) {
      const u = userOptions.find(o => o.id === initialUserId);
      if (u) {
        handleUserSelect(null, u).catch(console.error);
      }
    }
  }, [initialUserId, users, userOptions, selectedUser, handleUserSelect, ispLoading]);

  // ── 特性アンケート: 利用者に紐づく回答をフィルタ ──
  const { matchedResponses, hasExactMatch } = React.useMemo(() => {
    if (!selectedUser || tokuseiResponses.length === 0) return { matchedResponses: [], hasExactMatch: false };
    
    const normalize = (val: string) => val
      .normalize('NFKC')
      .replace(/[\p{White_Space}\p{Cf}]+/gu, '')
      .toLowerCase();
    const normalizeName = (val: string) => normalize(val)
      .replace(/[（(].*?[)）]/g, '')
      .replace(/(さん|様|ちゃん|くん)$/u, '');
    const userName = selectedUser.label.split(' (')[0]; 
    const normalizedTarget = normalizeName(userName);

    const matches = tokuseiResponses.filter(r => {
      const normalizedSource = normalize(r.targetUserName || '');
      const normalizedSourceName = normalizeName(r.targetUserName || '');
      const targetId = normalize(selectedUser.id);
      
      const idMatch = normalizedSource === targetId || normalizedSource.includes(`(${targetId})`) || normalizedSource.includes(targetId);
      const nameMatch =
        normalizedSourceName === normalizedTarget ||
        (normalizedTarget.length > 1 && normalizedSourceName.includes(normalizedTarget)) ||
        (normalizedSourceName.length > 1 && normalizedTarget.includes(normalizedSourceName));

      return idMatch || nameMatch;
    });

    const hasExactMatch = matches.some(r => {
      const normalizedSource = normalize(r.targetUserName || '');
      const targetId = normalize(selectedUser.id);
      const idMatch = normalizedSource === targetId || normalizedSource.includes(`(${targetId})`) || normalizedSource.includes(targetId);

      const normalizedSourceName = normalizeName(r.targetUserName || '');
      const namePerfectMatch = normalizedSourceName === normalizedTarget;

      return idMatch || namePerfectMatch;
    });

    // 優先度順にソート（ID一致 -> 名前完全一致 -> 名前部分一致）
    matches.sort((a, b) => {
      const aSource = normalize(a.targetUserName || '');
      const bSource = normalize(b.targetUserName || '');
      const targetId = normalize(selectedUser.id);
      
      const aIdMatch = aSource === targetId ? 2 : (aSource.includes(targetId) ? 1 : 0);
      const bIdMatch = bSource === targetId ? 2 : (bSource.includes(targetId) ? 1 : 0);
      
      if (aIdMatch !== bIdMatch) return bIdMatch - aIdMatch;
      
      const aNameMatch = normalizeName(a.targetUserName || '') === normalizedTarget ? 1 : 0;
      const bNameMatch = normalizeName(b.targetUserName || '') === normalizedTarget ? 1 : 0;
      
      return bNameMatch - aNameMatch;
    });

    return {
      matchedResponses: matches,
      hasExactMatch
    };
  }, [selectedUser, tokuseiResponses]);

  // ── 特性アンケート: 自動選択 ──
  React.useEffect(() => {
    if (hasExactMatch && matchedResponses.length === 1 && !selectedTokusei) {
      setSelectedTokusei(matchedResponses[0]);
    }
  }, [hasExactMatch, matchedResponses, selectedTokusei]);

  // ── 特性アンケート: プレビュー表示 ──
  const handleTokuseiImport = React.useCallback(() => {
    if (!selectedTokusei) return;

    const result = tokuseiToPlanningBridge({
      kind: 'aggregated',
      response: selectedTokusei,
      responseId: selectedTokusei.responseId,
      updatedAt: selectedTokusei.createdAt,
    });

    const preview = buildImportPreview(result.formPatches, form as unknown as Record<string, unknown>);
    setImportPreview(preview);
    setTokuseiBridgeResult(result);
    setLastBridgeResult(result);
    setImportSource('tokusei');
    setPreviewDialogOpen(true);
  }, [selectedTokusei, form]);

  // ── 氷山分析: インポート ──
  const handleIcebergImport = React.useCallback(async () => {
    if (!selectedUser || !icebergRepo) return;
    
    setIsIcebergLoading(true);
    try {
      const latest = await icebergRepo.getLatestByUser(selectedUser.id);
      if (!latest) {
        setToast({ open: true, message: 'この利用者の氷山分析データが見つかりません', severity: 'warning' });
        return;
      }

      const sessionLike = { ...latest, id: latest.sessionId, targetUserId: latest.userId } as unknown as IcebergSession;
      const drafts = icebergToInterventionDrafts(sessionLike);

      const sessionRef = {
        id: latest.sessionId,
        updatedAt: latest.updatedAt,
      };

      const result = buildIcebergImportResult(drafts, sessionRef);
      
      const preview = buildImportPreview(result.formPatches as Record<string, string>, form as unknown as Record<string, unknown>, result.summary);
      setImportPreview(preview);
      setLastBridgeResult({ formPatches: result.formPatches } as unknown as { formPatches: Record<string, string> });
      setIcebergImportResult(result);
      setImportSource('iceberg');
      setPreviewDialogOpen(true);
    } catch (err) {
      setToast({ open: true, message: `氷山分析の取得に失敗しました: ${err}`, severity: 'warning' });
    } finally {
      setIsIcebergLoading(false);
    }
  }, [selectedUser, icebergRepo, form]);

  // ── 特性アンケート: プレビュー確定→反映 ──
  const handlePreviewConfirm = React.useCallback(() => {
    if (!lastBridgeResult) return;
    if (importSource === 'tokusei' && !selectedTokusei) return;

    const sourceLabel = importSource === 'tokusei' ? '特性アンケート' : '氷山分析';

    setForm(prev => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(lastBridgeResult.formPatches)) {
        if (key in next && typeof value === 'string') {
          const k = key as keyof FormState;
          const current = next[k];
          if (typeof current === 'string' && !current.trim()) {
            (next as Record<string, unknown>)[k] = value;
          } else if (typeof current === 'string' && current.trim()) {
            (next as Record<string, unknown>)[k] = `${current}\n\n【${sourceLabel}より】\n${value}`;
          }
        }
      }
      return next;
    });

    if (importSource === 'tokusei') {
      setTokuseiImported(true);
    } else if (importSource === 'iceberg') {
      setIcebergImported(true);
    }
    
    setPreviewDialogOpen(false);

    const s = importPreview?.summary;
    let summaryText = '取込完了';
    if (importSource === 'tokusei') {
      summaryText = s && s.totalAffected > 0
        ? `特性アンケートから取込完了: 新規${s.newCount}項目 + 追記${s.appendCount}項目`
        : '特性アンケートから取込完了（該当データなし）';
    } else {
      summaryText = s && s.totalAffected > 0
        ? `氷山分析から取込完了: 新規${s.newCount}項目 + 追記${s.appendCount}項目`
        : '氷山分析から取込完了';
    }
    setToast({ open: true, message: summaryText, severity: 'success' });
  }, [lastBridgeResult, selectedTokusei, importPreview, importSource]);

  // ── Provenance バッジヘルパー ──
  const renderProvenanceBadge = React.useCallback((fieldKey: string) => {
    const prov = tokuseiProvenance.get(fieldKey);
    if (!prov) return null;
    return prov;
  }, [tokuseiProvenance]);

  // ── モニタリング反映 ──
  const handleMonitoringImport = React.useCallback(
    (result: MonitoringToPlanningResult, _selectedCandidateIds: string[]) => {
      if (!result) return;

      setForm(prev => {
        const next = { ...prev };
        for (const [key, value] of Object.entries(result.autoPatches)) {
          if (key in next && typeof value === 'string') {
            const k = key as keyof FormState;
            const current = next[k];
            if (typeof current === 'string' && !current.trim()) {
              (next as Record<string, unknown>)[k] = value;
            } else if (typeof current === 'string' && current.trim()) {
              (next as Record<string, unknown>)[k] = `${current}\n\n【モニタリングより】\n${value}`;
            }
          }
        }
        return next;
      });

      setMonitoringImported(true);
      setMonitoringDialogOpen(false);

      const s = result.summary;
      const summaryText = (s.autoFieldCount + s.candidateCount) > 0
        ? `モニタリングから取込完了: 自動${s.autoFieldCount}項目 + 候補${s.candidateCount}件`
        : 'モニタリングから取込完了（該当データなし）';
      setToast({ open: true, message: summaryText, severity: 'success' });
    },
    [],
  );

  // ── Fill sample data ──
  const handleFillSample = React.useCallback(() => setForm(SAMPLE_FORM), []);

  // ── Save ──
  const { saveAuditRecord } = useImportAuditStore();
  const handleCreate = React.useCallback(async () => {
    if (!selectedUser || !ispId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const createdBy = (account as { name?: string })?.name ?? '不明';
      const input = buildCreateInput(form, selectedUser.id, ispId, createdBy);
      const created = await planningSheetRepo.create(input);
      
      if (diffSummary) {
        saveAuditRecord({
          planningSheetId: created.id,
          importedAt: new Date().toISOString(),
          importedBy: createdBy,
          assessmentId: null,
          tokuseiResponseId: null,
          mode: 'behavior-monitoring',
          affectedFields: ['iceberg_differential_completion'],
          provenance: [],
          summaryText: `氷山分析の差分基づき改訂を確定: ${diffSummary}`,
        });
      }

      if (icebergImported && icebergImportResult && icebergImportResult.provenance.length > 0) {
        saveAuditRecord({
          planningSheetId: created.id,
          importedAt: new Date().toISOString(),
          importedBy: createdBy,
          assessmentId: null,
          tokuseiResponseId: null,
          mode: 'iceberg',
          affectedFields: icebergImportResult.formPatches ? Object.keys(icebergImportResult.formPatches) : [],
          provenance: icebergImportResult.provenance,
          summaryText: `氷山分析から取込完了: 行動${icebergImportResult.summary.behaviorCount}件, きっかけ${icebergImportResult.summary.triggerCount}件, 環境${icebergImportResult.summary.environmentFactorCount}件, 対応${icebergImportResult.summary.strategyCount}件`,
        });
      }

      if (tokuseiImported && selectedTokusei && tokuseiBridgeResult) {
        const payload = buildTokuseiImportAuditPayload({
          planningSheetId: created.id,
          importedBy: createdBy,
          tokuseiResponseId: selectedTokusei.responseId,
          bridgeResult: tokuseiBridgeResult,
          now: new Date().toISOString()
        });
        saveAuditRecord(payload);
      }

      navigate(`/support-planning-sheet/${created.id}`, { replace: true });
    } catch (err) {
      setSaveError(`作成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedUser, ispId, account, form, planningSheetRepo, navigate, diffSummary, icebergImported, icebergImportResult, tokuseiImported, selectedTokusei, tokuseiBridgeResult, saveAuditRecord]);

  const canProceedToForm = !!(selectedUser && ispId);
  const isPristineForm = React.useMemo(
    () => JSON.stringify(form) === JSON.stringify(INITIAL_FORM),
    [form],
  );

  React.useEffect(() => {
    if (initialSource !== 'iceberg' || autoIcebergHandledRef.current) return;
    if (!canProceedToForm || !selectedUser || isIcebergLoading) return;

    autoIcebergHandledRef.current = true;

    if (!isPristineForm) {
      setToast({
        open: true,
        severity: 'info',
        message: '下書きがあるため、氷山分析の自動読込はスキップしました。必要な場合は「氷山分析を読み込む」を押してください。',
      });
      return;
    }

    void handleIcebergImport();
  }, [initialSource, canProceedToForm, selectedUser, isIcebergLoading, isPristineForm, handleIcebergImport]);

  return {
    selectedUser,
    ispId,
    ispLoading,
    ispWarning,
    form,
    activeStep,
    isSaving,
    saveError,
    tokuseiStatus,
    selectedTokusei,
    setSelectedTokusei,
    tokuseiImported,
    previewDialogOpen,
    setPreviewDialogOpen,
    importPreview,
    toast,
    setToast,
    icebergImported,
    isIcebergLoading,
    monitoringDialogOpen,
    setMonitoringDialogOpen,
    monitoringImported,
    latestMonitoringRecord,
    isMonitoringLoading,
    abcEvidenceRecords,
    abcEvidenceLoading,
    abcEvidenceError,
    abcEvidencePeriod,
    isAdmin,
    userOptions,
    matchedResponses,
    hasExactMatch,
    canProceedToForm,
    updateField,
    handleUserSelect,
    refreshTokusei,
    handleTokuseiImport,
    handleIcebergImport,
    handlePreviewConfirm,
    renderProvenanceBadge,
    handleMonitoringImport,
    handleFillSample,
    handleCreate,
    setActiveStep,
  };
};
