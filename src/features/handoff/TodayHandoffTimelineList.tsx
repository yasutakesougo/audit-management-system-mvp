/**
 * 今日の申し送りタイムライン表示
 *
 * 時系列で申し送り一覧を表示
 * 状態変更・詳細表示などの操作も提供
 */

import { TESTIDS, tid } from '@/testids';
import {
    AccessTime as AccessTimeIcon,
    CheckCircle as CheckCircleIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    OpenInNew as OpenInNewIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DailyActivityNavState } from '../cross-module/navigationState';
import type { HandoffDayScope, HandoffRecord, HandoffStatus, MeetingMode } from './handoffTypes';
import { getAllowedActions, getNextStatus, getSeverityColor, HANDOFF_STATUS_META } from './handoffTypes';
import type { WorkflowActions } from './useHandoffTimelineViewModel';

export type HandoffStats = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
};

/**
 * 時刻フォーマット（HH:MM）
 */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const HANDOFF_SEEN_STORAGE_KEY = 'handoff-seen.v1';

type HandoffSeenMap = Record<string, string>;

const loadSeenMap = (): HandoffSeenMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(HANDOFF_SEEN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HandoffSeenMap;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

const saveSeenMap = (map: HandoffSeenMap) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HANDOFF_SEEN_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // noop
  }
};

/**
 * 申し送り1件の表示コンポーネント
 */
type HandoffItemProps = {
  item: HandoffRecord;
  onStatusChange: (id: number, status: HandoffRecord['status']) => Promise<void> | void;
  /** v3: 会議モード */
  meetingMode: MeetingMode;
  /** v3: ワークフローアクション */
  workflowActions?: WorkflowActions;
};

