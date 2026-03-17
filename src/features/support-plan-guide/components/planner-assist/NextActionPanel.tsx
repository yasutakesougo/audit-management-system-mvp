/**
 * NextActionPanel — Planner Assist の Next Action Panel (P5-A / P5-C1 / P5-C2 / P5-C3 / P6-A)
 *
 * computePlannerInsights() の出力を受けて描画する Thin Component。
 * P5-C1: 各アクション行をクリックで展開し、詳細内訳を表示する。
 * P5-C2: アクション一覧の下に週次トレンドスパークラインを表示する。
 * P5-C3: 値の変化をハイライト・差分バッジ・方向アイコンで認知しやすくする。
 * P6-A:  usePlannerAssistTracking を接続し、shown / clicked / landed イベントを発火する。
 *
 * 新しいロジックは持たず、既存レイヤーの集約結果を可視化する。
 *
 * 配置: SupportPlanGuidePage の RegulatorySection と HUD の間。
 * 権限: plannerAssist.view が true のときのみ表示。
 */

import React, { useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import type {
  PlannerInsightItem,
  PlannerInsights,
  PlannerInsightDetails,
  PlannerInsightDetailItem,
  PlannerTrendSeries,
} from '../../domain/plannerInsights';
import { formatRate } from '../../domain/suggestionDecisionMetrics';
import { PlannerTrendSparkline } from './PlannerTrendSparkline';
import { useNumberChange, useRateChange } from '../../hooks/useChangeDetection';
import type { PlannerAssistTracker } from '../../hooks/usePlannerAssistTracking';

// ────────────────────────────────────────────
// severity → color mapping
// ────────────────────────────────────────────

const SEVERITY_COLOR: Record<PlannerInsightItem['severity'], 'error' | 'warning' | 'info'> = {
  danger: 'error',
  warning: 'warning',
  info: 'info',
};

const SEVERITY_BG: Record<PlannerInsightItem['severity'], string> = {
  danger: 'rgba(211, 47, 47, 0.08)',
  warning: 'rgba(237, 108, 2, 0.08)',
  info: 'rgba(2, 136, 209, 0.08)',
};

/** P5-C3: ハイライトパルスの背景色 */
const HIGHLIGHT_BG = 'rgba(33, 150, 243, 0.12)';

/** P5-C3: 差分バッジの色 */
const DELTA_COLORS = {
  positive: '#d32f2f', // 件数が増えた = 要注意
  negative: '#2e7d32', // 件数が減った = 改善
  rateUp: '#2e7d32',   // 採用率上昇 = 良い
  rateDown: '#d32f2f', // 採用率低下 = 要注意
} as const;

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

export type NextActionPanelProps = {
  actions: PlannerInsightItem[];
  summary: PlannerInsights['summary'];
  /** 各アクション行の展開詳細 (P5-C1) */
  details?: PlannerInsightDetails;
  /** 週次トレンドシリーズ (P5-C2) */
  trendSeries?: PlannerTrendSeries;
  onNavigate: (tab: string) => void;
  /** P6-A: イベントトラッカー。未指定時はイベント発火なし */
  tracker?: PlannerAssistTracker;
};

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const NextActionPanel: React.FC<NextActionPanelProps> = ({
  actions,
  summary,
  details,
  trendSeries,
  onNavigate,
  tracker,
}) => {
  // 全アクション 0件なら非表示
  if (actions.length === 0) return null;

  // P6-A: panel_shown — 同一 session 内 1 回のみ
  const shownRef = useRef(false);
  useEffect(() => {
    if (tracker && !shownRef.current) {
      shownRef.current = true;
      tracker.trackPanelShown(actions.length, summary.weeklyAcceptanceRate);
    }
  }, [tracker, actions.length, summary.weeklyAcceptanceRate]);

  // P6-A: onNavigate をラップして tab_landed を発火
  const handleNavigate = useCallback(
    (tab: string) => {
      tracker?.trackTabLanded(tab);
      onNavigate(tab);
    },
    [tracker, onNavigate],
  );

  // P5-C3: 合計件数の変化検出
  const totalChange = useNumberChange(summary.totalOpenActions);
  // P5-C3: 採用率の変化検出
  const rateChange = useRateChange(summary.weeklyAcceptanceRate);

  return (
    <Paper
      variant="outlined"
      data-testid="next-action-panel"
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.25, md: 1.5 },
        borderLeft: (theme) => `3px solid ${theme.palette.primary.main}`,
        transition: 'box-shadow 0.2s ease-in-out, background-color 0.3s ease-in-out',
        bgcolor: totalChange.justChanged ? HIGHLIGHT_BG : 'transparent',
      }}
    >
      <Stack spacing={1.25}>
        {/* ── ヘッダー ── */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <AssignmentTurnedInRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              Planner Assist
            </Typography>
            <Chip
              size="small"
              label={`${summary.totalOpenActions}件`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.7rem', height: 20 }}
            />
            {/* P5-C3: 件数差分バッジ */}
            {totalChange.justChanged && totalChange.delta !== undefined && (
              <Typography
                variant="caption"
                data-testid="total-delta-badge"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  color: totalChange.delta > 0 ? DELTA_COLORS.positive : DELTA_COLORS.negative,
                  animation: 'fadeInOut 1.5s ease-in-out',
                  '@keyframes fadeInOut': {
                    '0%': { opacity: 0, transform: 'translateY(-4px)' },
                    '20%': { opacity: 1, transform: 'translateY(0)' },
                    '80%': { opacity: 1 },
                    '100%': { opacity: 0 },
                  },
                }}
              >
                {totalChange.delta > 0 ? `+${totalChange.delta}` : totalChange.delta}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {/* P5-C3: 採用率 + 変化方向 */}
            {summary.weeklyAcceptanceRate !== undefined && (
              <Chip
                size="small"
                variant="outlined"
                label={
                  rateChange.directionIcon
                    ? `${rateChange.directionIcon} 採用率: ${formatRate(summary.weeklyAcceptanceRate)}`
                    : `採用率: ${formatRate(summary.weeklyAcceptanceRate)}`
                }
                data-testid="acceptance-rate-chip"
                sx={{
                  fontSize: '0.7rem',
                  height: 20,
                  fontWeight: 500,
                  transition: 'border-color 0.3s ease-in-out',
                  borderColor: rateChange.justChanged
                    ? rateChange.directionIcon === '↑'
                      ? DELTA_COLORS.rateUp
                      : DELTA_COLORS.rateDown
                    : undefined,
                }}
              />
            )}
            {/* P5-C3: 更新インジケータ */}
            {totalChange.justChanged && (
              <Typography
                variant="caption"
                data-testid="update-indicator"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.6rem',
                  fontStyle: 'italic',
                  animation: 'fadeInOut 1.5s ease-in-out',
                  '@keyframes fadeInOut': {
                    '0%': { opacity: 0 },
                    '20%': { opacity: 1 },
                    '80%': { opacity: 1 },
                    '100%': { opacity: 0 },
                  },
                }}
              >
                更新済
              </Typography>
            )}
          </Stack>
        </Stack>

        {/* ── アクション行 ── */}
        <Stack spacing={0.5}>
          {actions.map((item) => (
            <NextActionRow
              key={item.key}
              item={item}
              detailItems={details?.[item.key]}
              onNavigate={handleNavigate}
              tracker={tracker}
            />
          ))}
        </Stack>

        {/* ── スパークライン (P5-C2) ── */}
        {trendSeries && <PlannerTrendSparkline series={trendSeries} />}
      </Stack>
    </Paper>
  );
};

