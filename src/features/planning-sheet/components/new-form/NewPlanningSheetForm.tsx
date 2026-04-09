/**
 * NewPlanningSheetForm — 強度行動障害支援計画シート新規作成フォーム
 *
 * `/support-planning-sheet/new` で表示される。
 *
 * 構成（完全版テンプレート 10セクション）：
 *   §1 基本情報 〜 §10 チーム共有
 *
 * @see https://github.com/yasutakesougo/audit-management-system-mvp
 * @see src/domain/isp/schema.ts — ドメインスキーマ
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';

// ── MUI ──
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// ── Icons ──
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

// ── Domain ──
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import type { MonitoringToPlanningResult } from '../../monitoringToPlanningBridge';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { filterActiveUsers } from '@/features/users/domain/userLifecycle';
import { useUsers } from '@/features/users/useUsers';
import { useAuth } from '@/auth/useAuth';
import { tokuseiToPlanningBridge } from '../../tokuseiToPlanningBridge';
import { buildImportPreview } from '../../buildImportPreview';
import type { ImportPreviewResult } from '../../buildImportPreview';
import { ImportPreviewDialog } from '../ImportPreviewDialog';
import { ImportMonitoringDialog } from '../ImportMonitoringDialog';
import { useLatestBehaviorMonitoring } from '../../hooks/useLatestBehaviorMonitoring';
import { useMonitoringMeetingRepository } from '@/features/monitoring/repositories/createMonitoringMeetingRepository';
import { useIcebergRepository } from '@/features/ibd/analysis/iceberg/SharePointIcebergRepository';
import { icebergToInterventionDrafts } from '@/features/ibd/analysis/iceberg/icebergToIntervention';
import { buildIcebergImportResult } from '../../icebergToPlanningBridge';
import { useImportAuditStore } from '../../stores/importAuditStore';
import type { IcebergSession, IcebergSnapshot } from '@/features/ibd/analysis/iceberg/icebergTypes';

// ── Local (split) ──
import type { NewPlanningSheetFormProps, UserOption, FormState } from './types';
import { SECTION_STEPS, INITIAL_FORM, SAMPLE_FORM } from './constants';
import { buildCreateInput } from './helpers';
import FormSections from './FormSections';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const NewPlanningSheetForm: React.FC<NewPlanningSheetFormProps> = ({
  planningSheetRepo,
  ispRepo,
  initialUserId,
  initialSource,
  diffSummary,
}) => {
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { account } = useAuth();

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
  const { responses: tokuseiResponses, status: tokuseiStatus } = useTokuseiSurveyResponses();
  const [selectedTokusei, setSelectedTokusei] = React.useState<TokuseiSurveyResponse | null>(null);
  const [tokuseiImported, setTokuseiImported] = React.useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [importPreview, setImportPreview] = React.useState<ImportPreviewResult | null>(null);
  const [lastBridgeResult, setLastBridgeResult] = React.useState<{ formPatches: Record<string, string> } | null>(null);
  const [tokuseiProvenance, setTokuseiProvenance] = React.useState<Map<string, { name: string; relation?: string; fillDate?: string }>>(new Map());
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: 'success' | 'info' | 'warning' }>({
    open: false, message: '', severity: 'success',
  });

  // ── 氷山分析読込 ──
  const icebergRepo = useIcebergRepository();
  const [icebergImported, setIcebergImported] = React.useState(false);
  const [isIcebergLoading, setIsIcebergLoading] = React.useState(false);
  const [importSource, setImportSource] = React.useState<'tokusei' | 'iceberg' | null>(null);
  const autoIcebergHandledRef = React.useRef(false);

  // ── 特性アンケートセクション ref ──
  const tokuseiSectionRef = React.useRef<HTMLDivElement>(null);



  // ── モニタリング読込 ──
  // NOTE:
  // Repository is resolved via createMonitoringMeetingRepository factory.
  // Do not import localMonitoringMeetingRepository directly in UI components.
  // SP_ENABLED のときは sharepoint モードで SP リストから取得する。
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
      const normalizedSourceName = normalizeName(r.targetUserName || '');
      const normalizedSourceRaw = normalize(r.targetUserName || '');
      const idMatch = normalize(r.targetUserName || '') === normalize(selectedUser.id);
      const nameMatch =
        normalizedSourceName === normalizedTarget ||
        normalizedSourceName.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedSourceName) ||
        normalizedSourceRaw === normalizedTarget;

      return idMatch || nameMatch;
    });

    const hasExactMatch = matches.length > 0;
    return {
      matchedResponses: hasExactMatch ? matches : tokuseiResponses,
      hasExactMatch
    };
  }, [selectedUser, tokuseiResponses]);

  // ── 特性アンケート: プレビュー表示 ──
  const handleTokuseiImport = React.useCallback(() => {
    if (!selectedTokusei) return;

    const result = tokuseiToPlanningBridge({
      kind: 'aggregated',
      response: selectedTokusei,
      responseId: selectedTokusei.responseId,
      updatedAt: selectedTokusei.createdAt,
    });

    // プレビュー生成
    const preview = buildImportPreview(result.formPatches, form as unknown as Record<string, unknown>);
    setImportPreview(preview);
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

      const drafts = icebergToInterventionDrafts({ ...latest, targetUserId: (latest as unknown as IcebergSnapshot).userId } as unknown as IcebergSession);
      const result = buildIcebergImportResult(drafts);
      
      const preview = buildImportPreview(result.formPatches as Record<string, string>, form as unknown as Record<string, unknown>);
      setImportPreview(preview);
      // 特性アンケートのブリッジ結果と構造が同じなので再利用
      setLastBridgeResult({ formPatches: result.formPatches } as unknown as ReturnType<typeof tokuseiToPlanningBridge>);
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

    // formPatches を FormState に反映
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

    // provenance を記録
    if (importSource === 'tokusei' && selectedTokusei) {
      setTokuseiProvenance(prev => {
        const next = new Map(prev);
        for (const key of Object.keys(lastBridgeResult.formPatches)) {
          if (lastBridgeResult.formPatches[key]?.trim()) {
            next.set(key, {
              name: selectedTokusei.responderName || '不明',
              relation: selectedTokusei.relation,
              fillDate: selectedTokusei.fillDate,
            });
          }
        }
        return next;
      });
    }

    if (importSource === 'tokusei') {
      setTokuseiImported(true);
    } else if (importSource === 'iceberg') {
      setIcebergImported(true);
    }
    
    setPreviewDialogOpen(false);

    // サマリーをトースト表示
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
    const dateStr = prov.fillDate ? new Date(prov.fillDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
    return (
      <Chip
        size="small"
        variant="outlined"
        color="secondary"
        sx={{ height: 20, '& .MuiChip-label': { px: 0.8, fontSize: '0.65rem' } }}
        label={`📋 特性アンケ ${prov.name}${prov.relation ? `(${prov.relation})` : ''} ${dateStr}`}
      />
    );
  }, [tokuseiProvenance]);

  // ── モニタリング反映 ──
  const handleMonitoringImport = React.useCallback(
    (result: MonitoringToPlanningResult, _selectedCandidateIds: string[]) => {
      if (!result) return;

      // autoPatches を FormState に反映（フィールド名が一致するもののみ）
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
      
      // 差分基づく作成の確定をログに記録
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

      navigate(`/support-planning-sheet/${created.id}`, { replace: true });
    } catch (err) {
      setSaveError(`作成に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedUser, ispId, account, form, planningSheetRepo, navigate]);

  // ── Navigation ──
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, pb: 4, maxWidth: 960, mx: 'auto' }}>
      <Stack spacing={3}>
        {/* ── 差分引き継ぎの表示 ── */}
        {diffSummary && (
          <Alert 
            severity="info" 
            variant="outlined" 
            sx={{ 
              bgcolor: 'info.50',
              borderColor: 'info.main',
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <Stack spacing={0.5}>
              <Typography variant="caption" fontWeight={700} color="info.main" sx={{ letterSpacing: 1 }}>
                【DIFFERENCE INSIGHT】 今回の改訂理由
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {diffSummary}
              </Typography>
            </Stack>
          </Alert>
        )}

        {/* ── ヘッダー ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <DescriptionRoundedIcon color="primary" />
              <Typography variant="h5" fontWeight={700}>
                強度行動障害支援計画シート
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<QuizRoundedIcon />}
                disabled={!canProceedToForm}
                onClick={() => tokuseiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                特性アンケート
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={isIcebergLoading ? <CircularProgress size={16} /> : <WorkspacesIcon />}
                disabled={!canProceedToForm || isIcebergLoading}
                onClick={handleIcebergImport}
              >
                {icebergImported ? '氷山分析を再読込' : '氷山分析を読み込む'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<TimelineRoundedIcon />}
                disabled={!canProceedToForm || !latestMonitoringRecord || isMonitoringLoading}
                onClick={() => setMonitoringDialogOpen(true)}
              >
                {isMonitoringLoading ? '読込中…' : monitoringImported ? 'モニタリングから再反映' : 'モニタリングから反映'}
              </Button>
              <Button size="small" variant="outlined" color="secondary" startIcon={<AutoFixHighRoundedIcon />} onClick={handleFillSample} disabled={!canProceedToForm}>
                サンプルデータ
              </Button>
              <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/support-plan-guide')}>
                個別支援計画画面に戻る
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* ── 利用者選択 ── */}
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PersonSearchRoundedIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>利用者の選択</Typography>
            </Stack>
            <Autocomplete
              options={userOptions}
              value={selectedUser}
              onChange={handleUserSelect}
              getOptionLabel={o => o.label}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              renderInput={params => (
                <TextField {...params} label="利用者を検索" placeholder="名前または ID で検索..."
                  InputProps={{ ...params.InputProps, endAdornment: (<>{ispLoading ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</>) }} />
              )}
              noOptionsText="該当する利用者が見つかりません"
            />
            {ispWarning && <Alert severity="warning" variant="outlined">{ispWarning}</Alert>}
            {ispId && !ispWarning && <Alert severity="success" variant="outlined">現行個別支援計画と紐付けます（個別支援計画ID: {ispId}）</Alert>}
          </Stack>
        </Paper>

        {/* ── 特性アンケート読込 ── */}
        {canProceedToForm && (
          <Paper ref={tokuseiSectionRef} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: tokuseiImported ? 'success.main' : 'divider' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SupportAgentRoundedIcon color={tokuseiImported ? 'success' : 'primary'} />
                <Typography variant="subtitle1" fontWeight={600}>
                  特性アンケートから読込
                </Typography>
                {tokuseiImported && (
                  <Chip icon={<CheckCircleRoundedIcon />} label="取込済" size="small" color="success" variant="outlined" />
                )}
              </Stack>

              <Typography variant="body2" color="text.secondary">
                特性アンケート（保護者・関係者回答）のデータを元に、氷山分析・FBA・感覚特性を自動入力します。
              </Typography>

              {tokuseiStatus === 'loading' && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">アンケート回答を取得中…</Typography>
                </Stack>
              )}

              {tokuseiStatus === 'success' && matchedResponses.length === 0 && (
                <Alert severity="info" variant="outlined">
                  この利用者に対応する特性アンケートの回答がありません。先に保護者・関係者にアンケートを依頼してください。
                </Alert>
              )}

              {matchedResponses.length > 0 && (
                <>
                  {!hasExactMatch && selectedUser && (
                    <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
                      <Typography variant="body2" fontWeight={600}>
                        「{selectedUser.label.split(' (')[0]}」の自動一致を確定できませんでした。
                      </Typography>
                      <Typography variant="caption">
                        名前表記の揺れ（空白・旧字体・入力差）を考慮し、全回答を表示しています。該当の回答を選択してください。
                      </Typography>
                    </Alert>
                  )}
                  <Typography variant="body2" fontWeight={600}>
                    {hasExactMatch ? `${matchedResponses.length}件の回答が見つかりました。` : '全回答を表示しています。'}取り込む回答を選択してください:
                  </Typography>
                  <Stack spacing={1}>
                    {matchedResponses.map((r: TokuseiSurveyResponse) => (
                      <Paper
                        key={r.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          borderColor: selectedTokusei?.id === r.id ? 'primary.main' : 'divider',
                          bgcolor: selectedTokusei?.id === r.id ? 'primary.50' : 'transparent',
                          '&:hover': { borderColor: 'primary.light' },
                        }}
                        onClick={() => setSelectedTokusei(r)}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack>
                            <Typography variant="body2" fontWeight={600}>
                              {r.targetUserName || '対象利用者未設定'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              回答者: {r.responderName || '不明'}
                              {r.relation ? `（${r.relation}）` : ''}
                              {' / '}
                              回答日: {r.fillDate ? new Date(r.fillDate).toLocaleDateString('ja-JP') : '不明'}
                            </Typography>
                          </Stack>
                          {selectedTokusei?.id === r.id && (
                            <CheckCircleRoundedIcon color="primary" sx={{ fontSize: 20 }} />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<SupportAgentRoundedIcon />}
                    onClick={handleTokuseiImport}
                    disabled={!selectedTokusei}
                  >
                    {tokuseiImported ? '再度読み込む' : '特性アンケートから読込'}
                  </Button>
                </>
              )}
            </Stack>
          </Paper>
        )}

        {/* ── Stepper + Form ── */}
        {canProceedToForm && (
          <>
            <Paper 
              variant="outlined" 
              sx={{ 
                p: { xs: 2, md: 3 }, 
                overflowX: 'auto',
                bgcolor: '#fcfdfe',
                border: '1px solid #e2e8f0',
                borderRadius: 3
              }}
            >
              <Stepper 
                activeStep={activeStep} 
                alternativeLabel={false} // 横並びにして視認性を向上 
                sx={{ 
                  minWidth: 1000,
                  '& .MuiStepConnector-line': {
                    borderColor: '#e2e8f0',
                    borderTopWidth: 2
                  }
                }}
              >
                {SECTION_STEPS.map((label, index) => (
                  <Step key={label} completed={index < activeStep}>
                    <StepLabel
                      sx={{ 
                        cursor: 'pointer',
                        '& .MuiStepLabel-label': { 
                          fontSize: '0.75rem',
                          fontWeight: index === activeStep ? 700 : 500,
                          color: index === activeStep ? 'primary.main' : 'text.secondary',
                          lineHeight: 1.2,
                          maxWidth: '80px', // 折り返し制御
                          textAlign: 'center'
                        },
                        '& .MuiStepIcon-root': {
                          fontSize: '1.5rem',
                          '&.Mui-active': { color: 'primary.main' },
                          '&.Mui-completed': { color: 'success.main' }
                        }
                      }}
                      onClick={() => setActiveStep(index)}
                    >
                      {label}
                    </StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <FormSections
                step={activeStep}
                form={form}
                updateField={updateField}
                renderProvenanceBadge={renderProvenanceBadge}
              />
            </Paper>

            {/* ── Navigation ── */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Button
                startIcon={<NavigateBeforeRoundedIcon />}
                onClick={() => setActiveStep(s => Math.max(0, s - 1))}
                disabled={activeStep === 0}
              >
                前へ
              </Button>

              <Typography variant="body2" color="text.secondary">
                {activeStep + 1} / {SECTION_STEPS.length}
              </Typography>

              {activeStep < SECTION_STEPS.length - 1 ? (
                <Button
                  variant="contained"
                  endIcon={<NavigateNextRoundedIcon />}
                  onClick={() => setActiveStep(s => Math.min(SECTION_STEPS.length - 1, s + 1))}
                >
                  次へ
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  size="large"
                  startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <AddRoundedIcon />}
                  onClick={handleCreate}
                  disabled={!form.title.trim() || isSaving}
                >
                  {isSaving ? '作成中…' : '支援計画シートを作成'}
                </Button>
              )}
            </Stack>

            {saveError && <Alert severity="error" variant="outlined">{saveError}</Alert>}
          </>
        )}
      </Stack>

      {/* ── 取込プレビューダイアログ ── */}
      <ImportPreviewDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        onConfirm={handlePreviewConfirm}
        preview={importPreview}
        responderInfo={selectedTokusei ? {
          name: selectedTokusei.responderName || '不明',
          relation: selectedTokusei.relation,
          fillDate: selectedTokusei.fillDate,
        } : undefined}
      />

      {/* ── モニタリング取込ダイアログ ── */}
      {latestMonitoringRecord && (
        <ImportMonitoringDialog
          open={monitoringDialogOpen}
          onClose={() => setMonitoringDialogOpen(false)}
          monitoringRecord={latestMonitoringRecord}
          currentForm={form as unknown as PlanningSheetFormValues}
          onImport={handleMonitoringImport}
        />
      )}

      {/* ── Toast ── */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          variant="filled"
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
