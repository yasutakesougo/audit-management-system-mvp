/**
 * @fileoverview OpsMetricsPage — /ops 独立ページ
 * @description
 * Support Operations Metrics Dashboard をフルページで表示する。
 *
 * 実データモード:
 * - Proposal: localStorage の SuggestionAction から自動変換
 * - PDCA: userPdcaInputs が渡されれば実データ、なければデモ
 * - Knowledge: 将来接続予定（Phase 3）
 *
 * @see docs/ops/ops-dashboard-observability-layer.md
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

import OpsMetricsDashboard from '@/features/ops-dashboard/OpsMetricsDashboard';
import { useOpsMetrics } from '@/features/ops-dashboard/hooks/useOpsMetrics';

const OpsMetricsPage: React.FC = () => {
  const {
    isReady,
    proposalMetrics,
    pdcaMetrics,
    knowledgeMetrics,
    excludedUserCount,
  } = useOpsMetrics();

  // Proposal に実データがあるか
  const hasRealProposalData = isReady && proposalMetrics !== null;
  // PDCA に実データがあるか（Phase 2 の userPdcaInputs 接続後）
  const hasRealPdcaData = pdcaMetrics !== null;

  // 全てデモフォールバック必要か
  const needsDemoFallback = !hasRealProposalData && !hasRealPdcaData;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* ステータスバー */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: 'right', flex: 1 }}
        >
          {needsDemoFallback
            ? '※ デモデータで表示中 — 運用データが蓄積されると実データに切り替わります'
            : '※ 実データから自動計算中'
          }
        </Typography>
        {hasRealProposalData && (
          <Chip label="Proposal: 実データ" size="small" color="success" variant="outlined" />
        )}
        {hasRealPdcaData && (
          <Chip label="PDCA: 実データ" size="small" color="success" variant="outlined" />
        )}
      </Stack>

      {/* 実データがあればそれを使い、なければ demo フォールバック */}
      {needsDemoFallback ? (
        <OpsMetricsDashboard demo />
      ) : (
        <OpsMetricsDashboard
          proposalMetrics={proposalMetrics}
          pdcaMetrics={pdcaMetrics}
          knowledgeMetrics={knowledgeMetrics}
          excludedUserCount={excludedUserCount}
        />
      )}

      {/* 実データがある場合の補足 */}
      {!needsDemoFallback && !hasRealPdcaData && (
        <Alert severity="info" sx={{ mt: 2 }}>
          PDCA サイクルデータはまだ接続されていません。
          利用者の支援開始日が登録されると、自動的にサイクル計測が始まります。
        </Alert>
      )}
    </Box>
  );
};

export default OpsMetricsPage;
