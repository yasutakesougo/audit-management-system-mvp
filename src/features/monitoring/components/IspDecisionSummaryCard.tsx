/**
 * @fileoverview ISP 判断完了率カード
 * @description
 * ISP 見直し判断のサマリーを Dashboard 上部に表示する。
 *
 * 表示項目:
 * - 判断完了率（プログレスリング）
 * - ステータス別件数（採用 / 保留 / 見送り / 未判断）
 * - 最終更新日時と更新者
 *
 * 設計方針:
 * - decisions が空の場合は何も描画しない
 * - buildDecisionSummary をそのまま利用
 * - コンパクトに 1行〜2行 でまとまる
 */
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React, { useMemo } from 'react';
import { safeFormatDate } from '@/lib/dateFormat';

import type { IspRecommendationDecision } from '../domain/ispRecommendationDecisionTypes';
import { buildDecisionSummary } from '../domain/ispRecommendationDecisionUtils';
import type { IspRecommendationSummary } from '../domain/ispRecommendationTypes';

// ─── ヘルパー ──────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return safeFormatDate(iso, (d) => {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }, iso);
}

function completionColor(rate: number): 'success' | 'warning' | 'inherit' {
  if (rate >= 1) return 'success';
  if (rate >= 0.5) return 'warning';
  return 'inherit';
}

// ─── メインコンポーネント ────────────────────────────────

export interface IspDecisionSummaryCardProps {
  /** ISP 提案サマリー */
  recommendations: IspRecommendationSummary;
  /** 判断レコード配列 */
  decisions: IspRecommendationDecision[];
}

const IspDecisionSummaryCard: React.FC<IspDecisionSummaryCardProps> = ({
  recommendations,
  decisions,
}) => {
  const summary = useMemo(
    () => buildDecisionSummary(recommendations, decisions),
    [recommendations, decisions],
  );

  // 目標が0件ならレンダリングしない
  if (summary.totalGoals === 0) return null;

  const completionRate = summary.totalGoals > 0
    ? summary.decidedCount / summary.totalGoals
    : 0;
  const completionPct = Math.round(completionRate * 100);
  const color = completionColor(completionRate);

  return (
    <Box
      data-testid="isp-decision-summary-card"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        border: '1px solid',
        borderColor: completionRate >= 1 ? 'success.light' : 'divider',
        borderRadius: 1,
        bgcolor: completionRate >= 1 ? 'success.50' : 'background.paper',
      }}
    >
      {/* プログレスリング */}
      <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
        <CircularProgress
          variant="determinate"
          value={completionPct}
          size={48}
          thickness={5}
          color={color}
          sx={{ ...(color === 'inherit' && { color: 'grey.400' }) }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {completionRate >= 1 ? (
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 20 }} />
          ) : (
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
              {completionPct}%
            </Typography>
          )}
        </Box>
      </Box>

      {/* テキスト部 */}
      <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
        {/* 1行目: タイトル + 件数 */}
        <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" rowGap={0.25}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            個別支援計画判断
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {summary.decidedCount}/{summary.totalGoals}件
          </Typography>

          {/* ステータスチップ */}
          {summary.byStatus.accepted > 0 && (
            <Chip
              label={`採用 ${summary.byStatus.accepted}`}
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20 }}
            />
          )}
          {summary.byStatus.deferred > 0 && (
            <Chip
              label={`保留 ${summary.byStatus.deferred}`}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20 }}
            />
          )}
          {summary.byStatus.dismissed > 0 && (
            <Chip
              label={`見送り ${summary.byStatus.dismissed}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20 }}
            />
          )}
          {summary.pendingCount > 0 && (
            <Chip
              label={`未判断 ${summary.pendingCount}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.6rem', height: 20, borderStyle: 'dashed' }}
            />
          )}
        </Stack>

        {/* 2行目: 最終更新 */}
        {summary.lastDecidedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
            最終: {formatDateTime(summary.lastDecidedAt)} by {summary.lastDecidedBy}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default React.memo(IspDecisionSummaryCard);
