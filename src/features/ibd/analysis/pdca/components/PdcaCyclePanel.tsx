import { PDCA_PHASE_LABELS, type PdcaCycleState } from '@/domain/isp/types';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';

interface PdcaCyclePanelProps {
  state: PdcaCycleState | null;
  loading?: boolean;
  error?: Error | null;
}

const NEXT_ACTION_BY_PHASE: Record<PdcaCycleState['currentPhase'], string> = {
  plan: '計画内容を確認し、支援手順の整備を進めてください。',
  do: '支援手順の実施状況を確認してください。',
  check: '行動モニタリング結果を確認してください。',
  act: '再評価内容を支援計画に反映してください。',
};

function formatHealthScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function PdcaCyclePanel({
  state,
  loading = false,
  error = null,
}: PdcaCyclePanelProps) {
  if (loading) {
    return <Alert severity="info">PDCA状態を読み込み中です。</Alert>;
  }

  if (error) {
    return <Alert severity="error">PDCA状態の取得に失敗しました。</Alert>;
  }

  if (!state) {
    return <Alert severity="warning">PDCA状態はまだ生成されていません。</Alert>;
  }

  const completedAt = state.phaseCompletions[state.currentPhase] ?? '未完了';

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          PDCAサイクル状態
        </Typography>
        <Box>
          <Typography variant="body2">
            現在フェーズ: {PDCA_PHASE_LABELS[state.currentPhase]}
          </Typography>
          <Typography variant="body2">
            健全度スコア: {formatHealthScore(state.healthScore)}
          </Typography>
          <Typography variant="body2">
            サイクル番号: {state.cycleNumber}
          </Typography>
          <Typography variant="body2">
            現在フェーズ完了日: {completedAt}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          次アクション: {NEXT_ACTION_BY_PHASE[state.currentPhase]}
        </Typography>
      </Stack>
    </Paper>
  );
}
