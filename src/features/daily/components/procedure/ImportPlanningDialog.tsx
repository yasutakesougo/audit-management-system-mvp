/**
 * ImportPlanningDialog — 支援計画シートから手順書へ取込ダイアログ
 *
 * ProcedureEditor と同列で使用される。
 * 既存手順を壊さず、計画シートの方針・具体策を手順ステップとして追加する。
 */
import type { PlanningIntake, PlanningSheetFormValues, SupportPlanningSheet } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/ProcedureRepository';
import {
  bridgePlanningToRecord,
  type PlanningToRecordBridgeResult,
} from '@/features/planning-sheet/planningToRecordBridge';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportPlanningDialogProps {
  open: boolean;
  onClose: () => void;
  /** 取込対象の支援計画シート */
  planningSheet: SupportPlanningSheet | null;
  /** 現在の手順ステップ群 */
  existingSteps: ProcedureStep[];
  /** 取込結果コールバック */
  onImport: (result: PlanningToRecordBridgeResult) => void;
}

// ---------------------------------------------------------------------------
// Helper: ChangePreviewList
// ---------------------------------------------------------------------------

const ChangePreviewList: React.FC<{
  title: string;
  items: string[];
  color: 'primary' | 'info' | 'warning' | 'success';
}> = ({ title, items, color }) => {
  if (items.length === 0) return null;
  return (
    <Box>
      <Typography variant="caption" fontWeight={600} color={`${color}.main`}>
        {title} ({items.length}件)
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5, pl: 1 }}>
        {items.map((item, i) => (
          <Typography key={i} variant="caption" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <AddCircleOutlineRoundedIcon sx={{ fontSize: 12, mt: 0.25, flexShrink: 0, color: `${color}.main` }} />
            <span style={{ wordBreak: 'break-word' }}>
              {item.length > 80 ? `${item.slice(0, 80)}…` : item}
            </span>
          </Typography>
        ))}
      </Stack>
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportPlanningDialog: React.FC<ImportPlanningDialogProps> = ({
  open,
  onClose,
  planningSheet,
  existingSteps,
  onImport,
}) => {
  // ブリッジ結果のプレビュー計算
  const preview = useMemo<PlanningToRecordBridgeResult | null>(() => {
    if (!planningSheet) return null;
    const sheetInput: {
      form: Pick<PlanningSheetFormValues, 'supportPolicy' | 'concreteApproaches' | 'environmentalAdjustments' | 'title'>;
      intake: Pick<PlanningIntake, 'sensoryTriggers' | 'medicalFlags'>;
    } = {
      form: {
        supportPolicy: planningSheet.supportPolicy,
        concreteApproaches: planningSheet.concreteApproaches,
        environmentalAdjustments: planningSheet.environmentalAdjustments,
        title: planningSheet.title,
      },
      intake: {
        sensoryTriggers: planningSheet.intake.sensoryTriggers,
        medicalFlags: planningSheet.intake.medicalFlags,
      },
    };
    return bridgePlanningToRecord(sheetInput, existingSteps, planningSheet.id);
  }, [planningSheet, existingSteps]);

  const hasChanges = preview && preview.summary.totalSteps > 0;
  const hasNotes = preview && (preview.summary.sensoryNotesAdded || preview.summary.medicalNotesAdded);
  const isEmpty = !hasChanges && !hasNotes;

  const handleImport = () => {
    if (!preview) return;
    onImport(preview);
    onClose();
  };

  // 変更プレビューデータ
  const policySteps = preview?.steps.filter((s) => s.activity === '支援方針').map((s) => s.instruction) ?? [];
  const approachSteps = preview?.steps.filter((s) => s.activity === '具体的対応').map((s) => s.instruction) ?? [];
  const envSteps = preview?.steps.filter((s) => s.activity === '環境調整（留意点）').map((s) => s.instruction) ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <InfoOutlinedIcon color="info" />
          <span>支援計画シートから手順を取込</span>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {!planningSheet ? (
          <Alert severity="warning">
            紐づく支援計画シートが見つかりません。先に支援計画シートを作成してください。
          </Alert>
        ) : (
          <Stack spacing={2}>
            {/* ── シート概要 ── */}
            <Box>
              <Typography variant="body2" fontWeight={600}>
                取込元: {planningSheet.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                既存手順: {existingSteps.length}件
              </Typography>
            </Box>

            <Divider />

            {/* ── 変更プレビュー ── */}
            {isEmpty ? (
              <Alert severity="info" icon={<CheckCircleOutlineRoundedIcon />}>
                この計画シートからの追加項目はありません（すべて取込済み、または内容が空です）。
              </Alert>
            ) : (
              <>
                {/* ステップ追加プレビュー */}
                {hasChanges && (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                      追加される手順ステップ ({preview!.summary.totalSteps}件)
                    </Typography>

                    <Stack spacing={1}>
                      <ChangePreviewList title="支援方針" items={policySteps} color="warning" />
                      <ChangePreviewList title="具体的対応" items={approachSteps} color="info" />
                      <ChangePreviewList title="環境調整（留意点）" items={envSteps} color="success" />
                    </Stack>
                  </Box>
                )}

                {/* globalNotes プレビュー */}
                {hasNotes && (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                      全ステップ共通注記
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        whiteSpace: 'pre-line',
                        bgcolor: 'action.hover',
                        p: 1,
                        borderRadius: 1,
                      }}
                    >
                      {preview!.globalNotes}
                    </Typography>
                  </Box>
                )}

                {/* provenance サマリー */}
                {preview && preview.provenance.length > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                      変換根拠 ({preview.provenance.length}件)
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {preview.provenance.map((p, i) => (
                        <Chip
                          key={i}
                          size="small"
                          variant="outlined"
                          color="warning"
                          label={p.reason.length > 40 ? `${p.reason.slice(0, 40)}…` : p.reason}
                          sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={isEmpty || !planningSheet}
          startIcon={<AddCircleOutlineRoundedIcon />}
        >
          取り込む ({preview?.summary.totalSteps ?? 0}件)
        </Button>
      </DialogActions>
    </Dialog>
  );
};