// ────────────────────────────────────────────
// 個別アクション行（展開対応）
// ────────────────────────────────────────────

const NextActionRow: React.FC<{
  item: PlannerInsightItem;
  detailItems?: PlannerInsightDetailItem[];
  onNavigate: (tab: string) => void;
  tracker?: PlannerAssistTracker;
}> = ({ item, detailItems, onNavigate, tracker }) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasDetails = detailItems && detailItems.length > 0;

  // P5-C3: 行別カウント変化検出
  const countChange = useNumberChange(item.count);

  const handleClick = React.useCallback(() => {
    if (hasDetails) {
      setExpanded((prev) => !prev);
    } else {
      // P6-A: action_clicked を発火
      tracker?.trackActionClicked(item.key, item.tab);
      onNavigate(item.tab);
    }
  }, [hasDetails, item.tab, item.key, onNavigate, tracker]);

  const handleNavigate = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // P6-A: action_clicked を発火
      tracker?.trackActionClicked(item.key, item.tab);
      onNavigate(item.tab);
    },
    [item.tab, item.key, onNavigate, tracker],
  );

  return (
    <Box data-testid={`next-action-row-${item.key}`}>
      <Box
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.75,
          borderRadius: 1,
          bgcolor: countChange.justChanged ? HIGHLIGHT_BG : SEVERITY_BG[item.severity],
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out, background-color 0.3s ease-in-out',
          '&:hover': {
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)',
            transform: 'translateX(2px)',
          },
          '&:focus-visible': {
            outline: (theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 1,
          },
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
          <Chip
            size="small"
            label={item.count}
            color={SEVERITY_COLOR[item.severity]}
            variant="filled"
            sx={{
              fontWeight: 700,
              fontSize: '0.75rem',
              minWidth: 28,
              height: 22,
              flexShrink: 0,
            }}
          />
          {/* P5-C3: 行別カウント差分バッジ */}
          {countChange.justChanged && countChange.delta !== undefined && (
            <Typography
              variant="caption"
              data-testid={`row-delta-${item.key}`}
              sx={{
                fontWeight: 700,
                fontSize: '0.6rem',
                flexShrink: 0,
                color: countChange.delta > 0 ? DELTA_COLORS.positive : DELTA_COLORS.negative,
                minWidth: 20,
                textAlign: 'center',
              }}
            >
              {countChange.delta > 0 ? `+${countChange.delta}` : countChange.delta}
            </Typography>
          )}
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </Typography>
          {item.description && !expanded && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {item.description}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
          {hasDetails && (
            <ExpandMoreRoundedIcon
              fontSize="small"
              data-testid={`expand-icon-${item.key}`}
              sx={{
                color: 'text.secondary',
                transition: 'transform 0.2s ease-in-out',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          )}
          <IconButton
            size="small"
            color={SEVERITY_COLOR[item.severity]}
            aria-label={`${item.label}を開く`}
            onClick={handleNavigate}
          >
            <OpenInNewRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* ── 展開詳細 (P5-C1) ── */}
      {hasDetails && (
        <Collapse in={expanded} data-testid={`detail-collapse-${item.key}`}>
          <NextActionDetailList
            items={detailItems!}
            severity={item.severity}
            onNavigate={onNavigate}
          />
        </Collapse>
      )}
    </Box>
  );
};

// ────────────────────────────────────────────
// 展開詳細リスト (P5-C1)
// ────────────────────────────────────────────

const NextActionDetailList: React.FC<{
  items: PlannerInsightDetailItem[];
  severity: PlannerInsightItem['severity'];
  onNavigate: (tab: string) => void;
}> = ({ items, severity, onNavigate }) => {
  return (
    <Stack
      spacing={0}
      data-testid="detail-list"
      sx={{
        ml: 3.5,
        mt: 0.25,
        mb: 0.75,
        borderLeft: (theme) => `2px solid ${theme.palette[SEVERITY_COLOR[severity]].light}`,
        pl: 1.5,
      }}
    >
      {items.map((item, idx) => (
        <Box
          key={idx}
          data-testid={`detail-item-${idx}`}
          onClick={() => item.navigateTo && onNavigate(item.navigateTo)}
          sx={{
            py: 0.5,
            px: 1,
            borderRadius: 0.5,
            cursor: item.navigateTo ? 'pointer' : 'default',
            transition: 'background-color 0.15s ease-in-out',
            '&:hover': item.navigateTo
              ? {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.02)',
                }
              : {},
          }}
        >
          <Typography variant="body2" fontWeight={500} sx={{ lineHeight: 1.4 }}>
            {item.label}
          </Typography>
          {item.detail && (
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {item.detail}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
};

export default NextActionPanel;
