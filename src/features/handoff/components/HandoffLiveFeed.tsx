/**
 * HandoffLiveFeed — ダッシュボード常時表示ライブフィード
 *
 * Action Rail やメインエリアに配置し、申し送りの最新投稿を
 * リアルタイムに流すウィジェット。
 *
 * 機能:
 * - 最新 N 件を時系列表示（新着が上にスライドイン）
 * - 新着アイテムのパルスアニメーション
 * - 30秒ごとの自動リロード（ポーリング）
 * - コンパクト表示モード（1行サマリー）
 * - ステータス更新もインライン可能
 * - 「全件を見る」ボタンでタイムラインページへ遷移
 */

import { motionTokens } from '@/app/theme';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import TimelineIcon from '@mui/icons-material/Timeline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSeverityColor } from '../handoffConstants';
import { HANDOFF_STATUS_META } from '../handoffStateMachine';
import type { HandoffDayScope, HandoffRecord, HandoffStatus } from '../handoffTypes';

// ────────────────────────────────────────────────────────────
// アニメーション
// ────────────────────────────────────────────────────────────

const slideIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(-12px) scale(0.97);
  }
  60% {
    opacity: 1;
    transform: translateY(2px) scale(1.005);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

const newItemGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(33, 150, 243, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
`;

const livePulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export interface HandoffLiveFeedProps {
  /** 申し送りデータ */
  items: HandoffRecord[];
  /** 読み込み中 */
  loading: boolean;
  /** エラー */
  error: string | null;
  /** ステータス更新 */
  updateHandoffStatus?: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  /** 最大表示件数 (default: 8) */
  maxItems?: number;
  /** タイムラインを開くコールバック */
  onOpenTimeline?: (scope: HandoffDayScope) => void;
  /** 自動リロード関数 */
  onReload?: () => void;
  /** ポーリング間隔 (ms, default: 30000) */
  pollingInterval?: number;
  /** コンパクトモード (Action Rail 向け) */
  compact?: boolean;
}

// ────────────────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}時間前`;
  return formatTime(iso);
}

// ────────────────────────────────────────────────────────────
// コンパクト1件表示
// ────────────────────────────────────────────────────────────

interface FeedItemProps {
  item: HandoffRecord;
  isNew: boolean;
  compact: boolean;
  onStatusChange?: (id: number, newStatus: HandoffStatus) => Promise<void>;
}

const FeedItem: React.FC<FeedItemProps> = React.memo(({
  item,
  isNew,
  compact,
  onStatusChange,
}) => {
  const theme = useTheme();
  const isCompleted = item.status === '対応済' || item.status === '完了';

  const severityBorder = (() => {
    switch (item.severity) {
      case '重要':
        return isCompleted ? theme.palette.grey[300] : theme.palette.error.main;
      case '要注意':
        return isCompleted ? theme.palette.grey[300] : theme.palette.warning.main;
      default:
        return isCompleted ? theme.palette.grey[300] : theme.palette.grey[400];
    }
  })();

  return (
    <Box
      sx={{
        animation: isNew ? `${slideIn} 400ms ${motionTokens.easing.decel}` : undefined,
        '&:not(:last-child)': { mb: 0.75 },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          px: 1.5,
          py: compact ? 0.75 : 1,
          borderLeft: `3px solid ${severityBorder}`,
          opacity: isCompleted ? 0.55 : 1,
          bgcolor: isCompleted
            ? 'transparent'
            : (item.severity === '重要'
              ? alpha(theme.palette.error.main, 0.03)
              : 'background.paper'),
          transition: motionTokens.transition.cardInteractive,
          ...(isNew && {
            animation: `${newItemGlow} 2s ease-out`,
          }),
          '&:hover': {
            bgcolor: alpha(theme.palette.action.hover, 0.06),
            transform: 'translateX(2px)',
          },
        }}
      >
        {compact ? (
          /* ── コンパクト: 1行表示 ── */
          <Stack direction="row" alignItems="center" spacing={0.75}>
            {/* 時刻 */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: 'text.disabled',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.65rem',
                flexShrink: 0,
                width: 36,
              }}
            >
              {formatTime(item.createdAt)}
            </Typography>

            {/* 重要度ドット */}
            {item.severity !== '通常' && (
              <FiberManualRecordIcon
                sx={{
                  fontSize: 8,
                  flexShrink: 0,
                  color: item.severity === '重要' ? 'error.main' : 'warning.main',
                }}
              />
            )}

            {/* 利用者 + メッセージ */}
            <Typography
              variant="caption"
              noWrap
              sx={{
                flex: 1,
                fontSize: '0.72rem',
                color: isCompleted ? 'text.disabled' : 'text.primary',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: alpha(theme.palette.text.disabled, 0.4),
                }),
              }}
            >
              <Box component="span" sx={{ fontWeight: 600, mr: 0.5 }}>
                {item.userDisplayName}
              </Box>
              {item.message.slice(0, 60)}
            </Typography>

            {/* ステータスチップ */}
            <Chip
              size="small"
              label={HANDOFF_STATUS_META[item.status].label}
              color={HANDOFF_STATUS_META[item.status].color}
              variant={isCompleted ? 'filled' : 'outlined'}
              onClick={
                onStatusChange
                  ? () => {
                      const nextMap: Record<string, HandoffStatus> = {
                        '未対応': '対応中',
                        '対応中': '対応済',
                        '対応済': '未対応',
                      };
                      const next = nextMap[item.status] ?? '未対応';
                      onStatusChange(item.id, next);
                    }
                  : undefined
              }
              clickable={!!onStatusChange}
              icon={
                isCompleted ? <CheckCircleIcon /> :
                item.status === '対応中' ? <AccessTimeIcon /> :
                <RadioButtonUncheckedIcon />
              }
              sx={{
                height: 20,
                fontSize: '0.6rem',
                fontWeight: 600,
                flexShrink: 0,
                '& .MuiChip-icon': { fontSize: 12 },
                '&:active': { transform: 'scale(0.95)' },
              }}
            />
          </Stack>
        ) : (
          /* ── 通常: 2行表示 ── */
          <Stack spacing={0.5}>
            {/* Row 1: 時刻 + 利用者 + ステータス */}
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.68rem',
                  flexShrink: 0,
                }}
              >
                {formatTime(item.createdAt)}
              </Typography>

              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: isCompleted ? 'text.disabled' : 'text.primary',
                  flex: 1,
                }}
              >
                {item.userDisplayName}
              </Typography>

              {item.severity !== '通常' && (
                <Chip
                  size="small"
                  label={item.severity}
                  color={getSeverityColor(item.severity)}
                  variant="filled"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                />
              )}

              <Chip
                size="small"
                label={HANDOFF_STATUS_META[item.status].label}
                color={HANDOFF_STATUS_META[item.status].color}
                variant={isCompleted ? 'filled' : 'outlined'}
                onClick={
                  onStatusChange
                    ? () => {
                        const nextMap: Record<string, HandoffStatus> = {
                          '未対応': '対応中',
                          '対応中': '対応済',
                          '対応済': '未対応',
                        };
                        const next = nextMap[item.status] ?? '未対応';
                        onStatusChange(item.id, next);
                      }
                    : undefined
                }
                clickable={!!onStatusChange}
                icon={
                  isCompleted ? <CheckCircleIcon /> :
                  item.status === '対応中' ? <AccessTimeIcon /> :
                  <RadioButtonUncheckedIcon />
                }
                sx={{
                  height: 22,
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  flexShrink: 0,
                  '& .MuiChip-icon': { fontSize: 14 },
                  '&:active': { transform: 'scale(0.95)' },
                }}
              />
            </Stack>

            {/* Row 2: メッセージ */}
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.78rem',
                lineHeight: 1.5,
                color: isCompleted ? 'text.disabled' : 'text.primary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                ...(isCompleted && {
                  textDecoration: 'line-through',
                  textDecorationColor: alpha(theme.palette.text.disabled, 0.4),
                }),
              }}
            >
              {item.message}
            </Typography>

            {/* Row 3: メタ情報 */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                size="small"
                label={item.category}
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  borderColor: 'divider',
                  color: 'text.secondary',
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', fontSize: '0.58rem', ml: 'auto !important' }}
              >
                {getRelativeTime(item.createdAt)} · {item.createdByName}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
});
FeedItem.displayName = 'FeedItem';

