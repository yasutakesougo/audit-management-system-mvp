/**
 * ImportAssessmentDialog — アセスメントデータを支援計画シートに取り込むダイアログ
 *
 * - UserAssessment（ICF 分類アセスメント）の内容をプレビュー
 * - オプションで特性アンケートの回答も選択可能
 * - 「取込」で bridgeAssessmentToPlanningSheet() を実行し、親に結果を通知
 */
import type { TokuseiSurveyResponse } from '@/domain/assessment/tokusei';
import type { PlanningIntake, PlanningSheetFormValues } from '@/domain/isp/schema';
import type { UserAssessment } from '@/features/assessment/domain/types';
import { useTokuseiSurveyResponses } from '@/features/assessment/hooks/useTokuseiSurveyResponses';
import { type AssessmentBridgeResult, bridgeAssessmentToPlanningSheet } from '@/features/planning-sheet/assessmentBridge';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  /** 対象の UserAssessment */
  assessment: UserAssessment;
  /** 対象ユーザー名（特性アンケートのフィルタリングに使用） */
  targetUserName?: string;
  /** 現在のフォーム値 */
  currentForm: PlanningSheetFormValues;
  /** 現在のインテーク値 */
  currentIntake: PlanningIntake;
  /** 取込結果のコールバック */
  onImport: (result: AssessmentBridgeResult) => void;
}

// ---------------------------------------------------------------------------
// Sensory profile label
// ---------------------------------------------------------------------------

const SENSORY_LABELS: Record<string, string> = {
  visual: '視覚',
  auditory: '聴覚',
  tactile: '触覚',
  olfactory: '嗅覚',
  vestibular: '前庭覚',
  proprioceptive: '固有受容覚',
};

