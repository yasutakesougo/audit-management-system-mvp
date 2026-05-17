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
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

// ── Domain ──
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import { ImportPreviewDialog } from '../ImportPreviewDialog';
import { ImportMonitoringDialog } from '../ImportMonitoringDialog';

// ── Local (split) ──
import type { NewPlanningSheetFormProps } from './types';
import { SECTION_STEPS } from './constants';
import FormSections from './FormSections';
import { useNewPlanningSheetForm } from './hooks/useNewPlanningSheetForm';

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const NewPlanningSheetForm: React.FC<NewPlanningSheetFormProps> = (props) => {
  const navigate = useNavigate();
  const { diffSummary } = props;

  const {
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
  } = useNewPlanningSheetForm(props);

  // ── 特性アンケートセクション ref ──
  const tokuseiSectionRef = React.useRef<HTMLDivElement>(null);

  // ── Custom provenance badge inside view context ──
  const customProvenanceBadge = React.useCallback((fieldKey: string) => {
    const prov = renderProvenanceBadge(fieldKey);
    if (!prov) return null;
    const p = prov as { name: string; relation?: string; fillDate?: string };
    const dateStr = p.fillDate ? new Date(p.fillDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '';
    return (
      <Chip
        size="small"
        variant="outlined"
        color="secondary"
        sx={{ height: 20, '& .MuiChip-label': { px: 0.8, fontSize: '0.65rem' } }}
        label={`📋 特性アンケ ${p.name}${p.relation ? `(${p.relation})` : ''} ${dateStr}`}
      />
    );
  }, [renderProvenanceBadge]);

  const canProceed = !!(selectedUser && ispId);

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
                disabled={!canProceed}
                onClick={() => tokuseiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                特性アンケート
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={isIcebergLoading ? <CircularProgress size={16} /> : <WorkspacesIcon />}
                disabled={!canProceed || isIcebergLoading}
                onClick={handleIcebergImport}
              >
                {icebergImported ? '氷山分析を再読込' : '氷山分析を読み込む'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<TimelineRoundedIcon />}
                disabled={!canProceed || !latestMonitoringRecord || isMonitoringLoading}
                onClick={() => setMonitoringDialogOpen(true)}
              >
                {isMonitoringLoading ? '読込中…' : monitoringImported ? 'モニタリングから再反映' : 'モニタリングから反映'}
              </Button>
              <Button size="small" variant="outlined" color="secondary" startIcon={<AutoFixHighRoundedIcon />} onClick={handleFillSample} disabled={!canProceed}>
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
        {canProceed && (
          <Paper ref={tokuseiSectionRef} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderColor: tokuseiImported ? 'success.main' : 'divider' }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SupportAgentRoundedIcon color={tokuseiImported ? 'success' : 'primary'} />
                <Typography variant="subtitle1" fontWeight={600}>
                  特性アンケートから読込
                </Typography>
                <Button 
                   size="small" 
                   variant="text" 
                   startIcon={tokuseiStatus === 'loading' ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
                   onClick={() => refreshTokusei()}
                   disabled={tokuseiStatus === 'loading'}
                   sx={{ ml: 1 }}
                >
                  最新に更新
                </Button>
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
        {canProceed && (
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
                alternativeLabel={false}
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
                          maxWidth: '80px',
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
                renderProvenanceBadge={customProvenanceBadge}
                userId={selectedUser?.id}
                isAdmin={isAdmin}
                abcEvidenceRecords={abcEvidenceRecords}
                abcEvidenceLoading={abcEvidenceLoading}
                abcEvidencePeriod={abcEvidencePeriod}
                abcEvidenceError={abcEvidenceError}
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

export default NewPlanningSheetForm;