// ────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────

export const HandoffLiveFeed: React.FC<HandoffLiveFeedProps> = ({
  items,
  loading,
  error,
  updateHandoffStatus,
  maxItems = 8,
  onOpenTimeline,
  onReload,
  pollingInterval = 30_000,
  compact = false,
}) => {
  const theme = useTheme();
  const [prevItemIds, setPrevItemIds] = useState<Set<number>>(new Set());
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const isInitialMount = useRef(true);

  // ── ポーリング: 定期的に自動リロード ──
  useEffect(() => {
    if (!onReload || pollingInterval <= 0) return;
    const timer = setInterval(onReload, pollingInterval);
    return () => clearInterval(timer);
  }, [onReload, pollingInterval]);

  // ── 新着アイテム検出 ──
  const safeItems = Array.isArray(items) ? items : [];
  const currentIds = useMemo(
    () => new Set(safeItems.map((i) => i.id)),
    [safeItems],
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      setPrevItemIds(currentIds);
      return;
    }

    const freshIds = new Set<number>();
    currentIds.forEach((id) => {
      if (!prevItemIds.has(id)) {
        freshIds.add(id);
      }
    });

    if (freshIds.size > 0) {
      setNewIds(freshIds);
      // 3秒後にフラッシュ解除
      const timer = setTimeout(() => setNewIds(new Set()), 3000);
      setPrevItemIds(currentIds);
      return () => clearTimeout(timer);
    }

    setPrevItemIds(currentIds);
  }, [currentIds]);

  // ── 表示するアイテム ──
  const visibleItems = useMemo(
    () => safeItems.slice(0, maxItems),
    [safeItems, maxItems],
  );

  const stats = useMemo(() => {
    const total = safeItems.length;
    const pending = safeItems.filter((i) => i.status === '未対応').length;
    const inProgress = safeItems.filter((i) => i.status === '対応中').length;
    return { total, pending, inProgress };
  }, [safeItems]);

  // ── ステータス更新ハンドラ ──
  const handleStatusChange = updateHandoffStatus
    ? async (id: number, newStatus: HandoffStatus) => {
        await updateHandoffStatus(id, newStatus);
      }
    : undefined;

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, 0.6),
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* ── ヘッダー ── */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, ${alpha(theme.palette.primary.main, 0.02)})`,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <TimelineIcon
            sx={{
              fontSize: 18,
              color: 'primary.main',
              animation: `${livePulse} 2.5s ease-in-out infinite`,
            }}
          />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, fontSize: '0.82rem', flex: 1 }}
          >
            申し送りフィード
          </Typography>

          {/* Live indicator */}
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <FiberManualRecordIcon
              sx={{
                fontSize: 8,
                color: 'success.main',
                animation: `${livePulse} 2s ease-in-out infinite`,
              }}
            />
            <Typography
              variant="caption"
              sx={{ color: 'success.main', fontSize: '0.62rem', fontWeight: 600 }}
            >
              LIVE
            </Typography>
          </Stack>
        </Stack>

        {/* ミニ統計 */}
        {stats.total > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
              計{stats.total}件
            </Typography>
            {stats.pending > 0 && (
              <Chip
                size="small"
                label={`未対応 ${stats.pending}`}
                color="warning"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.58rem' }}
              />
            )}
            {stats.inProgress > 0 && (
              <Chip
                size="small"
                label={`対応中 ${stats.inProgress}`}
                color="info"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.58rem' }}
              />
            )}
          </Stack>
        )}
      </Box>

      {/* ── コンテンツ ── */}
      <Box
        sx={{
          maxHeight: compact ? 320 : 460,
          overflowY: 'auto',
          px: 1,
          py: 0.75,
          '&::-webkit-scrollbar': { width: 3 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.secondary, 0.15),
            borderRadius: 2,
          },
        }}
      >
        {loading && safeItems.length === 0 && (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              読み込み中...
            </Typography>
          </Stack>
        )}

        {error && (
          <Typography variant="caption" color="error" sx={{ p: 1 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && safeItems.length === 0 && (
          <Box
            sx={{
              py: 3,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
              📝 まだ今日の申し送りはありません
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              新しい申し送りが追加されると自動で表示されます
            </Typography>
          </Box>
        )}

        {visibleItems.map((item) => (
          <Collapse key={item.id} in timeout={300}>
            <FeedItem
              item={item}
              isNew={newIds.has(item.id)}
              compact={compact}
              onStatusChange={handleStatusChange}
            />
          </Collapse>
        ))}

        {safeItems.length > maxItems && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: 'text.disabled',
              py: 0.5,
              fontSize: '0.62rem',
            }}
          >
            他 {safeItems.length - maxItems}件
          </Typography>
        )}
      </Box>

      {/* ── フッター: 全件を見る ── */}
      {onOpenTimeline && (
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Button
            size="small"
            startIcon={<OpenInFullIcon sx={{ fontSize: 14 }} />}
            onClick={() => onOpenTimeline('today')}
            sx={{
              fontSize: '0.72rem',
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' },
            }}
          >
            タイムライン全件を見る
          </Button>
        </Box>
      )}
    </Paper>
  );
};