const sensoryLevelLabel = (value: number): string => {
  if (value <= 1) return '鈍麻';
  if (value === 2) return 'やや鈍麻';
  if (value === 3) return '標準';
  if (value === 4) return 'やや過敏';
  return '過敏';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportAssessmentDialog: React.FC<Props> = ({
  open,
  onClose,
  assessment,
  targetUserName,
  currentForm,
  currentIntake,
  onImport,
}) => {
  const [selectedTokusei, setSelectedTokusei] = useState<TokuseiSurveyResponse | null>(null);
  const [mode, setMode] = useState<'assessment-only' | 'with-tokusei'>('assessment-only');

  // 特性アンケートの取得
  const { responses, status } = useTokuseiSurveyResponses();
  const filteredResponses = useMemo(() => {
    if (!targetUserName) return responses;
    const normalize = (v: string) => v.replace(/\s+/g, '').toLowerCase();
    const target = normalize(targetUserName);
    return responses.filter((r) => normalize(r.targetUserName).includes(target));
  }, [responses, targetUserName]);

  // プレビュー計算
  const preview = useMemo((): AssessmentBridgeResult => {
    const tokusei = mode === 'with-tokusei' ? selectedTokusei : null;
    return bridgeAssessmentToPlanningSheet(assessment, tokusei, currentForm, currentIntake);
  }, [assessment, selectedTokusei, mode, currentForm, currentIntake]);

  const hasChanges =
    preview.summary.sensoryTriggersAdded > 0 ||
    preview.summary.observationFactsAppended ||
    preview.summary.collectedInfoAppended ||
    preview.summary.medicalFlagsAdded > 0;

  const handleImport = () => {
    onImport(preview);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <AssessmentRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            アセスメントデータの取込
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          アセスメント画面のデータを支援計画シートの各フィールドに取り込みます
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* ── 取込モード選択 ── */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              取込元
            </Typography>
            <RadioGroup
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'assessment-only' | 'with-tokusei');
                if (e.target.value === 'assessment-only') setSelectedTokusei(null);
              }}
            >
              <FormControlLabel
                value="assessment-only"
                control={<Radio size="small" />}
                label="アセスメント画面のデータのみ"
              />
              <FormControlLabel
                value="with-tokusei"
                control={<Radio size="small" />}
                label="アセスメント＋特性アンケート"
              />
            </RadioGroup>
          </Box>

          {/* ── アセスメントプレビュー ── */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              アセスメント情報
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`アイテム: ${assessment.items.length}件`}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`タグ: ${assessment.analysisTags.length}件`}
                variant="outlined"
              />
              {Object.entries(assessment.sensory).map(([key, value]) => (
                <Chip
                  key={key}
                  size="small"
                  label={`${SENSORY_LABELS[key] || key}: ${sensoryLevelLabel(value)}`}
                  color={value >= 4 ? 'warning' : value <= 2 ? 'info' : 'default'}
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>

          {/* ── 特性アンケート選択（モード: with-tokusei） ── */}
          {mode === 'with-tokusei' && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  特性アンケート回答の選択
                </Typography>
                {status === 'loading' && (
                  <Typography variant="body2" color="text.secondary">読み込み中…</Typography>
                )}
                {status === 'success' && filteredResponses.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    一致するアンケート回答がありません
                  </Typography>
                )}
                {filteredResponses.length > 0 && (
                  <List disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
                    {filteredResponses.map((r) => (
                      <ListItemButton
                        key={r.id}
                        selected={selectedTokusei?.id === r.id}
                        onClick={() => setSelectedTokusei(r)}
                      >
                        <ListItemIcon>
                          {selectedTokusei?.id === r.id ? (
                            <CheckCircleOutlineRoundedIcon color="primary" />
                          ) : (
                            <AssessmentRoundedIcon color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={r.targetUserName || '対象者未設定'}
                          secondary={`回答者: ${r.responderName || '未設定'} / ${r.fillDate ? new Date(r.fillDate).toLocaleDateString('ja-JP') : '日付不明'}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </Box>
            </>
          )}

          <Divider />

          {/* ── 取込プレビュー ── */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              取込プレビュー
            </Typography>
            {hasChanges ? (
              <Stack spacing={1}>
                {preview.summary.sensoryTriggersAdded > 0 && (
                  <Alert severity="info" variant="outlined">
                    感覚トリガー: {preview.summary.sensoryTriggersAdded}件を「情報収集」タブに追加
                  </Alert>
                )}
                {preview.summary.observationFactsAppended && (
                  <Alert severity="info" variant="outlined">
                    行動観察: 「概要」タブの行動観察フィールドにテキストを追記
                  </Alert>
                )}
                {preview.summary.collectedInfoAppended && (
                  <Alert severity="info" variant="outlined">
                    収集情報: 「概要」タブの収集情報フィールドにテキストを追記
                  </Alert>
                )}
                {preview.summary.medicalFlagsAdded > 0 && (
                  <Alert severity="info" variant="outlined">
                    医療フラグ: {preview.summary.medicalFlagsAdded}件を「情報収集」タブに追加
                  </Alert>
                )}

                {/* 変換根拠の詳細 */}
                {preview.provenance.length > 0 && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      変換根拠 ({preview.provenance.length}件)
                    </Typography>
                    <Stack spacing={0.5} sx={{ pl: 1 }}>
                      {preview.provenance.map((entry, i) => (
                        <Stack
                          key={`${entry.field}-${i}`}
                          direction="row"
                          spacing={1}
                          alignItems="flex-start"
                          sx={{
                            p: 0.75,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                          }}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            color={
                              entry.source === 'assessment_sensory' ? 'primary'
                              : entry.source === 'tokusei_survey' ? 'success'
                              : entry.source === 'assessment_tags' ? 'secondary'
                              : 'info'
                            }
                            label={entry.sourceLabel}
                            sx={{ height: 22, fontSize: '0.65rem', flexShrink: 0 }}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" fontWeight={500}>
                              {entry.reason}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: 'block',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              → {entry.value}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            ) : (
              <Alert severity="warning" variant="outlined">
                取り込める新規データがありません（既に取込済みか、アセスメントにデータがありません）
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={!hasChanges}
          startIcon={<AssessmentRoundedIcon />}
        >
          取り込む
        </Button>
      </DialogActions>
    </Dialog>
  );
};