const HandoffItem: React.FC<HandoffItemProps> = ({ item, onStatusChange, meetingMode, workflowActions }) => {
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeen, setIsSeen] = useState(() => {
    const map = loadSeenMap();
    return Boolean(map[String(item.id)]);
  });
  const navigate = useNavigate();

  useEffect(() => {
    const map = loadSeenMap();
    setIsSeen(Boolean(map[String(item.id)]));
  }, [item.id]);

  const handleStatusToggle = async () => {
    const newStatus = getNextStatus(item.status);

    try {
      await onStatusChange(item.id, newStatus);
    } catch (error) {
      console.error('[handoff] Status update failed:', error);
    }
  };

  const handleOpenDailyRecord = () => {
    if (!item.userCode || item.userCode === 'ALL') {
      return;
    }

    // createdAt から YYYY-MM-DD を抽出
    const highlightDate = item.createdAt ? item.createdAt.split('T')[0] : undefined;

    const navState: DailyActivityNavState = {
      highlightUserId: item.userCode,
      highlightDate,
    };

    navigate('/daily/activity', { state: navState });
  };

  const isLongMessage = item.message.length > 100;
  const displayMessage = expanded || !isLongMessage
    ? item.message
    : item.message.substring(0, 100) + '...';

  const markSeen = useCallback(() => {
    if (isSeen) return;
    const map = loadSeenMap();
    const key = String(item.id);
    if (!map[key]) {
      map[key] = new Date().toISOString();
      saveSeenMap(map);
    }
    setIsSeen(true);
  }, [isSeen, item.id]);

  const handleToggleExpand = () => {
    if (!expanded) {
      markSeen();
    }
    setExpanded((prev) => !prev);
  };

  return (
    <Card variant="outlined"
      sx={{
      borderLeft: item.severity === '重要' ? '4px solid' : '2px solid',
      borderLeftColor: item.severity === '重要' ? 'error.main' :
                      item.severity === '要注意' ? 'warning.main' : 'grey.300',
      bgcolor: isSeen ? 'background.paper' : 'warning.50',
      transition: 'background-color 0.2s ease',
      }}
      {...tid(TESTIDS['agenda-timeline-item'])}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack spacing={1}>
          {/* ヘッダー行：時刻・利用者・ラベル群 */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {formatTime(item.createdAt)}
            </Typography>

            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {item.userDisplayName}
            </Typography>

            {!isSeen && (
              <Chip
                size="small"
                label="未確認"
                color="warning"
                variant="outlined"
              />
            )}

            <Chip
              size="small"
              label={item.category}
              color="primary"
              variant="outlined"
            />

            <Chip
              size="small"
              label={item.severity}
              color={getSeverityColor(item.severity)}
              variant={item.severity === '通常' ? 'outlined' : 'filled'}
            />

            <Chip
              size="small"
              label={item.timeBand}
              variant="outlined"
              color="secondary"
            />

            <Box sx={{ flexGrow: 1 }} />

            {/* 対応状況チップ（クリックで状態変更） */}
            <Chip
              size="small"
              label={HANDOFF_STATUS_META[item.status].label}
              color={HANDOFF_STATUS_META[item.status].color}
              variant={item.status === '対応済' ? 'filled' : 'outlined'}
              onClick={handleStatusToggle}
              clickable
              icon={
                item.status === '対応済' ? <CheckCircleIcon /> :
                item.status === '対応中' ? <AccessTimeIcon /> :
                <RadioButtonUncheckedIcon />
              }
            />
          </Stack>

          {/* 本文 */}
          <Box>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: item.status === '対応済' ? 'text.secondary' : 'text.primary'
              }}
              onClick={!isLongMessage ? markSeen : undefined}
            >
              {displayMessage}
            </Typography>

            {/* 展開/折りたたみ */}
            {isLongMessage && (
              <Button
                size="small"
                onClick={handleToggleExpand}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ mt: 0.5, p: 0 }}
              >
                {expanded ? '折りたたむ' : '続きを読む'}
              </Button>
            )}
          </Box>

          {/* 作成者情報（小さく表示） */}
          <Typography variant="caption" color="text.secondary">
            記録者: {item.createdByName}
          </Typography>

          {/* Phase 2-1: この利用者の記録を開くCTA */}
          {item.userCode && item.userCode !== 'ALL' && (
            <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenDailyRecord}
                data-testid="handoff-open-daily-highlight"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                この利用者の記録を開く
              </Button>
            </Box>
          )}

          {/* v3: モード別アクションボタン */}
          {meetingMode !== 'normal' && workflowActions && (() => {
            const allowed = getAllowedActions(item.status, meetingMode);
            if (allowed.length === 0) return null;

            const ACTION_META: Record<string, { label: string; emoji: string; color: 'primary' | 'warning' | 'success' }> = {
              '確認済': { label: '確認済', emoji: '✅', color: 'primary' },
              '明日へ持越': { label: '明日へ', emoji: '📅', color: 'warning' },
              '完了': { label: '完了', emoji: '🔒', color: 'success' },
              '対応済': { label: '完了', emoji: '✅', color: 'success' },
            };

            const handleAction = async (targetStatus: HandoffStatus) => {
              if (isSaving) return;
              setIsSaving(true);
              try {
                if (targetStatus === '確認済') await workflowActions.markReviewed(item.id);
                else if (targetStatus === '明日へ持越') await workflowActions.markCarryOver(item.id);
                else if (targetStatus === '完了' || targetStatus === '対応済') await workflowActions.markClosed(item.id);
              } finally {
                setIsSaving(false);
              }
            };

            return (
              <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={2} sx={{ gap: 2 }}>
                  {allowed.map((targetStatus) => {
                    const meta = ACTION_META[targetStatus];
                    if (!meta) return null;
                    return (
                      <Button
                        key={targetStatus}
                        size="small"
                        variant="outlined"
                        color={meta.color}
                        disabled={isSaving}
                        onClick={() => handleAction(targetStatus)}
                        aria-label={`${meta.label}: ${item.title}`}
                        sx={{ minWidth: 44, minHeight: 44 }}
                      >
                        {meta.emoji} {meta.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Box>
            );
          })()}
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * 申し送りタイムライン一覧（日付・時間帯フィルタ対応）
 */
type TodayHandoffTimelineListProps = {
  /** v3: Page から注入されたデータ (リフト済み) */
  items: HandoffRecord[];
  loading: boolean;
  error: string | null;
  updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  dayScope?: HandoffDayScope;
  onStatsChange?: (stats: HandoffStats | null) => void;
  maxItems?: number;
  /** v3: 会議モード */
  meetingMode?: MeetingMode;
  /** v3: ワークフローアクション */
  workflowActions?: WorkflowActions;
};

export const TodayHandoffTimelineList: React.FC<TodayHandoffTimelineListProps> = ({
  items,
  loading,
  error,
  updateHandoffStatus,
  dayScope = 'today',
  onStatsChange,
  maxItems,
  meetingMode = 'normal',
  workflowActions,
}) => {
  const safeHandoffs = Array.isArray(items) ? items : [];

  const stats: HandoffStats = useMemo(() => {
    const total = safeHandoffs.length;
    const completed = safeHandoffs.filter(item => item.status === '対応済').length;
    const inProgress = safeHandoffs.filter(item => item.status === '対応中').length;
    const pending = safeHandoffs.filter(item => item.status === '未対応').length;

    return { total, completed, inProgress, pending };
  }, [safeHandoffs]);

  const visibleHandoffs = useMemo(() => {
    if (typeof maxItems !== 'number') return safeHandoffs;
    return safeHandoffs.slice(0, Math.max(0, maxItems));
  }, [safeHandoffs, maxItems]);

  useEffect(() => {
    if (!onStatsChange) {
      return;
    }
    if (loading || error) {
      onStatsChange(null);
      return;
    }
    onStatsChange(stats);
  }, [loading, error, stats, onStatsChange]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          申し送りデータを読み込み中...
        </Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <Typography variant="subtitle2">データ読み込みエラー</Typography>
        <Typography variant="body2">{error}</Typography>
      </Alert>
    );
  }

  if (!safeHandoffs.length) {
    const emptyMessage = dayScope === 'yesterday'
      ? '📝 昨日の申し送りはありません'
      : '📝 本日の申し送りはまだありません';

    const subMessage = dayScope === 'yesterday'
      ? '前日からの引き継ぎ事項がない場合は問題ありません'
      : '上の「今すぐ申し送り」から気軽に記録してみてください';

    return (
      <Box sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        bgcolor: 'grey.50',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'grey.300'
      }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          {emptyMessage}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subMessage}
        </Typography>
      </Box>
    );
  }

  const statsLabel = dayScope === 'yesterday' ? '昨日の申し送り状況' : '本日の申し送り状況';

  return (
    <Stack spacing={2}>
      {/* 統計サマリー */}
      <Box sx={{
        p: 2,
        bgcolor: 'primary.50',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'primary.200'
      }}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            📊 {statsLabel}
          </Typography>
          <Typography variant="body2">
            全{stats.total}件
          </Typography>
          {stats.pending > 0 && (
            <Chip
              size="small"
              label={`未対応 ${stats.pending}件`}
              color="default"
            />
          )}
          {stats.inProgress > 0 && (
            <Chip
              size="small"
              label={`対応中 ${stats.inProgress}件`}
              color="warning"
            />
          )}
          {stats.completed > 0 && (
            <Chip
              size="small"
              label={`対応済 ${stats.completed}件`}
              color="success"
            />
          )}
        </Stack>
      </Box>

      {/* 申し送り一覧 */}
      <Stack spacing={1.5} {...tid(TESTIDS['agenda-timeline-list'])}>
        {visibleHandoffs.map(item => (
          <HandoffItem
            key={item.id}
            item={item}
            onStatusChange={updateHandoffStatus}
            meetingMode={meetingMode}
            workflowActions={workflowActions}
          />
        ))}
      </Stack>
    </Stack>
  );
};
