/**
 * @fileoverview OpsMetricsPage — /ops 独立ページ
 * @description
 * Support Operations Metrics Dashboard をフルページで表示する。
 *
 * 実データモード:
 * - Proposal: localStorage の SuggestionAction から自動変換
 * - PDCA: 利用者一覧から userPdcaInputs を自動構築
 * - Knowledge: 将来接続予定（Phase 3）
 *
 * @see docs/ops/ops-dashboard-observability-layer.md
 */
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';

import OpsMetricsDashboard from '@/features/ops-dashboard/OpsMetricsDashboard';
import { useOpsMetrics } from '@/features/ops-dashboard/hooks/useOpsMetrics';
import { resolveUserLifecycleStatus } from '@/features/users/domain/userLifecycle';
import { useUsers } from '@/features/users/store';
import { buildUserPdcaInputs } from '@/domain/metrics/adapters/userPdcaInputConnector';
import { isDemoModeEnabled } from '@/lib/env';
import { ConnectionDegradedBanner } from '@/features/sp/health/components/ConnectionDegradedBanner';

const OpsMetricsPage: React.FC = () => {
  // 利用者データ取得
  const { data: users, isLoading: usersLoading } = useUsers();

  // 利用者から UserPdcaInput[] を構築
  const userPdcaInputs = useMemo(
    () => buildUserPdcaInputs(
      users.map(u => ({
        userId: u.UserID || String(u.Id),
        serviceStartDate: u.ServiceStartDate ?? null,
        active: resolveUserLifecycleStatus(u) === 'active',
      })),
    ),
    [users],
  );

  // Ops Metrics 統合 hook（Proposal + PDCA 実データ接続）
  const {
    isReady,
    proposalMetrics,
    pdcaMetrics,
    knowledgeMetrics,
    excludedUserCount,
  } = useOpsMetrics({
    userPdcaInputs,
  });

  // 状態判定
  const loading = usersLoading || !isReady;
  const hasRealProposalData = isReady && proposalMetrics !== null;
  const hasRealPdcaData = pdcaMetrics !== null;
  const hasRealKnowledgeData = knowledgeMetrics !== null;
  const hasAnyRealData = hasRealProposalData || hasRealPdcaData || hasRealKnowledgeData;
  
  // デモ表示判定: 実データが無く、かつデモモードが明示的に有効な場合のみ
  const showDemo = !hasAnyRealData && isDemoModeEnabled();

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <ConnectionDegradedBanner />
      {/* ステータスバー */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1, flexWrap: 'wrap' }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, minWidth: 200 }}
        >
          {loading
            ? '読み込み中…'
            : hasAnyRealData
              ? `※ 実データから自動計算中（対象 ${users.filter((u) => resolveUserLifecycleStatus(u) === 'active').length} 名）`
              : showDemo
                ? '※ デモデータで表示中 — 運用データが蓄積されると実データに切り替わります'
                : '※ 表示可能なデータがありません。運用データが登録されると自動的に集計が開始されます。'
          }
        </Typography>
        {hasRealProposalData && (
          <Chip label="Proposal: 実データ" size="small" color="success" variant="outlined" />
        )}
        {hasRealPdcaData && (
          <Chip label="PDCA: 実データ" size="small" color="success" variant="outlined" />
        )}
        {hasRealKnowledgeData && (
          <Chip label="Knowledge: 実データ" size="small" color="success" variant="outlined" />
        )}
      </Stack>

      {/* メインダッシュボード */}
      {showDemo ? (
        <OpsMetricsDashboard demo />
      ) : (
        <OpsMetricsDashboard
          proposalMetrics={proposalMetrics}
          pdcaMetrics={pdcaMetrics}
          knowledgeMetrics={knowledgeMetrics}
          excludedUserCount={excludedUserCount}
        />
      )}

      {/* 補足情報 */}
      {hasAnyRealData && !hasRealPdcaData && (
        <Alert severity="info" sx={{ mt: 2 }}>
          PDCA サイクルデータはまだ接続されていません。
          利用者の支援開始日が登録されると、自動的にサイクル計測が始まります。
        </Alert>
      )}

      {hasRealPdcaData && excludedUserCount > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {excludedUserCount} 名の利用者は支援開始日が未設定のため、PDCA 計測対象外です。
          利用者情報の「利用開始日」を登録すると計測対象に含まれます。
        </Alert>
      )}
    </Box>
  );
};

export default OpsMetricsPage;
