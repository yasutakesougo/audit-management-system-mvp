/**
 * ImportMonitoringDialog — 行動モニタリング結果を支援計画シートに反映するダイアログ
 *
 * 2モード設計:
 *  - 自動追記（低リスク）: 確認表示のみ
 *  - 候補提示（職員選択）: チェックボックスで選択式
 *
 * @see monitoringToPlanningBridge.ts
 * @see docs/architecture/isp-three-layer-model.md
 */
import type { BehaviorMonitoringRecord } from '@/domain/isp/behaviorMonitoring';
import type { PlanningSheetFormValues } from '@/domain/isp/schema';
import {
  bridgeMonitoringToPlanning,
  type MonitoringCandidate,
  type MonitoringCandidateCategory,
  type MonitoringToPlanningResult,
} from '@/features/planning-sheet/monitoringToPlanningBridge';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<MonitoringCandidateCategory, {
  label: string;
  color: 'success' | 'warning' | 'info' | 'secondary';
  icon: string;
  defaultSelected: boolean;
}> = {
  effective_support: {
    label: '有効な支援',
    color: 'success',
    icon: '✅',
    defaultSelected: true,
  },
  revision_needed: {
    label: '見直し候補',
    color: 'warning',
    icon: '⚠',
    defaultSelected: false,
  },
  environment: {
    label: '環境調整',
    color: 'info',
    icon: '🏗',
    defaultSelected: true,
  },
  policy: {
    label: '支援方針',
    color: 'secondary',
    icon: '📋',
    defaultSelected: false,
  },
};

const TARGET_FIELD_LABELS: Partial<Record<keyof PlanningSheetFormValues, string>> = {
  concreteApproaches: '関わり方の具体策',
  supportPolicy: '対応方針',
  environmentalAdjustments: '環境調整',
  collectedInformation: '収集情報',
  observationFacts: '行動観察',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  /** 行動モニタリング記録 */
  monitoringRecord: BehaviorMonitoringRecord;
  /** 現在のフォーム値 */
  currentForm: PlanningSheetFormValues;
  /** 反映結果のコールバック */
  onImport: (result: MonitoringToPlanningResult, selectedCandidateIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ImportMonitoringDialog: React.FC<Props> = ({
  open,
  onClose,
  monitoringRecord,
  currentForm,
  onImport,
}) => {
  // ── ブリッジ計算 ──
  const bridgeResult = useMemo(
    () => bridgeMonitoringToPlanning(monitoringRecord, currentForm),
    [monitoringRecord, currentForm],
  );

  // ── 候補選択状態 ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const c of bridgeResult.candidates) {
      if (CATEGORY_CONFIG[c.category].defaultSelected) {
        initial.add(c.id);
      }
    }
    return initial;
  });

  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── 反映実行 ──
  const handleImport = () => {
    onImport(bridgeResult, [...selectedIds]);
    onClose();
  };

  // ── no-op チェック ──
  const isNoop = bridgeResult.summary.autoFieldCount === 0 && bridgeResult.summary.candidateCount === 0;
  const selectedCount = bridgeResult.candidates.filter((c) => selectedIds.has(c.id)).length;

  // ── カテゴリ別にグループ化 ──
  const groupedCandidates = useMemo(() => {
    const groups = new Map<MonitoringCandidateCategory, MonitoringCandidate[]>();
    for (const c of bridgeResult.candidates) {
      const list = groups.get(c.category) ?? [];
      list.push(c);
      groups.set(c.category, list);
    }
    return groups;
  }, [bridgeResult.candidates]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { maxHeight: '85vh' } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <TipsAndUpdatesRoundedIcon color="secondary" />
          <Typography variant="h6" fontWeight={700}>
            行動モニタリング結果の反映
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          期間: {monitoringRecord.periodStart}〜{monitoringRecord.periodEnd}
          ・記録者: {monitoringRecord.recordedBy}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {isNoop ? (
          <Alert severity="info" icon={<CheckCircleOutlineRoundedIcon />}>
            すべての項目が既に反映済みです。追加反映する項目はありません。
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* ── セクション1: 自動追記 ── */}
            {bridgeResult.summary.autoFieldCount > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AutoFixHighRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    自動追記 ({bridgeResult.summary.autoFieldCount}件)
                  </Typography>
                  <Chip size="small" label="確認のみ" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  以下の情報は低リスクのため、収集情報・行動観察に自動追記されます。
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(bridgeResult.autoPatches).map(([field, value]) => (
                    <Box
                      key={field}
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        borderLeft: '3px solid',
                        borderLeftColor: 'primary.main',
                      }}
                    >
                      <Typography variant="caption" color="primary" fontWeight={600}>
                        📝 {TARGET_FIELD_LABELS[field as keyof PlanningSheetFormValues] ?? field}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                        {typeof value === 'string' ? value.slice(-200) : String(value)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {bridgeResult.summary.autoFieldCount > 0 && bridgeResult.candidates.length > 0 && (
              <Divider />
            )}

            {/* ── セクション2: 候補提示 ── */}
            {bridgeResult.candidates.length > 0 && (
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <LightbulbRoundedIcon color="secondary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    候補提示 ({bridgeResult.candidates.length}件)
                  </Typography>
                  <Chip
                    size="small"
                    label={`${selectedCount}件選択中`}
                    color={selectedCount > 0 ? 'secondary' : 'default'}
                    variant="outlined"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  チェックした項目のみ計画シートに反映されます。内容を確認し、必要な候補を選択してください。
                </Typography>

                <Stack spacing={2}>
                  {[...groupedCandidates.entries()].map(([category, candidates]) => {
                    const config = CATEGORY_CONFIG[category];
                    return (
                      <Box key={category}>
                        <Chip
                          size="small"
                          label={`${config.icon} ${config.label}`}
                          color={config.color}
                          sx={{ mb: 1 }}
                        />
                        <Stack spacing={0.5}>
                          {candidates.map((c) => (
                            <Box
                              key={c.id}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: selectedIds.has(c.id) ? `${config.color}.main` : 'divider',
                                bgcolor: selectedIds.has(c.id) ? `${config.color}.50` : 'transparent',
                                transition: 'all 0.15s',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={selectedIds.has(c.id)}
                                    onChange={() => toggleCandidate(c.id)}
                                    size="small"
                                  />
                                }
                                label={
                                  <Box>
                                    <Typography variant="body2" fontWeight={500}>
                                      {c.text}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`→ ${TARGET_FIELD_LABELS[c.targetField] ?? c.targetField}`}
                                      />
                                      <Typography variant="caption" color="text.secondary">
                                        {c.reason}
                                      </Typography>
                                    </Stack>
                                  </Box>
                                }
                                sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                              />
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* ── セクション3: サマリー ── */}
            <Divider />
            <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                反映サマリー
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`自動追記: ${bridgeResult.summary.autoFieldCount}件`} />
                <Chip size="small" label={`有効な支援: ${bridgeResult.summary.goalsContinued}件`} color="success" variant="outlined" />
                <Chip size="small" label={`見直し候補: ${bridgeResult.summary.goalsToRevise}件`} color="warning" variant="outlined" />
                <Chip size="small" label={`推奨変更: ${bridgeResult.summary.decisionsApplied}件`} color="info" variant="outlined" />
                <Chip size="small" label={`選択中: ${selectedCount}件`} color="secondary" />
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          キャンセル
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          color="secondary"
          disabled={isNoop}
          startIcon={<TipsAndUpdatesRoundedIcon />}
        >
          {isNoop
            ? '反映済み'
            : `反映する (自動${bridgeResult.summary.autoFieldCount} + 選択${selectedCount}件)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
